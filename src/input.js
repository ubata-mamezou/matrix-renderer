import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import { toUrl } from "./adapter/web/url.js";
import { throwErr } from "./errors/error.js";
import { assert, is } from "./validation/validator.js";

/**
 * マトリクス定義
 */
export class MatrixDefinition {
  static defaultTitle = "no title";
  static defaultWidth = 1400;
  static minWidth = 700;
  static maxWidth = 4000;

  /**
   * Constructor.
   * @property {AxisDefinition} xAxes X軸の定義
   * @property {AxisDefinition} yAxes Y軸の定義
   * @property {MatrixItem[]} items 描画する項目
   * @property {string | undefined} [title] マトリックスのタイトル
   * @property {number | undefined} [width] 出力画像の幅
   */
  constructor(
    xAxes,
    yAxes,
    items,
    title = MatrixDefinition.defaultTitle,
    width = MatrixDefinition.defaultWidth,
  ) {
    this.title = title;
    this.width = width;
    this.xAxes = xAxes;
    this.yAxes = yAxes;
    this.items = items;
  }

  /**
   * @param {object} source マトリクス定義オブジェクト
   * @returns マトリクス定義
   */
  static from(source) {
    assert.notEmpty.object("YAML root", source);
    assert.notEmpty.string(
      "title",
      source.title ?? MatrixDefinition.defaultTitle,
    );
    assert.type.array("items", source.items);
    if (is.notEmpty.number(source.width))
      assert.number.inRange(
        "width",
        source.width,
        MatrixDefinition.minWidth,
        MatrixDefinition.maxWidth,
        false,
      );

    const xAxes = AxisDefinition.from("xAxis", source.xAxis);
    const yAxes = AxisDefinition.from("yAxis", source.yAxis);
    const items = buildMatrixItemList("items", source.items, xAxes, yAxes);

    return new MatrixDefinition(
      xAxes,
      yAxes,
      items,
      source.title ?? MatrixDefinition.defaultTitle,
      source.width ?? MatrixDefinition.defaultWidth,
    );
  }
}

/**
 * 軸定義
 */
export class AxisDefinition {
  /**
   * constructor.
   * @param {string} label 軸の説明
   * @param {Array<AxisValue>} values 軸リスト
   */
  constructor(label, values) {
    this.label = label;
    this.values = values;
  }

  /**
   * @param {string} messageLabel メッセージ出力用ラベル
   * @param {object} 軸定義オブジェクト
   * @returns 軸定義
   */
  static from(messageLabel, source) {
    assert.type.valid(messageLabel, source);
    assert.notEmpty.object(messageLabel, source);
    assert.notEmpty.string(`${messageLabel}.label`, source.label);
    assert.type.array(`${messageLabel}.values`, source.values);

    const avs = source.values.map((value, index) => {
      if (is.type.string(value)) {
        return AxisValue.from(`${messageLabel}.values[${index}]`, value);
      } else {
        return AxisValue.from(
          `${messageLabel}.values[${index}]`,
          value.label,
          value.color,
        );
      }
    });
    assert.array.uniqueBy(`${messageLabel}.values`, avs, "label");

    return new AxisDefinition(source.label, avs);
  }
}

/**
 * 軸
 */
export class AxisValue {
  /**
   * constructor
   * @param {string} label ラベル
   * @param {string | undefined} color カラー
   */
  constructor(label, color) {
    this.label = label;
    this.color = color;
  }

  /**
   * @param {string} messageLabel メッセージ出力用ラベル
   * @param {string} label 軸の説明
   * @param {string | undefined} color カラー
   * @returns 軸
   */
  static from(messageLabel, label, color = undefined) {
    assert.notEmpty.string(messageLabel, label);
    if (is.type.valid(color)) assert.format.rgb(`${messageLabel}.color`, color);

    return new AxisValue(label, color);
  }
}

/**
 * @param {string} messageLabel メッセージ出力用ラベル
 * @param {object} source アイテムリストオブジェクト
 * @param {AxisDefinition} xAxes X軸
 * @param {AxisDefinition} yAxes Y軸
 * @returns {Array<MatrixItem>} マトリクスアイテムリスト
 */
export const buildMatrixItemList = (messageLabel, source, xAxes, yAxes) => {
  assert.notEmpty.array(messageLabel, source);

  const xAxisLabels = convertMatrixItemListToLabelArray(xAxes.values);
  const xAxisLabelsSet = new Set(xAxisLabels);

  const yAxisLabels = convertMatrixItemListToLabelArray(yAxes.values);
  const yAxisLabelsSet = new Set(yAxisLabels);

  const itemIds = new Set();
  const items = [];
  for (const [index, item] of source.entries()) {
    const miMessageLabel = `items[${index}]`;
    assert.notEmpty.object(miMessageLabel, item);
    const mi = MatrixItem.from(miMessageLabel, item);
    if (itemIds.has(mi.id))
      throwErr.validate("validation.duplicate", {
        label: `${messageLabel}.id`,
        value: item.id,
      });
    itemIds.add(item.id);
    assert.set.exists(`${messageLabel}.lane`, yAxisLabelsSet, item.lane);
    assert.set.exists(`${messageLabel}.from`, xAxisLabelsSet, item.from);
    assert.set.exists(`${messageLabel}.to`, xAxisLabelsSet, item.to);
    assert.array.order(xAxisLabels, item.from, item.to);
    items.push(mi);
  }
  return items;
};

/**
 * @param {Array<MatrixItem>} source
 * @returns {Array<string>} labelを抽出した配列
 */
const convertMatrixItemListToLabelArray = (source) =>
  source.map((v) => v.label);

/**
 * マトリクスアイテム
 */
export class MatrixItem {
  /**
   * constructor.
   * @property {string} id アイテムID
   * @property {string} label ラベル
   * @property {string} lane 配置するy軸の値
   * @property {string} from 描画区間の開始フェーズ
   * @property {string} to 描画区間の終了フェーズ
   * @property {string | undefined} [color] カラー
   * @property {string | undefined} [url] リンク
   */
  constructor(id, label, lane, from, to, color = undefined, url = undefined) {
    this.id = id;
    this.label = label;
    this.lane = lane;
    this.from = from;
    this.to = to;
    this.color = color;
    this.url = url;
  }

  /**
   * @param {string} messageLabel メッセージ出力用ラベル
   * @param {object} source マトリクスアイテムオブジェクト
   * @returns マトリクスアイテム
   */
  static from(messageLabel, source) {
    assert.type.object(messageLabel, source);
    for (const key of ["id", "label", "lane", "from", "to"]) {
      assert.notEmpty.string(messageLabel, source[key]);
    }
    if (is.notEmpty.string(source.url)) toUrl(source.url);
    if (is.notEmpty.string(source.color))
      assert.format.rgb(`${messageLabel}.color`, source.color);

    return new MatrixItem(
      source.id,
      source.label,
      source.lane,
      source.from,
      source.to,
      source.color,
      source.url,
    );
  }
}

/**
 * YAMLファイルを読み込み、検証済みのマトリックスデータを返す。
 * @param {string} inputPath
 * @returns {Promise<MatrixDefinition>}
 */
export async function loadInput(inputPath) {
  const data = parse(await readFile(inputPath, "utf8"));
  return MatrixDefinition.from(data);
}
