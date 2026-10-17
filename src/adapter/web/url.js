import { throwErr } from "../../errors/error.js";
import { assert, is } from "../../validation/validator.js";

export const message = {
  badValue: "The value to be converted is not a URL.",
  badProtocol: "Please specify a URL using HTTP(S).",
};

export const toUrl = (v) => {
  assert.notEmpty.string('URL', v);
  try {
    const parsedUrl = new URL(v);
    if (!["http:", "https:"].includes(parsedUrl.protocol))
      throwErr.validate(message.badProtocol);
    return parsedUrl;
  } catch {
    throwErr.validate(message.badValue);
  }
};
