import { throwErr } from "../errors/error.js";

/**
 * 値の状態をチェックする
 */
export const is = {
  /**
   * 型チェック
   */
  type: {
    /**
     * undefined or null
     * @param {*} v  チェック対象値
     * @returns {boolean} チェック結果（true: チェックOK）
     */
    invalid: (v) => v === undefined || v === null,
    string: (v) => typeof v === "string",
    /**
     * 数値であることをチェックする。
     *
     * @param {*} v  チェック対象値
     * @returns {boolean} チェック結果（true: チェックOK）
     */
    number: (v) => typeof v === "number" && !Number.isNaN(v),
    integer: (v) => !Number.isInteger(v),
    boolean: (v) => typeof v === "boolean",
    object: (v) => v !== null && typeof v === "object" && !Array.isArray(v),
    array: (v) => typeof v === "object" && Array.isArray(v),
    function: (v) => typeof v === "function",
  },
  /**
   * Emptyチェック
   *
   * 文字列の場合は空文字列、配列の場合は空配列をEmptyとみなす。
   * @param {*} v  チェック対象値
   * @returns {boolean} チェック結果（true: チェックOK）
   */
  empty: {
    string: (v) => !is.notEmpty.string(v),
    number: (v) => !is.notEmpty.number(v),
    array: (v) => !is.notEmpty.array(v),
  },
  /**
   * Not Emptyチェック。チェック内容は {@link is.empty} 参照。
   * @param {*} v  チェック対象値
   * @returns {boolean} チェック結果（true: チェックOK）
   */
  notEmpty: {
    string: (v) =>
      !is.type.invalid(v) && is.type.string(v) && v.trim().length > 0,
    number: (v) => !is.type.invalid(v) && is.type.number(v),
    object: (v) => !is.type.invalid(v) && is.type.object(v),
    array: (v) => !is.type.invalid(v) && is.type.array(v) && v.length > 0,
  },
  /**
   * 形式チェック
   */
  format: {
    /**
     * RGBカラーコードの形式か検証する。
     * @param {string} value チェック対象値
     * @returns {boolean} チェック結果（true: チェックOK）
     */
    rgb: (v) =>
      is.type.string(v) && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v),
  },
};

export const assert = {
  type: {
    string: (label, v) => {
      if (!is.type.string(v))
        throwErr.validate(`${label} is not string. (${v})`);
    },
    object: (label, v) => {
      if (!is.type.object(v))
        throwErr.validate(`${label} is not object. (${v})`);
    },
    array: (label, v) => {
      if (!is.type.array(v)) throwErr.validate(`${label} is not array. (${v})`);
    },
  },
  /**
   * 値がEmptyか検証する。チェック内容は {@link is.empty} 参照。
   * @param {*} value
   * @throws {ValidationError} チェック結果がNGの場合、エラーをスロー
   */
  empty: {
    string: (label, v) => {
      if (!is.empty.string(v))
        throwErr.validate(`${label} is not empty. (${v})`);
    },
    array: (label, v) => {
      if (!is.empty.array(v))
        throwErr.validate(`${label} is not empty. (${v})`);
    },
  },
  /**
   * 値がEmptyでないか検証する。チェック内容は {@link is.empty} 参照。
   * @param {*} value  チェック対象値
   * @throws {ValidationError} チェック結果がNGの場合、エラーをスロー
   */
  notEmpty: {
    invalid: (label, v) => {
      if (!is.notEmpty.invalid(v))
        throwErr.validate(`${label} is empty. (${v})`);
    },
    string: (label, v) => {
      if (!is.notEmpty.string(v))
        throwErr.validate(`${label} is empty. (${v})`);
    },
    object: (label, v) => {
      if (!is.notEmpty.object(v))
        throwErr.validate(`${label} is empty. (${v})`);
    },
    array: (label, v) => {
      if (!is.notEmpty.array(v)) throwErr.validate(`${label} is empty. (${v})`);
    },
  },
  format: {

    /**
     * 配列の要素が一意であることを検証する。
     *
     * @param {string} label 項目名
     * @param {Array} vArray 検証対象値
     * @param {string} key キー項目名
     * @throws {ValidationError} チェック結果がNGの場合、エラーをスロー
     */
    uniqueArray: (label, v, key) => {
      if (new Set(v.map((value) => value[key])).size !== v.length)
            throwErr.validate(`${label}に重複があります。`);
    },
    /**
     * RGBカラーコードの形式を検証する。
     * @param {string} label 項目名
     * @param {string} v 検証対象値
     * @throws {ValidationError} チェック結果がNGの場合、エラーをスロー
     */
    rgb: (label, v) => {
      if (!is.format.rgb(v))
        throwErr.validate(`${label} is not #RGB or #RRGGBB style. (${v})`);
    },
  },
};

/**
 * 値が指定された型のいずれかであることを検証する。
 *
 * @param {string} name
 * @param {any} value
 * @param  {...string} types
 */
export function isLotsType(name, value, ...types) {
  if (!types.includes(typeof value)) {
    throwErr.validate(
      `${name}は${types.join("または")}型でなければいけません。`,
    );
  }
}

/**
 * オブジェクトが指定された属性を持っているかを検証する。
 *
 * @param {string} objectName
 * @param {object} value
 * @param {string} attributeName
 * @param {...string} attributeType
 * @throws {Error} 属性が存在しない場合や型が違う場合にエラーをスローする。
 */
export function hasAttribute(
  objectName,
  value,
  attributeName,
  ...attributeType
) {
  if (!Object.hasOwn(value, attributeName)) {
    throwErr.validate(`${objectName}.${attributeName}が存在しません。`);
  }
  isLotsType(
    `${objectName}.${attributeName}`,
    value[attributeName],
    ...attributeType,
  );
}

function range(v, min, max) {
  return is.type.number(v) && min <= v && v <= max;
}
/**
 * 値が指定された範囲内であることを検証する。
 *
 * @param {string} label
 * @param {integer} v
 * @param {integer} min
 * @param {integer} max
 */
export function assertRange(label, v, min, max) {
  if (!range(v, min, max))
    throwErr.validate(`${label} between ${min} and ${max}`);
}
