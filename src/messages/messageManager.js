// 循環参照を避けるため、ここではerror.jsは参照しない
import en from "./en.js";
import ja from "./ja.js";

export const DEFAULT_LANG = "en";
const dictionaries = { en, ja };

/**
 * 未対応の言語は既定の言語として扱う。
 * @param {unknown} lang
 * @returns {string} 対応している言語
 */
export function resolveLang(lang) {
  return typeof lang === "string" && Object.hasOwn(dictionaries, lang)
    ? lang
    : DEFAULT_LANG;
}

/** @returns {string | object | undefined} 辞書に定義が無い場合はundefined */
function lookup(dictionary, messageId) {
  let current = dictionary;
  for (const key of messageId.split(".")) {
    if (
      current === null ||
      typeof current !== "object" ||
      !Object.hasOwn(current, key)
    ) {
      return undefined;
    }
    current = current[key];
  }
  return current;
}

/**
 * メッセージIDに対応するテンプレートを返す。指定言語に定義が無い場合は既定の言語で返す。
 * @param {string} messageId
 * @param {string} [lang]
 * @returns {string}
 */
export function getMessageTemplate(messageId, lang = DEFAULT_LANG) {
  if (typeof messageId !== "string" || messageId.length === 0) {
    throw new Error("Message ID must be a non-empty string.");
  }

  const template =
    lookup(dictionaries[resolveLang(lang)], messageId) ??
    lookup(dictionaries[DEFAULT_LANG], messageId);

  if (template === undefined) {
    throw new Error(`Message ID does not exist.: ${messageId}`);
  }
  if (typeof template !== "string") {
    throw new Error(
      `Message ID that is not associated with any template has been specified.: ${messageId}`,
    );
  }

  return template;
}

export function formatMessage(template, params) {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    if (!(key in params)) {
      throw new Error(`Missing message parameter: ${key}`);
    }
    return String(params[key]);
  });
}

/**
 * メッセージIDとパラメータから、指定言語のメッセージを組み立てる。
 * @param {string} messageId
 * @param {object} params
 * @param {string} [lang]
 * @returns {string}
 */
export function renderMessage(messageId, params = {}, lang = DEFAULT_LANG) {
  return formatMessage(getMessageTemplate(messageId, lang), params);
}
