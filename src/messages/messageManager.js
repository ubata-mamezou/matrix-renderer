// 循環参照を避けるため、ここではerror.jsは参照しない
const messages = {
  general: "{message}",
  fail: {
    application: "application error: {option}",
    unSupportOps: "un supported operation: {option}",
  },
  biz: {
    default: "business error: {option}",
    unknownOption: "不明なオプションです: {arg}\n{usage}",
    warnInputOption: "入力YAMLを1件指定してください。\n{usage}",
    warnOutOption: "--outの後に出力先を指定してください。",
    warnOutTypeOption: "--out-typeの後にファイルタイプを指定してください。",
    warnOutTypeOptionValues: "--out-typeはsvgまたはpngを指定してください。",
  },
  validation: {
    general: "{message}",
    default: "validation error: {option}",
    anyMatch: "{label} does not meet the specified check: {value}",
    type: {
      valid: "{label} is invalid: {value}",
      string: "{label} is not string: {value}",
      object: "{label} is not object: {value}",
      array: "{label} is not array: {value}",
    },
    number: {
      inRange: `{label} between {min} and {max}`,
    },
    array: {
      uniqueBy: `Duplicate keys in the {label}: {value}`,
    },
    empty: "{label} is not empty: {value}",
    notEmpty: "{label} is empty: {value}",
    format: {
      rgb: `{label} is not #RGB or #RRGGBB style: {value}`,
    },
    hasAttribute: "{label} attribute does not exist",
    duplicate: "{label} is duplicated: {value}",
    notInList: "{label} is not in list: {value}",
    order:
      'Please specify a value for "from" that precedes the value for "to": {from}, {to}',
  },
  url: {
    badValue: "The value to be converted is not a URL.",
    badProtocol: "Please specify a URL using HTTP(S).",
  },
};

export function getMessageTemplate(messageId) {
  if (typeof messageId !== "string" || messageId.length === 0) {
    throw new Error("Message ID must be a non-empty string.");
  }

  let current = messages;
  const keys = messageId.includes(".") ? messageId.split(".") : [messageId];

  for (const key of keys) {
    if (
      current === null ||
      typeof current !== "object" ||
      !Object.hasOwn(current, key)
    ) {
      throw new Error(`Message ID does not exist.: ${messageId}`);
    }

    current = current[key];
  }

  if (typeof current !== "string") {
    throw new Error(
      `Message ID that is not associated with any template has been specified.: ${messageId}`,
    );
  }

  return current;
}

export function formatMessage(template, params) {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    if (!(key in params)) {
      throw new Error(`Missing message parameter: ${key}`);
    }
    return String(params[key]);
  });
}
