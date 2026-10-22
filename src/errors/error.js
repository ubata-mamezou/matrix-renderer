import {
  formatMessage,
  getMessageTemplate,
} from "../messages/messageManager.js";

class BaseError extends Error {
  constructor(messageId = new.target.messageId, params = {}) {
    super(formatMessage(getMessageTemplate(messageId), params));
    this.name = new.target.name;
    this.messageId = messageId;
    this.params = params;
    this.statusCode = new.target.statusCode;
  }
}

export class ApplicationError extends BaseError {
  static messageId = "fail.application";
  static statusCode = 500;
}

export class UnSupportedOperationError extends ApplicationError {
  static messageId = "fail.unSupportOps";
}

export class BusinessError extends BaseError {
  static messageId = "biz";
  static statusCode = 400;
}

/**
 * Validation error.
 */
export class ValidationError extends BusinessError {
  static messageId = "validation.default";
  constructor(messageId = ValidationError.messageId, params = {}) {
    super(messageId, params);
    this.name = "ValidationError";
  }
}

/**
 * throw error.
 */
export const throwErr = {
  /** @param {string} message */
  app: (params = {}) => raise(new ApplicationError(params)),
  unSupportOps: (params = {}) => raise(new UnSupportedOperationError(params)),
  /** @param {string} message */
  biz: (params = {}) => raise(new BusinessError(params)),
  /** @param {string} message */
  validate: (messageId, params) =>
    raise(new ValidationError(messageId, params)),
};

const raise = (err) => {
  throw err;
};
