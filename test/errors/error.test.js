import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  ApplicationError,
  BusinessError,
  throwErr,
  UnSupportedOperationError,
  ValidationError,
} from '../../src/errors/error.js';

/** @param {() => unknown} fn @returns {Error} */
const catchError = (fn) => {
  try {
    fn();
  } catch (error) {
    return error;
  }
  assert.fail('no error was thrown');
};

describe('throwErr.validate', () => {
  test('throws a ValidationError with formatted message', () => {
    const error = catchError(() => throwErr.validate('validation.notEmpty', { label: 'title', value: '' }));

    assert.ok(error instanceof ValidationError);
    assert.ok(error instanceof BusinessError);
    assert.ok(error instanceof Error);
    assert.equal(error.name, 'ValidationError');
    assert.equal(error.messageId, 'validation.notEmpty');
    assert.deepEqual(error.params, { label: 'title', value: '' });
    assert.equal(error.statusCode, 400);
    assert.equal(error.message, 'title is empty: ');
  });

  test('works without params when the template has no placeholders', () => {
    const error = catchError(() => throwErr.validate('url.badValue'));

    assert.equal(error.messageId, 'url.badValue');
    assert.deepEqual(error.params, {});
  });
});

describe('throwErr.biz', () => {
  test('throws a BusinessError', () => {
    const error = catchError(() => throwErr.biz('biz.warnOutOption'));

    assert.ok(error instanceof BusinessError);
    assert.ok(!(error instanceof ValidationError));
    assert.equal(error.name, 'BusinessError');
    assert.equal(error.statusCode, 400);
    assert.equal(error.messageId, 'biz.warnOutOption');
  });
});

describe('throwErr.app', () => {
  test('throws an ApplicationError', () => {
    const error = catchError(() => throwErr.app('fail.application', { option: 'x' }));

    assert.ok(error instanceof ApplicationError);
    assert.equal(error.name, 'ApplicationError');
    assert.equal(error.statusCode, 500);
    assert.equal(error.message, 'application error: x');
  });
});

describe('throwErr.unSupportOps', () => {
  test('throws an UnSupportedOperationError', () => {
    const error = catchError(() => throwErr.unSupportOps({ option: 'x' }));

    assert.ok(error instanceof UnSupportedOperationError);
    assert.ok(error instanceof ApplicationError);
    assert.equal(error.name, 'UnSupportedOperationError');
    assert.equal(error.messageId, 'fail.unSupportOps');
    assert.equal(error.statusCode, 500);
  });
});

describe('default message IDs', () => {
  test('BusinessError uses biz.default', () => {
    assert.equal(new BusinessError(undefined, { option: 'x' }).messageId, 'biz.default');
  });

  test('ValidationError uses validation.default', () => {
    assert.equal(new ValidationError(undefined, { option: 'x' }).messageId, 'validation.default');
  });
});

describe('invalid message definitions', () => {
  test('an unknown message ID fails with a plain Error', () => {
    assert.throws(() => throwErr.biz('biz.unknown'), (error) => {
      assert.equal(error.name, 'Error');
      assert.match(error.message, /Message ID does not exist/);
      return true;
    });
  });

  test('a missing template parameter fails with a plain Error', () => {
    assert.throws(() => throwErr.biz('biz.unknownOption'), (error) => {
      assert.equal(error.name, 'Error');
      assert.match(error.message, /Missing message parameter/);
      return true;
    });
  });
});
