import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { assert as check, is } from '../../src/validation/validator.js';
import { assertValidationError } from '../helpers/assertions.js';

/**
 * 判定関数の真偽を表形式で検証する。
 * @param {(value: unknown) => boolean} fn
 * @param {Array<[string, unknown, boolean]>} cases [名前, 入力, 期待値]
 */
const verifyPredicate = (fn, cases) => {
  for (const [name, value, expected] of cases) {
    test(`${name} -> ${expected}`, () => {
      assert.equal(fn(value), expected);
    });
  }
};

describe('is.type', () => {
  describe('valid', () => {
    verifyPredicate(is.type.valid, [
      ['undefined', undefined, false],
      ['null', null, false],
      ['0', 0, true],
      ['empty string', '', true],
      ['false', false, true],
      ['empty array', [], true],
    ]);
  });

  describe('string', () => {
    verifyPredicate(is.type.string, [
      ['string', 'a', true],
      ['empty string', '', true],
      ['number', 1, false],
      ['null', null, false],
    ]);
  });

  describe('number', () => {
    verifyPredicate(is.type.number, [
      ['0', 0, true],
      ['decimal', 1.5, true],
      ['negative', -1, true],
      ['NaN', Number.NaN, false],
      ['numeric string', '1', false],
      ['null', null, false],
    ]);
  });

  describe('integer', () => {
    verifyPredicate(is.type.integer, [
      ['1', 1, true],
      ['1.5', 1.5, false],
      ['numeric string', '1', false],
    ]);
  });

  describe('boolean', () => {
    verifyPredicate(is.type.boolean, [
      ['true', true, true],
      ['false', false, true],
      ['0', 0, false],
      ['string', 'true', false],
    ]);
  });

  describe('object', () => {
    verifyPredicate(is.type.object, [
      ['object', {}, true],
      ['null', null, false],
      ['array', [], false],
      ['string', 'a', false],
    ]);
  });

  describe('array', () => {
    verifyPredicate(is.type.array, [
      ['array', [], true],
      ['object', {}, false],
      ['null', null, false],
      ['string', 'a', false],
    ]);
  });

  describe('function', () => {
    verifyPredicate(is.type.function, [
      ['function', () => {}, true],
      ['object', {}, false],
    ]);
  });
});

describe('is.number.inRange', () => {
  const inRange = ([value, min, max]) => is.number.inRange(value, min, max);

  verifyPredicate(inRange, [
    ['inside', [5, 1, 10], true],
    ['min boundary', [1, 1, 10], true],
    ['max boundary', [10, 1, 10], true],
    ['below min', [0, 1, 10], false],
    ['above max', [11, 1, 10], false],
    ['numeric string', ['5', 1, 10], false],
    ['NaN', [Number.NaN, 1, 10], false],
  ]);
});

describe('is.array.order', () => {
  const order = ([from, to]) => is.array.order(['a', 'b', 'c'], from, to);

  verifyPredicate(order, [
    ['ascending', ['a', 'c'], true],
    ['same', ['b', 'b'], true],
    ['descending', ['c', 'a'], false],
  ]);
});

describe('is.empty / is.notEmpty', () => {
  describe('string', () => {
    const cases = [
      ['empty string', '', true],
      ['blank string', '   ', true],
      ['undefined', undefined, true],
      ['null', null, true],
      ['number', 1, true],
      ['text', 'a', false],
    ];
    verifyPredicate(is.empty.string, cases);
    verifyPredicate(is.notEmpty.string, cases.map(([name, value, empty]) => [name, value, !empty]));
  });

  describe('number', () => {
    const cases = [
      ['0', 0, false],
      ['1', 1, false],
      ['NaN', Number.NaN, true],
      ['numeric string', '1', true],
      ['undefined', undefined, true],
    ];
    verifyPredicate(is.empty.number, cases);
    verifyPredicate(is.notEmpty.number, cases.map(([name, value, empty]) => [name, value, !empty]));
  });

  describe('array', () => {
    const cases = [
      ['empty array', [], true],
      ['array with element', [1], false],
      ['string', 'x', true],
      ['undefined', undefined, true],
      ['null', null, true],
    ];
    verifyPredicate(is.empty.array, cases);
    verifyPredicate(is.notEmpty.array, cases.map(([name, value, empty]) => [name, value, !empty]));
  });

  describe('notEmpty.object', () => {
    verifyPredicate(is.notEmpty.object, [
      ['object', { a: 1 }, true],
      ['empty object', {}, true],
      ['null', null, false],
      ['array', [], false],
      ['string', 'a', false],
    ]);
  });
});

