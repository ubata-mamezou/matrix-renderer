import assert from 'node:assert/strict';

/**
 * 指定した関数が、指定したmessageIdのValidationErrorをスローすることを検証する。
 * @param {() => unknown} fn
 * @param {string} messageId
 */
export function assertValidationError(fn, messageId) {
  assert.throws(fn, (error) => {
    assert.equal(error.name, 'ValidationError');
    assert.equal(error.messageId, messageId);
    return true;
  });
}

/**
 * 指定したPromiseが、指定したmessageIdのValidationErrorでrejectされることを検証する。
 * @param {Promise<unknown>} promise
 * @param {string} messageId
 */
export async function assertRejectsValidationError(promise, messageId) {
  await assert.rejects(promise, (error) => {
    assert.equal(error.name, 'ValidationError');
    assert.equal(error.messageId, messageId);
    return true;
  });
}
