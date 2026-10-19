import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import { is, assert } from "./validation/validator.js";
import { toUrl } from "./adapter/web/url.js";
import { throwErr } from "./errors/error.js";

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
  assert.type.valid(axisName, axis);
  assert.notEmpty.string(`${axisName}.label`, axis.label);
  assert.anyMatch(`${axisName}.values`, axis.values, is.notEmpty.string, is.notEmpty.array);
  // if (
    // !axis ||
    // typeof axis.label !== "string" ||
  //   !Array.isArray(axis.values) ||
  //   axis.values.length === 0
  // ) {
  //   throwErr.validate(`${axisName}にはlabelと1件以上のvaluesが必要です。`);
  // }
  const values = axis.values.map((value, index) => {
    if (is.type.string(value)) return { label: value };
    assert.notEmpty.object(`${axisName}.values[${index}]`, value);
    assert.notEmpty.string(`${index}].label`, value.label);
    if (is.type.invalid(value.color))
      assert.format.rgb(`${axisName}.values[${index}].color`, value.color);
    return { label: value.label, color: value.color };
  });
  if (values.some((value) => value.label.length === 0))
    fail(`${axisName}.valuesに空のラベルがあります。`);
  assert.array.uniqueBy(`${axisName}.values`, values, "label");
  return values;
}

/**
 * YAMLから読み込んだ値がマトリックスの入力仕様を満たすか検証する。
 * @param {unknown} data
 * @returns {asserts data is MatrixData}
 */
export function validate(data) {
  assert.notEmpty.object("YAMLのルート", data);
  // if (!data || typeof data !== "object")
  //   fail("YAMLのルートはオブジェクトで指定してください。");
  const phases = axisValues(data.xAxis, "xAxis").map((value) => value.label);
  const lanes = axisValues(data.yAxis, "yAxis").map((value) => value.label);

  assert.type.array("items", data.items);
  if (is.notEmpty.number(data.width))
    assert.number.inRange("width", data.width, 700, 4000, false);

  const phaseSet = new Set(phases);
  const laneSet = new Set(lanes);
  const itemIds = new Set();
  for (const [index, item] of data.items.entries()) {
    const prefix = `items[${index}]`;
    assert.notEmpty.object(prefix, item);
    for (const key of ["id", "label", "lane", "from", "to"]) {
      assert.notEmpty.string(prefix, item[key]);
    }
    if (itemIds.has(item.id))
      fail(`${prefix}.id「${item.id}」が重複しています。`);
    itemIds.add(item.id);
    if (is.notEmpty.string(item.url)) toUrl(item.url);
    if (is.notEmpty.string(item.color))
      assert.format.rgb(`${prefix}.color`, item.color, false);
    if (!laneSet.has(item.lane))
      fail(`${prefix}.lane「${item.lane}」はyAxis.valuesにありません。`);
    if (!phaseSet.has(item.from) || !phaseSet.has(item.to))
      fail(
        `${prefix}.from/toはxAxis.valuesにあるフェーズ名を指定してください。`,
      );
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
  const data = parse(await readFile(inputPath, "utf8"));
  validate(data);
  return data;
}
