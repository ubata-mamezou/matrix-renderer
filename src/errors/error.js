export class ApplicationError extends Error {
  constructor(message = 'application error.') {
    super(message);
    this.name = "ApplicationError";
  }
}

export class UnSupportedOperationError extends ApplicationError {
  constructor() {
    super("un supported operation.");
    this.name = "UnSupportedOperationError";
  }
}

export class BusinessError extends Error {
  constructor(message) {
    super(message);
    this.name = "BusinessError";
  }
}

/**
 * Validation error.
 */
export class ValidationError extends BusinessError {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * throw error.
 */
export const throwErr = {
  /** @param {string} message */
  app: (message) => raise(new ApplicationError(message)),
  unSupportOps: () => raise(new UnSupportedOperationError()),
  /** @param {string} message */
  biz: (message) => raise(new BusinessError(message)),
  /** @param {string} message */
  validate: (message) => raise(new ValidationError(message)),
};

const raise = (err) => {
  throw err;
};
