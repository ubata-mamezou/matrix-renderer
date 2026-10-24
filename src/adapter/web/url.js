import { throwErr } from "../../errors/error.js";
import { assert } from "../../validation/validator.js";

export const toUrl = (v) => {
  assert.notEmpty.string("URL", v);
  let parsedUrl;
  try {
    parsedUrl = new URL(v);
  } catch {
    throwErr.validate("url.badValue");
  }
  if (!["http:", "https:"].includes(parsedUrl.protocol))
    throwErr.validate("url.badProtocol");
  return parsedUrl;
};
