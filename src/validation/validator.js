import { throwErr } from "../errors/error.js";

/**
 * 値を判定する述語関数。
 * @callback TypeCheck
 * @param {*} value 判定対象
 * @returns {boolean} 判定結果
 */

/**
 * 値の状態をチェックする
 */
export const is = {
  /**
   * 値が指定されたチェックのいずれかに該当するかチェックする
   * @param {any} value
   * @param {...TypeCheck} checks
   */
  anyMatch: (value, ...checks) => checks.some((check) => check(value)),
  /**
   * 型チェック
   */
  type: {
    /**
     * not undefined or null
     * @param {*} value  チェック対象値
     * @returns {boolean} チェック結果（true: チェックOK）
     */
    valid: (value) => value !== undefined && value !== null,
    invalid: (value) => !is.type.valid(value),
    string: (value) => typeof value === "string",
    /**
     * 数値であることをチェックする。
     *
     * @param {*} value  チェック対象値
     * @returns {boolean} チェック結果（true: チェックOK）
     */
    number: (value) => typeof value === "number" && !Number.isNaN(value),
    integer: (value) => !Number.isInteger(value),
    boolean: (value) => typeof value === "boolean",
    object: (value) =>
      value !== null && typeof value === "object" && !Array.isArray(value),
    array: (value) => typeof value === "object" && Array.isArray(value),
    function: (value) => typeof value === "function",
    /**
     * 値が指定された型のいずれかであることを検証する。
     * @param {any} value
     * @param {...TypeCheck} checks
     */
    lotsType: (value, ...checks) => checks.some((check) => check(value)),
  },
  number: {
    inRange: (value, min, max) =>
      is.type.number(value) && min <= value && value <= max,
  },
  /**
   * Emptyチェック
   *
   * stringの場合は空文字列、arrayの場合は空配列をEmptyとみなす。
   * 指定されたチェックと型が異なる場合もEmptyとみなす。
   * @param {*} value  チェック対象値
   * @returns {boolean} チェック結果（true: チェックOK）
   */
  empty: {
    string: (value) => !is.notEmpty.string(value),
    number: (value) => !is.notEmpty.number(value),
    array: (value) => !is.notEmpty.array(value),
  },
  /**
   * Not Emptyチェック。チェック内容は {@link is.empty} 参照。
   * @param {*} value  チェック対象値
   * @returns {boolean} チェック結果（true: チェックOK）
   */
  notEmpty: {
    string: (value) =>
      is.type.valid(value) && is.type.string(value) && value.trim().length > 0,
    number: (value) => is.type.valid(value) && is.type.number(value),
    object: (value) => is.type.valid(value) && is.type.object(value),
    array: (value) =>
      is.type.valid(value) && is.type.array(value) && value.length > 0,
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
    rgb: (value) =>
      is.type.string(value) &&
      /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value),
  },
};

export const assert = {
  /**
   * 値が指定されたチェックのいずれかに該当するかチェックする
   * @param {string} label チェック対象項目名
   * @param {any} value チェック対象値
   * @param {...TypeCheck} checks チェック関数
   * @throws {ValidationError} チェック結果がNGの場合、エラーをスロー
   */
  anyMatch: (label, value, ...checks) => {
    if (!is.anyMatch(value, ...checks))
      throwErr.validate("validation.anyMatch", { label, value });
  },
  type: {
    valid: (label, value) => {
      if (is.type.invalid(value))
        throwErr.validate("validation.type.valid", { label, value });
    },
    string: (label, value) => {
      if (!is.type.string(value))
        throwErr.validate("validation.type.string", { label, value });
    },
    object: (label, value) => {
      if (!is.type.object(value))
        throwErr.validate("validation.type.object", {
          label,
          value: JSON.stringify(value),
        });
    },
    array: (label, value) => {
      if (!is.type.array(value))
        throwErr.validate("validation.type.array", {
          label,
          value: JSON.stringify(value),
        });
    },
  },
  /**
   * 値がEmptyか検証する。チェック内容は {@link is.empty} 参照。
   * @param {string} label チェック対象項目名
   * @param {*} value
   * @throws {ValidationError} チェック結果がNGの場合、エラーをスロー
   */
  empty: {
    string: (label, value) => {
      if (!is.empty.string(value))
        throwErr.validate("validation.empty", { label });
    },
    array: (label, value) => {
      if (!is.empty.array(value))
        throwErr.validate("validation.empty", { label });
    },
  },
  number: {
    /**
     * 値が指定された範囲内であることを検証する。
     *
     * @param {string} label
     * @param {integer} value
     * @param {integer} min
     * @param {integer} max
     */
    inRange: (label, value, min, max) => {
      if (!is.number.inRange(value, min, max))
        throwErr.validate("validation.number.inRange", { label, min, max });
    },
  },
  array: {
    /**
     * 指定されたキー項目が配列の要素が一意であることを検証する。
     *
     * @param {string} label 項目名
     * @param {Array} value 検証対象値
     * @param {string} key キー項目名
     * @throws {ValidationError} チェック結果がNGの場合、エラーをスロー
     */
    uniqueBy: (label, value, key) => {
      if (new Set(value.map((value) => value[key])).size !== value.length)
        throwErr.validate("validation.array.uniqueBy", { label, value: key });
    },
  },
  /**
   * 値がEmptyでないか検証する。チェック内容は {@link is.empty} 参照。
   * @param {string} label チェック対象項目名
   * @param {*} value  チェック対象値
   * @throws {ValidationError} チェック結果がNGの場合、エラーをスロー
   */
  notEmpty: {
    invalid: (label, value) => {
      if (!is.notEmpty.invalid(value))
        throwErr.validate("validation.notEmpty", { label });
    },
    string: (label, value) => {
      if (!is.notEmpty.string(value))
        throwErr.validate("validation.notEmpty", { label });
    },
    object: (label, value) => {
      if (!is.notEmpty.object(value))
        throwErr.validate("validation.notEmpty", { label });
    },
    array: (label, value) => {
      if (!is.notEmpty.array(value))
        throwErr.validate("validation.notEmpty", { label });
    },
  },
  format: {
    /**
     * RGBカラーコードの形式を検証する。
     * @param {string} label 項目名
     * @param {string} value 検証対象値
     * @throws {ValidationError} チェック結果がNGの場合、エラーをスロー
     */
    rgb: (label, value) => {
      if (!is.format.rgb(value))
        throwErr.validate("validation.format.rgb", { label, value });
    },
  },
};

// /**
//  * オブジェクトが指定された属性を持っているかを検証する。
//  *
//  * @param {string} objectName
//  * @param {object} value
//  * @param {string} attributeName
//  * @param {...string} attributeType
//  * @throws {Error} 属性が存在しない場合や型が違う場合にエラーをスローする。
//  */
// export function hasAttribute(
//   objectName,
//   value,
//   attributeName,
//   ...attributeType
// ) {
//   if (!Object.hasOwn(value, attributeName)) {
//     throwErr.validate("validation.hasAttribute", {
//       label: `${objectName}.${attributeName}`,
//     });
//   }
//   isLotsType(
//     `${objectName}.${attributeName}`,
//     value[attributeName],
//     ...attributeType,
//   );
// }
