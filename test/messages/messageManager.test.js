import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import en from '../../src/messages/en.js';
import ja from '../../src/messages/ja.js';
import {
  DEFAULT_LANG,
  formatMessage,
  getMessageTemplate,
  renderMessage,
  resolveLang,
} from '../../src/messages/messageManager.js';

/** 辞書を `a.b.c` 形式のキーとテンプレートの配列に展開する。 */
const flatten = (dictionary, prefix = '') =>
  Object.entries(dictionary).flatMap(([key, value]) =>
    typeof value === 'string' ? [[`${prefix}${key}`, value]] : flatten(value, `${prefix}${key}.`),
  );

const placeholders = (template) => [...template.matchAll(/\{(\w+)\}/g)].map(([, name]) => name).sort();

describe('message dictionaries', () => {
  const enEntries = new Map(flatten(en));
  const jaEntries = new Map(flatten(ja));

  test('define the same message IDs', () => {
    assert.deepEqual([...jaEntries.keys()].sort(), [...enEntries.keys()].sort());
  });

  for (const [messageId, template] of enEntries) {
    test(`${messageId} uses the same placeholders in both languages`, () => {
      assert.deepEqual(placeholders(jaEntries.get(messageId)), placeholders(template));
    });
  }
});

describe('resolveLang', () => {
  test('keeps supported languages', () => {
    assert.equal(resolveLang('en'), 'en');
    assert.equal(resolveLang('ja'), 'ja');
  });

  for (const lang of ['fr', '', undefined, null, 1, 'constructor', '__proto__']) {
    test(`treats ${JSON.stringify(lang)} as the default language`, () => {
      assert.equal(resolveLang(lang), DEFAULT_LANG);
    });
  }
});

describe('getMessageTemplate', () => {
  test('returns a top-level template', () => {
    assert.equal(getMessageTemplate('general'), '{message}');
  });

  test('returns a nested template in the default language', () => {
    assert.equal(getMessageTemplate('biz.warnOutOption'), 'Please specify an output path after --out.');
    assert.equal(getMessageTemplate('url.badProtocol'), 'Please specify a URL using HTTP(S).');
  });

  test('returns a template in the requested language', () => {
    assert.equal(getMessageTemplate('biz.warnOutOption', 'ja'), '--outの後に出力先を指定してください。');
  });

  test('uses the default language for an unsupported language', () => {
    assert.equal(getMessageTemplate('biz.warnOutOption', 'fr'), getMessageTemplate('biz.warnOutOption', 'en'));
  });

  for (const messageId of ['', undefined, null, 123, {}]) {
    test(`rejects ${JSON.stringify(messageId)} as an invalid ID`, () => {
      assert.throws(() => getMessageTemplate(messageId), /Message ID must be a non-empty string/);
    });
  }

  for (const messageId of ['unknown', 'biz.unknown', 'general.nested', 'constructor', '__proto__', 'biz.constructor']) {
    test(`rejects ${messageId} as a missing ID`, () => {
      assert.throws(() => getMessageTemplate(messageId), /Message ID does not exist/);
    });
  }

  for (const messageId of ['biz', 'validation.type']) {
    test(`rejects ${messageId} because it is not a template`, () => {
      assert.throws(() => getMessageTemplate(messageId), /not associated with any template/);
    });
  }
});

describe('formatMessage', () => {
  const cases = [
    ['replaces a placeholder', '{a}', { a: 'x' }, 'x'],
    ['replaces multiple placeholders', '{a}-{b}', { a: 1, b: 'y' }, '1-y'],
    ['replaces repeated placeholders', '{a}{a}', { a: 'z' }, 'zz'],
    ['keeps text without placeholders', 'plain', {}, 'plain'],
    ['ignores unused params', '{a}', { a: 'x', b: 'y' }, 'x'],
    ['converts values to strings', '{a}/{b}/{c}', { a: null, b: undefined, c: false }, 'null/undefined/false'],
    ['does not expand placeholders inside values', '{a}', { a: '{b}', b: 'x' }, '{b}'],
    ['leaves non-word placeholders as is', '{a-b}', { 'a-b': 'x' }, '{a-b}'],
  ];

  for (const [name, template, params, expected] of cases) {
    test(name, () => {
      assert.equal(formatMessage(template, params), expected);
    });
  }

  test('rejects a missing parameter', () => {
    assert.throws(() => formatMessage('{a}-{b}', { a: 1 }), /Missing message parameter: b/);
  });
});

describe('renderMessage', () => {
  test('renders in the default language', () => {
    assert.equal(renderMessage('validation.notEmpty', { label: 'title', value: '' }), 'title is empty: ');
  });

  test('renders in the requested language', () => {
    assert.equal(renderMessage('validation.notEmpty', { label: 'title', value: '' }, 'ja'), 'title が空です: ');
  });

  test('rejects a missing parameter in any language', () => {
    assert.throws(() => renderMessage('validation.notEmpty', { label: 'title' }, 'ja'), /Missing message parameter: value/);
  });
});
