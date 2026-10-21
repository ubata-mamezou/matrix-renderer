import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import { toUrl } from "./adapter/web/url.js";
import { throwErr } from "./errors/error.js";
import { assert, is } from "./validation/validator.js";

class AxisDefinition {
  /**
   * constructor.
   * @param {string} label
   * @param {Array<AxisValue>} values
   */
  constructor(label, values) {
    this.label = label;
    this.values = values;
  }

  static from(messageLabel, source) {
    assert.notEmpty.object(messageLabel, source);
    assert.notEmpty.string(`${messageLabel}.label`, source.label);
    assert.type.array(`${messageLabel}.values`, source.values);

    const avs = source.values.map((value, index) => {
      if (is.type.string(value))  {
      return AxisValue.from(`${messageLabel}.values[${index}]`, value);
      } else {
        return AxisValue.from(`${messageLabel}.values[${index}]`, value.label, value.color);
      }
    });
    assert.array.uniqueBy(`${messageLabel}.values`, avs, "label");

    return new AxisDefinition(source.label, avs);
  }
}

class AxisValue {
  /**
   * constructor
   * @param {string} label
   * @param {string | undefined} color
   */
  constructor(label, color) {
    this.label = label;
    this.color = color;
  }

  static from(messageLabel, label, color = undefined) {
    assert.notEmpty.string(messageLabel, label);
    if (is.type.valid(color))
      assert.format.rgb(`${messageLabel}.color`, color);

    return new AxisValue(label, color);
  }
}

/**
 * @typedef {Object} MatrixItem
 * @property {string} id 項目を識別する一意なID
 * @property {string} label 帯に表示するラベル
 * @property {string} lane 配置するy軸の値
 * @property {string} from 描画区間の開始フェーズ
 * @property {string} to 描画区間の終了フェーズ
 * @property {string | undefined} [color] 帯の背景色
 * @property {string | undefined} [url] 帯に設定するリンク
 */

/**
 * @typedef {Object} MatrixData
 * @property {string} [title] マトリックスのタイトル
 * @property {number | undefined} [width] 出力画像の幅
 * @property {AxisDefinition} xAxis 横軸の定義
 * @property {AxisDefinition} yAxis 縦軸の定義
 * @property {MatrixItem[]} items 描画する項目
 */

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

/**
 * YAMLから読み込んだ値がマトリックスの入力仕様を満たすか検証する。
 * @param {unknown} data
 * @returns {asserts data is MatrixData}
 */
export function validate(data) {
  assert.notEmpty.object("YAML root", data);
  assert.type.array("items", data.items);
  if (is.notEmpty.number(data.width))
    assert.number.inRange("width", data.width, 700, 4000, false);

  const xAxes = axisDefinition("xAxis", data.xAxis);
  const xAxisLabels = xAxes.values.map((value) => value.label);
  const xAxisLabelsSet = new Set(xAxisLabels);

  const yAxes = axisDefinition("yAxis",data.yAxis );
  const yAxisLabels = yAxes.values.map((value) => value.label);
  const yAxisLabelsSet = new Set(yAxisLabels);

  const itemIds = new Set();
  for (const [index, item] of data.items.entries()) {
    const prefix = `items[${index}]`;
    assert.notEmpty.object(prefix, item);
    for (const key of ["id", "label", "lane", "from", "to"]) {
      assert.notEmpty.string(prefix, item[key]);
    }
    if (itemIds.has(item.id))
      throwErr.validate("validation.duplicate", {
        label: `${prefix}.id`,
        value: item.id,
      });
    itemIds.add(item.id);
    if (is.notEmpty.string(item.url)) toUrl(item.url);
    if (is.notEmpty.string(item.color))
      assert.format.rgb(`${prefix}.color`, item.color);
    assert.set.exists(`${prefix}.from`, xAxisLabelsSet, item.from);
    assert.set.exists(`${prefix}.to`, xAxisLabelsSet, item.to);
    assert.set.exists(`${prefix}.lane`, yAxisLabelsSet, item.lane);
    assert.array.order(xAxisLabels, item.from, item.to);
  }
}

/**
 * 軸の値を描画用のオブジェクト形式にそろえ、内容を検証する。
 * @param {AxisDefinition} axis
 * @param {string} axisName
 * @returns {AxisDefinition}
 */
export function axisDefinition(axisName, axis) {
  assert.type.valid(axisName, axis);
  return  AxisDefinition.from(axisName, axis);
}