describe('is.format.rgb', () => {
  verifyPredicate(is.format.rgb, [
    ['#abc', '#abc', true],
    ['#ABC', '#ABC', true],
    ['#aabbcc', '#aabbcc', true],
    ['#AABBCC', '#AABBCC', true],
    ['without #', 'abc', false],
    ['2 digits', '#ab', false],
    ['4 digits', '#abcd', false],
    ['5 digits', '#abcde', false],
    ['7 digits', '#abcdefg', false],
    ['non-hex', '#ggg', false],
    ['name', 'red', false],
    ['number', 123, false],
    ['undefined', undefined, false],
  ]);
});

describe('is.anyMatch', () => {
  test('is true when any check matches', () => {
    assert.equal(is.anyMatch('a', is.type.number, is.type.string), true);
  });

  test('is false when no check matches', () => {
    assert.equal(is.anyMatch(null, is.type.number, is.type.string), false);
  });

  test('is false without checks', () => {
    assert.equal(is.anyMatch('a'), false);
  });
});

describe('assert', () => {
  // [名前, 失敗する呼び出し, 期待するmessageId, 成功する呼び出し]
  const cases = [
    [
      'general',
      () => check.general(1, () => false, 'custom'),
      'validation.general',
      () => check.general(1, () => true, 'custom'),
    ],
    [
      'anyMatch',
      () => check.anyMatch('l', 1, is.type.string, is.type.boolean),
      'validation.anyMatch',
      () => check.anyMatch('l', 'a', is.type.string, is.type.boolean),
    ],
    ['type.valid', () => check.type.valid('l', undefined), 'validation.type.valid', () => check.type.valid('l', 0)],
    ['type.string', () => check.type.string('l', 1), 'validation.type.string', () => check.type.string('l', 'a')],
    ['type.object', () => check.type.object('l', []), 'validation.type.object', () => check.type.object('l', {})],
    ['type.array', () => check.type.array('l', {}), 'validation.type.array', () => check.type.array('l', [])],
    [
      'number.inRange',
      () => check.number.inRange('l', 5, 1, 4),
      'validation.number.inRange',
      () => check.number.inRange('l', 4, 1, 4),
    ],
    [
      'array.uniqueBy',
      () => check.array.uniqueBy('l', [{ k: 'a' }, { k: 'a' }], 'k'),
      'validation.array.uniqueBy',
      () => check.array.uniqueBy('l', [{ k: 'a' }, { k: 'b' }], 'k'),
    ],
    [
      'array.order',
      () => check.array.order(['a', 'b'], 'b', 'a'),
      'validation.order',
      () => check.array.order(['a', 'b'], 'a', 'b'),
    ],
    [
      'set.exists',
      () => check.set.exists('l', new Set(['a']), 'b'),
      'validation.notInList',
      () => check.set.exists('l', new Set(['a']), 'a'),
    ],
    ['empty.string', () => check.empty.string('l', 'x'), 'validation.empty', () => check.empty.string('l', '')],
    ['empty.array', () => check.empty.array('l', [1]), 'validation.empty', () => check.empty.array('l', [])],
    [
      'notEmpty.string',
      () => check.notEmpty.string('l', ' '),
      'validation.notEmpty',
      () => check.notEmpty.string('l', 'a'),
    ],
    [
      'notEmpty.object',
      () => check.notEmpty.object('l', null),
      'validation.notEmpty',
      () => check.notEmpty.object('l', {}),
    ],
    [
      'notEmpty.array',
      () => check.notEmpty.array('l', []),
      'validation.notEmpty',
      () => check.notEmpty.array('l', [1]),
    ],
    [
      'format.rgb',
      () => check.format.rgb('l', 'red'),
      'validation.format.rgb',
      () => check.format.rgb('l', '#abc'),
    ],
  ];

  for (const [name, failing, messageId, passing] of cases) {
    test(`${name} throws ${messageId} on failure`, () => {
      assertValidationError(failing, messageId);
    });

    test(`${name} does not throw on success`, () => {
      assert.doesNotThrow(passing);
    });
  }

  test('error params carry the label and value', () => {
    assert.throws(() => check.type.string('field', 1), (error) => {
      assert.deepEqual(error.params, { label: 'field', value: 1 });
      assert.match(error.message, /field/);
      return true;
    });
  });

  test('general error carries the custom message', () => {
    assert.throws(() => check.general(1, () => false, 'custom message'), (error) => {
      assert.equal(error.message, 'custom message');
      return true;
    });
  });
});
