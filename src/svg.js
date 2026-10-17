import { axisValues } from './input.js';

/** @typedef {import('./input.js').MatrixData} MatrixData */
/** @typedef {import('./input.js').MatrixItem} MatrixItem */

/**
 * @typedef {Object} RenderItem
 * @property {MatrixItem} source YAML由来の項目
 * @property {number} start 描画区間の開始位置
 * @property {number} end 描画区間の終了位置
 * @property {number} x 描画位置
 * @property {number} width 描画幅
 * @property {string[]} [lines] 折り返し後のラベル
 */

/**
 * @typedef {Object} Track
 * @property {number} end トラック内で最後に配置した項目の終了位置
 * @property {RenderItem[]} items トラック内の項目
 * @property {number} [height] トラックの高さ
 */

const FONT_SIZE = 14;
const TRACK_GAP = 8;
const LANE_PADDING = 12;
const MARGIN = { top: 112, right: 36, bottom: 44, left: 190 };
const COLORS = {
  ink: '#172c46',
  muted: '#536579',
  grid: '#d7e0e8',
  lane: '#f4f7fa',
  laneAlt: '#ebf1f6',
  bar: '#d9eafa',
  barStroke: '#2872aa',
  background: '#ffffff',
};

/** SVG属性やテキストに埋め込む値をXMLエスケープする。 @param {string} value @returns {string} */
function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  })[character]);
}

/**
 * 背景色から帯の塗り、枠線、コントラストを考慮した文字色を決める。
 * @param {string | undefined} color
 * @param {string} [defaultFill]
 * @param {string} [defaultStroke]
 * @returns {{ fill: string, stroke: string, text: string }}
 */
