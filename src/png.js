import sharp from 'sharp';

/**
 * SVG文字列をPNG画像のバッファへ変換する。
 * @param {string} svg
 * @returns {Promise<Buffer>}
 */
export function renderPng(svg) {
  return sharp(Buffer.from(svg)).png().toBuffer();
}