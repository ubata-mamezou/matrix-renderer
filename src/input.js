import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';

/**
 * @typedef {Object} AxisValue
 * @property {string} label 表示する値
 * @property {string} [color] 値の背景色
 */

/**
 * @typedef {Object} AxisDefinition
 * @property {string} label 軸の見出し
 * @property {Array<string | AxisValue>} values 表示順に並べた値
 */

/**
 * @typedef {Object} MatrixItem
 * @property {string} id 項目を識別する一意なID
 * @property {string} label 帯に表示するラベル
 * @property {string} lane 配置するy軸の値
 * @property {string} from 描画区間の開始フェーズ
 * @property {string} to 描画区間の終了フェーズ
 * @property {string} [color] 帯の背景色
 * @property {string} [url] 帯に設定するリンク
 */

/**
 * @typedef {Object} MatrixData
 * @property {string} [title] マトリックスのタイトル
 * @property {number} [width] 出力画像の幅
 * @property {AxisDefinition} xAxis 横軸の定義
 * @property {AxisDefinition} yAxis 縦軸の定義
 * @property {MatrixItem[]} items 描画する項目
 */

/** @param {string} message @returns {never} */
function fail(message) {
  throw new Error(message);
}

/**
 * 軸の値を描画用のオブジェクト形式にそろえ、内容を検証する。
 * @param {AxisDefinition} axis
 * @param {string} axisName
 * @returns {AxisValue[]}
 */
export function axisValues(axis, axisName) {
  if (!axis || typeof axis.label !== 'string' || !Array.isArray(axis.values) || axis.values.length === 0) {
    fail(`${axisName}にはlabelと1件以上のvaluesが必要です。`);
  }
  const values = axis.values.map((value, index) => {
    if (typeof value === 'string') return { label: value };
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      fail(`${axisName}.values[${index}]は文字列またはlabel/colorオブジェクトにしてください。`);
    }
    if (typeof value.label !== 'string' || value.label.length === 0) {
      fail(`${axisName}.values[${index}].labelは空でない文字列にしてください。`);
    }
    if (value.color !== undefined && (typeof value.color !== 'string' || !/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.color))) {
      fail(`${axisName}.values[${index}].colorは#RGBまたは#RRGGBB形式で指定してください。`);
    }
    return { label: value.label, color: value.color };
  });
  if (values.some((value) => value.label.length === 0)) fail(`${axisName}.valuesに空のラベルがあります。`);
  if (new Set(values.map((value) => value.label)).size !== values.length) fail(`${axisName}.valuesに重複があります。`);
  return values;
}

/**
 * YAMLから読み込んだ値がマトリックスの入力仕様を満たすか検証する。
 * @param {unknown} data
 * @returns {asserts data is MatrixData}
 */
export function validate(data) {
  if (!data || typeof data !== 'object') fail('YAMLのルートはオブジェクトで指定してください。');
  const phases = axisValues(data.xAxis, 'xAxis').map((value) => value.label);
  const lanes = axisValues(data.yAxis, 'yAxis').map((value) => value.label);
  if (!Array.isArray(data.items)) fail('itemsは配列で指定してください。');
  if (data.width !== undefined && (!Number.isInteger(data.width) || data.width < 700 || data.width > 4000)) {
    fail('widthは700から4000までの整数にしてください。');
  }

  const phaseSet = new Set(phases);
  const laneSet = new Set(lanes);
  const itemIds = new Set();
  for (const [index, item] of data.items.entries()) {
    const prefix = `items[${index}]`;
    if (!item || typeof item !== 'object') fail(`${prefix}はオブジェクトで指定してください。`);
    for (const key of ['id', 'label', 'lane', 'from', 'to']) {
      if (typeof item[key] !== 'string' || item[key].length === 0) fail(`${prefix}.${key}は必須です。`);
    }
    if (itemIds.has(item.id)) fail(`${prefix}.id「${item.id}」が重複しています。`);
    itemIds.add(item.id);
    if (item.url !== undefined) {
      if (typeof item.url !== 'string' || item.url.length === 0) fail(`${prefix}.urlは空でないURL文字列にしてください。`);
      let parsedUrl;
      try {
        parsedUrl = new URL(item.url);
      } catch {
        fail(`${prefix}.urlには絶対URLを指定してください。`);
      }
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) fail(`${prefix}.urlはHTTPまたはHTTPSを指定してください。`);
    }
    if (item.color !== undefined && (typeof item.color !== 'string' || !/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(item.color))) {
      fail(`${prefix}.colorは#RGBまたは#RRGGBB形式で指定してください。`);
    }
    if (!laneSet.has(item.lane)) fail(`${prefix}.lane「${item.lane}」はyAxis.valuesにありません。`);
    if (!phaseSet.has(item.from) || !phaseSet.has(item.to)) fail(`${prefix}.from/toはxAxis.valuesにあるフェーズ名を指定してください。`);
    if (phases.indexOf(item.from) > phases.indexOf(item.to)) {
      fail(`${prefix}.fromはtoより前のフェーズを指定してください。`);
    }
  }
}

/**
 * YAMLファイルを読み込み、検証済みのマトリックスデータを返す。
 * @param {string} inputPath
 * @returns {Promise<MatrixData>}
 */
export async function loadInput(inputPath) {
  const data = parse(await readFile(inputPath, 'utf8'));
  validate(data);
  return data;
}