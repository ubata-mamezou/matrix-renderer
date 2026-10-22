import { throwErr } from "../../errors/error.js";
import { assert } from "../../validation/validator.js";

export const toUrl = (v) => {
  assert.notEmpty.string("URL", v);
  try {
    const parsedUrl = new URL(v);
    if (!["http:", "https:"].includes(parsedUrl.protocol))
      throwErr.validate("url.badProtocol");
    return parsedUrl;
  } catch {
    throwErr.validate("url.badValue");
  }
};
