/** @typedef {import('./input.js').MatrixDefinition} MatrixDefinition */
/** @typedef {import('./input.js').MatrixItem} MatrixItem */

/**
 * @typedef {Object} LaneLayout
 * @property {string} lane レーンのラベル
 * @property {string | undefined} color レーンの色
 * @property {Track[]} tracks レーン内のトラック
 * @property {number} y レーンの描画開始位置
 * @property {number} height レーンの高さ
 */

const FONT_SIZE = 14;
const LINE_HEIGHT = 17;
const TRACK_GAP = 8;
const TRACK_MIN_HEIGHT = 42;
const LANE_PADDING = 12;
const LANE_MIN_HEIGHT = 58;
export const MARGIN = { top: 120, right: 2, bottom: 40, left: 200 };
const COLORS = {
  ink: "#172c46",
  muted: "#536579",
  grid: "#d7e0e8",
  lane: "#f4f7fa",
  laneAlt: "#ebf1f6",
  bar: "#d9eafa",
  barStroke: "#2872aa",
  background: "#ffffff",
};
const INK_RGB = [23, 44, 70];

/** SVG属性やテキストに埋め込む値をXMLエスケープする。 @param {string} value @returns {string} */
function escapeXml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[character],
  );
}

/** @param {string} color #RGBまたは#RRGGBB @returns {{ hex: string, channels: number[] }} */
function parseHex(color) {
  const hex =
    color.length === 4
      ? [...color.slice(1)].map((digit) => digit + digit).join("")
      : color.slice(1);
  return {
    hex,
    channels: hex.match(/.{2}/g).map((channel) => Number.parseInt(channel, 16)),
  };
}

/** WCAGの相対輝度。 @param {number[]} rgb @returns {number} */
function luminance(rgb) {
  return rgb
    .map((channel) => {
      const normalized = channel / 255;
      return normalized <= 0.04045
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4;
    })
    .reduce(
      (sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index],
      0,
    );
}

/** @param {number} left 輝度 @param {number} right 輝度 @returns {number} コントラスト比 */
function contrast(left, right) {
  return (Math.max(left, right) + 0.05) / (Math.min(left, right) + 0.05);
}

/**
 * 背景色から帯の塗り、枠線、コントラストを考慮した文字色を決める。
 * @param {string | undefined} color
 * @param {string} [defaultFill]
 * @param {string} [defaultStroke]
 * @returns {{ fill: string, stroke: string, text: string }}
 */
