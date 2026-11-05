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
const HEADER_ROW_HEIGHT = 32;
const HEADER_BASE_Y = MARGIN.top - HEADER_ROW_HEIGHT;
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
function wrapLabel(label, maxWidth, minimumUnits = 6) {
  const maxUnits = Math.max(
    minimumUnits,
    Math.floor(maxWidth / (FONT_SIZE * 0.95)),
  );
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

/** @param {AxisValue} value @returns {number} */
function axisLeafCount(value) {
  return value.subValues.length > 0
    ? value.subValues.reduce((sum, child) => sum + axisLeafCount(child), 0)
    : 1;
}

/** @param {AxisDefinition} axis @returns {number[]} */
function getLaneLabelColumnWidths(axis) {
  if (axis.maxDepth === 1) return [MARGIN.left - 12];

  const widths = Array(axis.maxDepth).fill(48);
  const visit = (values, depth) => {
    for (const value of values) {
      const units = Array.from(value.label).reduce(
        (sum, character) => sum + characterWidth(character),
        0,
      );
      widths[depth] = Math.max(widths[depth], units * 15 + 24);
      visit(value.subValues, depth + 1);
    }
  };
  visit(axis.values, 0);
  return widths.map(Math.ceil);
}

/** @param {AxisDefinition} axis @param {number} columnWidth @returns {number[]} */
function getColumnHeaderRowHeights(axis, columnWidth) {
  if (axis.maxDepth === 1) return [HEADER_ROW_HEIGHT];

  const heights = Array(axis.maxDepth).fill(HEADER_ROW_HEIGHT);
  const visit = (values, depth) => {
    for (const value of values) {
      const width = axisLeafCount(value) * columnWidth;
      const lines = wrapLabel(value.label, width - 12, 1);
      heights[depth] = Math.max(heights[depth], lines.length * 14 + 8);
      visit(value.subValues, depth + 1);
    }
  };
  visit(axis.values, 0);
  return heights;
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
    return this.items.every(
      (existing) =>
        existing.end <= item.start || item.end <= existing.start,
    );
  }

  /** @param {RenderItem[]} items @returns {boolean} */
  canAcceptAll(items) {
    return (
      items.every((item) => this.canAccept(item)) &&
      items.every((item, index) =>
        items
          .slice(index + 1)
          .every(
            (other) =>
              other.end <= item.start || item.end <= other.start,
          ),
      )
    );
  }

  /** @param {RenderItem} item */
  add(item) {
    if (!this.canAccept(item)) throw new RangeError("Track items overlap.");
    this.items.push(item);
    this.items.sort((left, right) => left.start - right.start);
    this.end = Math.max(this.end, item.end);
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

  const linkedIds = new Set();
  const successorById = new Map();
  for (const item of ordered) {
    if (item.source.beforeItem === undefined) continue;
    linkedIds.add(item.source.id);
    linkedIds.add(item.source.beforeItem);
    successorById.set(item.source.beforeItem, item);
  }

  const chains = ordered
    .filter(
      (item) =>
        linkedIds.has(item.source.id) &&
        item.source.beforeItem === undefined,
    )
    .map((root) => {
      const chain = [];
      let current = root;
      while (current) {
        chain.push(current);
        current = successorById.get(current.source.id);
      }
      return chain;
    })
    .sort((left, right) => left[0].start - right[0].start);

  const assignedIds = new Set();
  for (const chain of chains) {
    const track = tracks.find((candidate) => candidate.canAcceptAll(chain));
    const target = track ?? new Track();
    if (!track) tracks.push(target);
    for (const item of chain) {
      target.add(item);
      assignedIds.add(item.source.id);
    }
  }

  for (const item of ordered) {
    if (assignedIds.has(item.source.id)) continue;
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
function layoutLanes(data, columnWidth, leftMargin, plotTop) {
  const columnIndex = new Map(
    data.xAxes.leafValues.map(({ label }, index) => [label, index]),
  );
  const itemsByLane = new Map(
    data.yAxes.leafValues.map(({ label }) => [label, []]),
  );

  for (const source of data.items) {
    const start = columnIndex.get(source.from);
    const end = columnIndex.get(source.to) + 1;
    itemsByLane.get(source.lane).push(
      new RenderItem(
        source,
        start,
        end,
        leftMargin + start * columnWidth,
        (end - start) * columnWidth,
      ),
    );
  }

  const layouts = data.yAxes.leafValues.map(({ label, color }, laneIndex) => {
    const tracks = assignTracks(itemsByLane.get(label));
    const contentHeight =
      tracks.reduce((sum, track) => sum + track.height, 0) +
      Math.max(0, tracks.length - 1) * TRACK_GAP;
    const height = Math.max(LANE_MIN_HEIGHT, contentHeight + LANE_PADDING * 2);
    return { lane: label, color, tracks, y: 0, height, laneIndex };
  });

  let y = plotTop;
  return layouts.map((layout) => {
    const positioned = { ...layout, y };
    y += layout.height;
    return positioned;
  });
}

/** @param {number} x @param {number} y @param {string} value @param {string} [attributes] @returns {string} */
function text(x, y, value, attributes = "") {
  return `<text x="${x}" y="${y}" ${attributes}>${escapeXml(value)}</text>`;
}

/** SVG開始タグ、背景、スタイル、タイトル、軸ラベル。 @returns {string[]} */
function renderFrame(data, width, height, leftMargin, plotTop) {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="100%" height="100%" fill="${COLORS.background}"/>`,
    `<style>text{font-family:Arial,"Noto Sans JP","Yu Gothic",sans-serif;fill:${COLORS.ink}}.axis{font-size:13px}.title{font-size:24px;font-weight:700}.lane-label{font-size:15px;font-weight:700}.bar-label{font-size:${FONT_SIZE}px;font-weight:600}.item-link{cursor:pointer}.item-link text{text-decoration:underline}.item-link:hover rect,.item-link:focus-visible rect{fill:#c4def4;stroke:#145c91;stroke-width:2}</style>`,
    text(leftMargin, 42, data.title, 'class="title"'),
    text(leftMargin, 78, data.xAxes.label, 'class="axis" font-weight="700"'),
    text(24, plotTop - 14, data.yAxes.label, 'class="axis" font-weight="700"'),
  ];
}

/** X軸の階層見出し。 @returns {string[]} */
function renderColumnHeaders(xAxes, columnWidth, rowHeights, leftMargin, lineColor) {
  if (xAxes.maxDepth === 1) {
    return xAxes.values.flatMap(({ label, color }, index) => {
      const x = leftMargin + index * columnWidth;
      const palette = itemColors(color, COLORS.laneAlt, lineColor);
      return [
        `<rect x="${x}" y="${HEADER_BASE_Y}" width="${columnWidth}" height="${HEADER_ROW_HEIGHT}" fill="${palette.fill}"/>`,
        text(
          x + columnWidth / 2,
          HEADER_BASE_Y + 21,
          label,
          `class="axis" text-anchor="middle" style="fill:${palette.text}"`,
        ),
      ];
    });
  }

  const parts = [];
  let leafIndex = 0;

  const renderValues = (values, depth) => {
    for (const value of values) {
      const hasChildren = value.subValues.length > 0;
      const width = axisLeafCount(value) * columnWidth;
      const x = leftMargin + leafIndex * columnWidth;
      const y =
        HEADER_BASE_Y +
        rowHeights.slice(0, depth).reduce((sum, height) => sum + height, 0);
      const height = hasChildren
        ? rowHeights[depth]
        : rowHeights.slice(depth).reduce((sum, rowHeight) => sum + rowHeight, 0);
      const palette = itemColors(value.color, COLORS.laneAlt, lineColor);
      const lines = wrapLabel(value.label, width - 12, 1);

      parts.push(
        `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${palette.fill}" stroke="${lineColor}"/>`,
        ...lines.map((line, lineIndex) =>
          text(
            x + width / 2,
            y + 14 + lineIndex * 14,
            line,
            `class="axis" text-anchor="middle" style="fill:${palette.text}"`,
          ),
        ),
      );

      if (hasChildren) renderValues(value.subValues, depth + 1);
      else leafIndex += 1;
    }
  };

  renderValues(xAxes.values, 0);
  return parts;
}

/** Y軸のレーン背景、見出し、区切り線。 @param {LaneLayout[]} lanes @returns {string[]} */
function renderLaneBackgrounds(lanes, width, leftMargin, hasNestedAxis, lineColor) {
  return lanes.flatMap((layout) => {
    const fill = layout.laneIndex % 2 === 0 ? COLORS.lane : COLORS.background;
    const palette = itemColors(layout.color, COLORS.laneAlt, lineColor);
    return [
      `<rect x="0" y="${layout.y}" width="${width}" height="${layout.height}" fill="${fill}"/>`,
      ...(!hasNestedAxis
        ? [
            `<rect x="0" y="${layout.y}" width="${leftMargin - 12}" height="${layout.height}" fill="${palette.fill}"/>`,
            text(
              18,
              layout.y + layout.height / 2 + 5,
              layout.lane,
              `class="lane-label" style="fill:${palette.text}"`,
            ),
          ]
        : []),
      `<line x1="${hasNestedAxis ? leftMargin : 0}" y1="${layout.y + layout.height}" x2="${width}" y2="${layout.y + layout.height}" stroke="${lineColor}"/>`,
    ];
  });
}

/** Y軸の階層見出しセル。 @param {LaneLayout[]} lanes @returns {string[]} */
function renderLaneHeaders(yAxes, lanes, columnWidths, lineColor) {
  const parts = [];
  let laneIndex = 0;

  const renderValues = (values, depth) => {
    for (const value of values) {
      const hasChildren = value.subValues.length > 0;
      const count = axisLeafCount(value);
      const firstLane = lanes[laneIndex];
      const lastLane = lanes[laneIndex + count - 1];
      const x = columnWidths
        .slice(0, depth)
        .reduce((sum, width) => sum + width, 0);
      const width = hasChildren
        ? columnWidths[depth]
        : columnWidths.slice(depth).reduce((sum, columnWidth) => sum + columnWidth, 0);
      const height = lastLane.y + lastLane.height - firstLane.y;
      const palette = itemColors(value.color, COLORS.laneAlt, lineColor);
      const lines = wrapLabel(value.label, width - 16, 1);
      const firstBaseline =
        firstLane.y + (height - lines.length * LINE_HEIGHT) / 2 + 15;

      parts.push(
        `<rect x="${x}" y="${firstLane.y}" width="${width}" height="${height}" fill="${palette.fill}" stroke="${lineColor}"/>`,
        ...lines.map((line, lineIndex) =>
          text(
            x + width / 2,
            firstBaseline + lineIndex * LINE_HEIGHT,
            line,
            `class="lane-label" text-anchor="middle" style="fill:${palette.text}"`,
          ),
        ),
      );

      if (hasChildren) renderValues(value.subValues, depth + 1);
      else laneIndex += 1;
    }
  };

  renderValues(yAxes.values, 0);
  return parts;
}

/** 列の区切り線。 @returns {string[]} */
function renderGridLines(columnCount, columnWidth, plotHeight, plotTop, leftMargin, lineColor) {
  return Array.from({ length: columnCount + 1 }, (_, index) => {
    const x = leftMargin + index * columnWidth;
    return `<line x1="${x}" y1="${plotTop}" x2="${x}" y2="${plotTop + plotHeight}" stroke="${lineColor}"/>`;
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
  const { xAxes, yAxes } = data;
  const width = data.width;
  const lineColor = data.lineColor ?? COLORS.grid;
  const laneLabelColumnWidths = getLaneLabelColumnWidths(yAxes);
  const leftMargin = laneLabelColumnWidths.reduce((sum, value) => sum + value, 0) + 12;
  const columnWidth =
    (width - leftMargin - MARGIN.right) / xAxes.leafValues.length;
  const headerRowHeights = getColumnHeaderRowHeights(xAxes, columnWidth);
  const plotTop =
    HEADER_BASE_Y +
    headerRowHeights.reduce((sum, height) => sum + height, 0);
  const lanes = layoutLanes(data, columnWidth, leftMargin, plotTop);
  const plotHeight = lanes.reduce((sum, lane) => sum + lane.height, 0);
  const height = plotTop + plotHeight + MARGIN.bottom;

  const parts = [
    ...renderFrame(data, width, height, leftMargin, plotTop),
    ...renderColumnHeaders(
      xAxes,
      columnWidth,
      headerRowHeights,
      leftMargin,
      lineColor,
    ),
    ...renderLaneBackgrounds(
      lanes,
      width,
      leftMargin,
      yAxes.maxDepth > 1,
      lineColor,
    ),
    ...(yAxes.maxDepth > 1
      ? renderLaneHeaders(yAxes, lanes, laneLabelColumnWidths, lineColor)
      : []),
    ...renderGridLines(
      xAxes.leafValues.length,
      columnWidth,
      plotHeight,
      plotTop,
      leftMargin,
      lineColor,
    ),
    ...renderItems(lanes),
    "</svg>",
  ];
  return { svg: parts.join("\n"), width, height };
}
