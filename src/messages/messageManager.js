// 循環参照を避けるため、ここではerror.jsは参照しない
const messages = {
  fail: {
    application: "application error: {option}",
    unSupportOps: "un supported operation: {option}",
  },
  biz: "business error: {option}",
  validation: {
    default: "validation error: {option}",
    anyMatch: "{label} does not meet the specified check: {value}",
    type: {
      valid: "{label} is invalid: {value}",
      string: "{label} is not string: {value}",
      object: "{label} is not object: {value}",
      array: "{label} is not array: {value}",
    },
    array: {
      uniqueBy: `Duplicate keys in the {label}: {value}`,
    },
    number: {
      inRange: `{label} between {min} and {max}`,
    },
    empty: "{label} is not empty",
    notEmpty: "{label} is empty",
    format: {
      rgb: `{label} is not #RGB or #RRGGBB style: {value}`,
    },
    hasAttribute: "{label} attribute does not exist",
  },
  url: {
    badValue: "The value to be converted is not a URL.",
    badProtocol: "Please specify a URL using HTTP(S).",
  },
};

export function getMessageTemplate(messageId) {
  let current = messages;

  for (const key of messageId.split(".")) {
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
    throw new Error(`Message ID that is not associated with any template has been specified.: ${messageId}`);
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