function itemColors(color, defaultFill = COLORS.bar, defaultStroke = COLORS.barStroke) {
  if (!color) return { fill: defaultFill, stroke: defaultStroke, text: COLORS.ink };
  const shortHex = color.length === 4;
  const hex = shortHex ? [...color.slice(1)].map((digit) => digit + digit).join('') : color.slice(1);
  const channels = hex.match(/.{2}/g).map((channel) => Number.parseInt(channel, 16));
  const luminance = (rgb) => rgb.map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
  const backgroundLuminance = luminance(channels);
  const contrast = (foregroundLuminance) => {
    const lighter = Math.max(foregroundLuminance, backgroundLuminance);
    const darker = Math.min(foregroundLuminance, backgroundLuminance);
    return (lighter + 0.05) / (darker + 0.05);
  };
  const stroke = channels.map((channel) => Math.round(channel * 0.72).toString(16).padStart(2, '0')).join('');
  const fill = `#${hex.toLowerCase()}`;
  const text = contrast(1) > contrast(luminance([23, 44, 70])) ? '#ffffff' : COLORS.ink;
  return { fill, stroke: `#${stroke}`, text };
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
  let line = '';
  let units = 0;
  for (const character of Array.from(label)) {
    const width = characterWidth(character);
    if (line && units + width > maxUnits) {
      lines.push(line);
      line = '';
      units = 0;
    }
    line += character;
    units += width;
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * 同一レーン内で期間が重ならないよう項目をトラックに割り当てる。
 * @param {RenderItem[]} items 配置する項目。ラベル行もここで設定する。
 * @returns {Track[]}
 */
function assignTracks(items) {
  const tracks = [];
  const ordered = [...items].sort((left, right) => left.start - right.start || left.end - right.end);
  for (const item of ordered) {
    let trackIndex = tracks.findIndex((track) => track.end <= item.start);
    if (trackIndex === -1) {
      trackIndex = tracks.length;
      tracks.push({ end: -1, items: [] });
    }
    const track = tracks[trackIndex];
    track.end = item.end;
    item.lines = wrapLabel(item.source.label, item.width - 20);
    track.items.push(item);
  }
  for (const track of tracks) {
    track.height = Math.max(42, ...track.items.map((item) => item.lines.length * 17 + 14));
  }
  return tracks;
}

/** @param {number} x @param {number} y @param {string} value @param {string} [attributes] @returns {string} */
function text(x, y, value, attributes = '') {
  return `<text x="${x}" y="${y}" ${attributes}>${escapeXml(value)}</text>`;
}

/**
 * 検証済みの入力データからSVG文字列と出力寸法を生成する。
 * 
 * @param {MatrixData} data
 * @returns {{ svg: string, width: number, height: number }}
 */
export function renderSvg(data) {
  const phases = axisValues(data.xAxis, 'xAxis');
  const lanes = axisValues(data.yAxis, 'yAxis');
  const width = data.width ?? 1440;
  const plotWidth = width - MARGIN.left - MARGIN.right;
  const columnWidth = plotWidth / phases.length;
  const laneItems = new Map(lanes.map(({ label }) => [label, []]));

  for (const source of data.items) {
    const start = phases.findIndex((phase) => phase.label === source.from);
    const end = phases.findIndex((phase) => phase.label === source.to) + 1;
    laneItems.get(source.lane).push({
      source,
      start,
      end,
      x: MARGIN.left + start * columnWidth,
      width: (end - start) * columnWidth,
    });
  }

  const laneLayouts = lanes.map(({ label, color }) => {
    const lane = label;
    const tracks = assignTracks(laneItems.get(lane));
    const contentHeight = tracks.reduce((sum, track) => sum + track.height, 0)
      + Math.max(0, tracks.length - 1) * TRACK_GAP;
    return { lane, color, tracks, height: Math.max(58, contentHeight + LANE_PADDING * 2) };
  });

  const plotTop = MARGIN.top;
  const plotHeight = laneLayouts.reduce((sum, lane) => sum + lane.height, 0);
  const height = plotTop + plotHeight + MARGIN.bottom;
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="100%" height="100%" fill="${COLORS.background}"/>`,
    `<style>text{font-family:Arial,"Noto Sans JP","Yu Gothic",sans-serif;fill:${COLORS.ink}}.axis{font-size:13px}.title{font-size:24px;font-weight:700}.lane-label{font-size:15px;font-weight:700}.bar-label{font-size:${FONT_SIZE}px;font-weight:600}.item-link{cursor:pointer}.item-link text{text-decoration:underline}.item-link:hover rect,.item-link:focus-visible rect{fill:#c4def4;stroke:#145c91;stroke-width:2}</style>`,
  ];

  parts.push(text(MARGIN.left, 42, data.title ?? 'no title', 'class="title"'));
  parts.push(text(MARGIN.left, 78, data.xAxis.label, 'class="axis" font-weight="700"'));
  parts.push(text(24, plotTop - 14, data.yAxis.label, 'class="axis" font-weight="700"'));

  for (let index = 0; index < phases.length; index += 1) {
    const x = MARGIN.left + index * columnWidth;
    const palette = itemColors(phases[index].color, COLORS.laneAlt, COLORS.grid);
    parts.push(`<rect x="${x}" y="${plotTop - 32}" width="${columnWidth}" height="32" fill="${palette.fill}"/>`);
    parts.push(text(x + columnWidth / 2, plotTop - 11, phases[index].label, `class="axis" text-anchor="middle" style="fill:${palette.text}"`));
  }

  let laneY = plotTop;
  laneLayouts.forEach((layout, laneIndex) => {
    const fill = laneIndex % 2 === 0 ? COLORS.lane : COLORS.background;
    const palette = itemColors(layout.color, COLORS.laneAlt, COLORS.grid);
    parts.push(`<rect x="0" y="${laneY}" width="${width}" height="${layout.height}" fill="${fill}"/>`);
    parts.push(`<rect x="0" y="${laneY}" width="${MARGIN.left - 12}" height="${layout.height}" fill="${palette.fill}"/>`);
    parts.push(text(18, laneY + layout.height / 2 + 5, layout.lane, `class="lane-label" style="fill:${palette.text}"`));
    parts.push(`<line x1="0" y1="${laneY + layout.height}" x2="${width}" y2="${laneY + layout.height}" stroke="${COLORS.grid}"/>`);
    layout.y = laneY;
    laneY += layout.height;
  });

  for (let index = 0; index <= phases.length; index += 1) {
    const x = MARGIN.left + index * columnWidth;
    parts.push(`<line x1="${x}" y1="${plotTop}" x2="${x}" y2="${plotTop + plotHeight}" stroke="${COLORS.grid}"/>`);
  }

  laneLayouts.forEach((layout) => {
    let trackY = layout.y + LANE_PADDING;
    for (const track of layout.tracks) {
      for (const item of track.items) {
        const barHeight = track.height - 8;
        const barY = trackY + 4;
        const palette = itemColors(item.source.color);
        const linkStart = item.source.url
          ? `<a href="${escapeXml(item.source.url)}" target="_blank" rel="noopener noreferrer" tabindex="0" aria-label="${escapeXml(`${item.source.label}を開く`)}" class="item-link"><title>${escapeXml(`${item.source.label}を開く`)}</title>`
          : '';
        const linkEnd = item.source.url ? '</a>' : '';
        parts.push(`<g data-item-id="${escapeXml(item.source.id)}">${linkStart}`);
        parts.push(`<rect x="${item.x + 4}" y="${barY}" width="${Math.max(1, item.width - 8)}" height="${barHeight}" rx="3" fill="${palette.fill}" stroke="${palette.stroke}"/>`);
        const firstBaseline = barY + (barHeight - item.lines.length * 17) / 2 + 14;
        item.lines.forEach((line, lineIndex) => {
          parts.push(text(item.x + item.width / 2, firstBaseline + lineIndex * 17, line, `class="bar-label" text-anchor="middle" style="fill:${palette.text}"`));
        });
        parts.push(`${linkEnd}</g>`);
      }
      trackY += track.height + TRACK_GAP;
    }
  });

  parts.push('</svg>');
  return { svg: parts.join('\n'), width, height };
}