function itemColors(
  color,
  defaultFill = COLORS.bar,
  defaultStroke = COLORS.barStroke,
) {
  if (!color)
    return { fill: defaultFill, stroke: defaultStroke, text: COLORS.ink };
  const { hex, channels } = parseHex(color);
  const background = luminance(channels);
  const stroke = channels
    .map((channel) =>
      Math.round(channel * 0.72)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");
  const text =
    contrast(1, background) > contrast(luminance(INK_RGB), background)
      ? "#ffffff"
      : COLORS.ink;
  return { fill: `#${hex.toLowerCase()}`, stroke: `#${stroke}`, text };
}

/** @param {string} character @returns {number} */
function characterWidth(character) {
  return /[\u0020-\u007e\u00a0-\u00ff]/.test(character) ? 0.58 : 1;
}

/**
 * ラベルを概算文字幅に基づいて複数行に折り返す。
 * @param {string} label
 * @param {number} maxWidth
 * @returns {string[]}
 */
function wrapLabel(label, maxWidth) {
  const maxUnits = Math.max(6, Math.floor(maxWidth / (FONT_SIZE * 0.95)));
  const lines = [];
  let line = "";
  let units = 0;
  for (const character of Array.from(label)) {
    const width = characterWidth(character);
    if (line && units + width > maxUnits) {
      lines.push(line);
      line = "";
      units = 0;
    }
    line += character;
    units += width;
  }
  if (line) lines.push(line);
  return lines;
}

/** 描画に必要な項目状態を保持する。 */
export class RenderItem {
  /**
   * @param {MatrixItem} source
   * @param {number} start
   * @param {number} end
   * @param {number} x
   * @param {number} width
   */
  constructor(source, start, end, x, width) {
    this.source = source;
    this.start = start;
    this.end = end;
    this.x = x;
    this.width = width;
    this.lines = wrapLabel(source.label, width - 20);
  }

  get height() {
    return this.lines.length * LINE_HEIGHT + 14;
  }
}

/** 同じトラックに配置できる項目を管理する。 */
export class Track {
  constructor() {
    this.end = -1;
    this.items = [];
  }

  /** @param {RenderItem} item @returns {boolean} */
  canAccept(item) {
    return this.end <= item.start;
  }

  /** @param {RenderItem} item */
  add(item) {
    if (!this.canAccept(item)) throw new RangeError("Track items overlap.");
    this.items.push(item);
    this.end = item.end;
  }

  get height() {
    return Math.max(TRACK_MIN_HEIGHT, ...this.items.map((item) => item.height));
  }
}

/** 同一レーン内で期間が重ならないよう項目をトラックに割り当てる。 @param {RenderItem[]} items @returns {Track[]} */
function assignTracks(items) {
  /** @type {Track[]} */
  const tracks = [];
  const ordered = [...items].sort(
    (left, right) => left.start - right.start || left.end - right.end,
  );
  for (const item of ordered) {
    let track = tracks.find((candidate) => candidate.canAccept(item));
    if (!track) {
      track = new Track();
      tracks.push(track);
    }
    track.add(item);
  }
  return tracks;
}

/**
 * 項目をレーンに配置し、レーンごとの高さと描画開始位置を求める。
 * @param {MatrixDefinition} data
 * @param {number} columnWidth X軸1列の幅
 * @returns {LaneLayout[]}
 */
function layoutLanes(data, columnWidth) {
  const columnIndex = new Map(
    data.xAxes.values.map(({ label }, index) => [label, index]),
  );
  const itemsByLane = new Map(data.yAxes.values.map(({ label }) => [label, []]));

  for (const source of data.items) {
    const start = columnIndex.get(source.from);
    const end = columnIndex.get(source.to) + 1;
    itemsByLane.get(source.lane).push(
      new RenderItem(
        source,
        start,
        end,
        MARGIN.left + start * columnWidth,
        (end - start) * columnWidth,
      ),
    );
  }

  let y = MARGIN.top;
  return data.yAxes.values.map(({ label, color }) => {
    const tracks = assignTracks(itemsByLane.get(label));
    const contentHeight =
      tracks.reduce((sum, track) => sum + track.height, 0) +
      Math.max(0, tracks.length - 1) * TRACK_GAP;
    const height = Math.max(LANE_MIN_HEIGHT, contentHeight + LANE_PADDING * 2);
    const layout = { lane: label, color, tracks, y, height };
    y += height;
    return layout;
  });
}

/** @param {number} x @param {number} y @param {string} value @param {string} [attributes] @returns {string} */
function text(x, y, value, attributes = "") {
  return `<text x="${x}" y="${y}" ${attributes}>${escapeXml(value)}</text>`;
}

/** SVG開始タグ、背景、スタイル、タイトル、軸ラベル。 @returns {string[]} */
function renderFrame(data, width, height) {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="100%" height="100%" fill="${COLORS.background}"/>`,
    `<style>text{font-family:Arial,"Noto Sans JP","Yu Gothic",sans-serif;fill:${COLORS.ink}}.axis{font-size:13px}.title{font-size:24px;font-weight:700}.lane-label{font-size:15px;font-weight:700}.bar-label{font-size:${FONT_SIZE}px;font-weight:600}.item-link{cursor:pointer}.item-link text{text-decoration:underline}.item-link:hover rect,.item-link:focus-visible rect{fill:#c4def4;stroke:#145c91;stroke-width:2}</style>`,
    text(MARGIN.left, 42, data.title, 'class="title"'),
    text(MARGIN.left, 78, data.xAxes.label, 'class="axis" font-weight="700"'),
    text(24, MARGIN.top - 14, data.yAxes.label, 'class="axis" font-weight="700"'),
  ];
}

/** X軸の列見出し。 @returns {string[]} */
function renderColumnHeaders(xAxes, columnWidth) {
  return xAxes.values.flatMap(({ label, color }, index) => {
    const x = MARGIN.left + index * columnWidth;
    const palette = itemColors(color, COLORS.laneAlt, COLORS.grid);
    return [
      `<rect x="${x}" y="${MARGIN.top - 32}" width="${columnWidth}" height="32" fill="${palette.fill}"/>`,
      text(
        x + columnWidth / 2,
        MARGIN.top - 11,
        label,
        `class="axis" text-anchor="middle" style="fill:${palette.text}"`,
      ),
    ];
  });
}

/** Y軸のレーン背景、見出し、区切り線。 @param {LaneLayout[]} lanes @returns {string[]} */
function renderLaneBackgrounds(lanes, width) {
  return lanes.flatMap((layout, laneIndex) => {
    const fill = laneIndex % 2 === 0 ? COLORS.lane : COLORS.background;
    const palette = itemColors(layout.color, COLORS.laneAlt, COLORS.grid);
    return [
      `<rect x="0" y="${layout.y}" width="${width}" height="${layout.height}" fill="${fill}"/>`,
      `<rect x="0" y="${layout.y}" width="${MARGIN.left - 12}" height="${layout.height}" fill="${palette.fill}"/>`,
      text(
        18,
        layout.y + layout.height / 2 + 5,
        layout.lane,
        `class="lane-label" style="fill:${palette.text}"`,
      ),
      `<line x1="0" y1="${layout.y + layout.height}" x2="${width}" y2="${layout.y + layout.height}" stroke="${COLORS.grid}"/>`,
    ];
  });
}

/** 列の区切り線。 @returns {string[]} */
function renderGridLines(columnCount, columnWidth, plotHeight) {
  return Array.from({ length: columnCount + 1 }, (_, index) => {
    const x = MARGIN.left + index * columnWidth;
    return `<line x1="${x}" y1="${MARGIN.top}" x2="${x}" y2="${MARGIN.top + plotHeight}" stroke="${COLORS.grid}"/>`;
  });
}

/** 項目1件の帯とラベル。 @param {RenderItem} item @returns {string[]} */
function renderItem(item, trackY, trackHeight) {
  const barHeight = trackHeight - 8;
  const barY = trackY + 4;
  const palette = itemColors(item.source.color);
  const { id, label, url } = item.source;
  const linkStart = url
    ? `<a href="${escapeXml(url)}" target="_blank" rel="noopener noreferrer" tabindex="0" aria-label="${escapeXml(`${label}を開く`)}" class="item-link"><title>${escapeXml(`${label}を開く`)}</title>`
    : "";
  const linkEnd = url ? "</a>" : "";
  const firstBaseline =
    barY + (barHeight - item.lines.length * LINE_HEIGHT) / 2 + 14;

  return [
    `<g data-item-id="${escapeXml(id)}">${linkStart}`,
    `<rect x="${item.x + 4}" y="${barY}" width="${Math.max(1, item.width - 8)}" height="${barHeight}" rx="3" fill="${palette.fill}" stroke="${palette.stroke}"/>`,
    ...item.lines.map((line, lineIndex) =>
      text(
        item.x + item.width / 2,
        firstBaseline + lineIndex * LINE_HEIGHT,
        line,
        `class="bar-label" text-anchor="middle" style="fill:${palette.text}"`,
      ),
    ),
    `${linkEnd}</g>`,
  ];
}

/** 全項目の帯とラベル。 @param {LaneLayout[]} lanes @returns {string[]} */
function renderItems(lanes) {
  return lanes.flatMap((layout) => {
    let trackY = layout.y + LANE_PADDING;
    return layout.tracks.flatMap((track) => {
      const parts = track.items.flatMap((item) =>
        renderItem(item, trackY, track.height),
      );
      trackY += track.height + TRACK_GAP;
      return parts;
    });
  });
}

/**
 * 検証済みの入力データからSVG文字列と出力寸法を生成する。
 *
 * @param {MatrixDefinition} data
 * @returns {{ svg: string, width: number, height: number }}
 */
export function renderSvg(data) {
  const { xAxes } = data;
  const width = data.width;
  const columnWidth =
    (width - MARGIN.left - MARGIN.right) / xAxes.values.length;
  const lanes = layoutLanes(data, columnWidth);
  const plotHeight = lanes.reduce((sum, lane) => sum + lane.height, 0);
  const height = MARGIN.top + plotHeight + MARGIN.bottom;

  const parts = [
    ...renderFrame(data, width, height),
    ...renderColumnHeaders(xAxes, columnWidth),
    ...renderLaneBackgrounds(lanes, width),
    ...renderGridLines(xAxes.values.length, columnWidth, plotHeight),
    ...renderItems(lanes),
    "</svg>",
  ];
  return { svg: parts.join("\n"), width, height };
}
