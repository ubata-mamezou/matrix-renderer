import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { detectLang, formatError, main, parseArguments, renderToFiles } from '../src/command.js';
import { BusinessError, ValidationError } from '../src/errors/error.js';
import { renderMessage } from '../src/messages/messageManager.js';

const fixturePath = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'all-features.yaml');
const USAGE_EN = renderMessage('cli.usage', {}, 'en');
const USAGE_JA = renderMessage('cli.usage', {}, 'ja');

/** 標準出力と標準エラー出力を取得するioを作る。 */
const captureIo = () => {
  const stdout = [];
  const stderr = [];
  return {
    io: { stdout: { write: (text) => stdout.push(text) }, stderr: { write: (text) => stderr.push(text) } },
    stdout: () => stdout.join(''),
    stderr: () => stderr.join(''),
  };
};

const assertBusinessError = (fn, messageId) => {
  assert.throws(fn, (error) => {
    assert.ok(error instanceof BusinessError);
    assert.equal(error.messageId, messageId);
    return true;
  });
};

describe('parseArguments', () => {
  describe('help', () => {
    for (const args of [
      [],
      ['--help'],
      ['-h'],
      ['render'],
      ['render', '-h'],
      ['render', '--help'],
      ['render', 'a.yaml', '--help'],
    ]) {
      test(`[${args.join(' ')}]`, () => {
        assert.deepEqual(parseArguments(args), { type: 'help' });
      });
    }
  });

  describe('render', () => {
    const cases = [
      ['input only (output next to the input)', ['render', 'a.yaml'], { input: resolve('a.yaml'), prefix: resolve('a') }],
      ['.yml extension', ['render', 'a.yml'], { input: resolve('a.yml'), prefix: resolve('a') }],
      ['npm style separator', ['render', '--', 'a.yaml'], { input: resolve('a.yaml'), prefix: resolve('a') }],
      [
        '--out',
        ['render', 'a.yaml', '--out', 'out/x'],
        { input: resolve('a.yaml'), prefix: resolve('out/x') },
      ],
      [
        '--out before the input',
        ['render', '--out', 'out/x', 'a.yaml'],
        { input: resolve('a.yaml'), prefix: resolve('out/x') },
      ],
      [
        '--out-type svg',
        ['render', 'a.yaml', '--out-type', 'svg'],
        { input: resolve('a.yaml'), prefix: resolve('a'), outputType: 'svg' },
      ],
      [
        '--out-type png',
        ['render', 'a.yaml', '--out-type', 'png'],
        { input: resolve('a.yaml'), prefix: resolve('a'), outputType: 'png' },
      ],
      ['--lang after the input', ['render', 'a.yaml', '--lang', 'ja'], { input: resolve('a.yaml'), prefix: resolve('a') }],
      ['--lang before the input', ['render', '--lang', 'ja', 'a.yaml'], { input: resolve('a.yaml'), prefix: resolve('a') }],
      ['--lang with an unsupported value', ['render', 'a.yaml', '--lang', 'fr'], { input: resolve('a.yaml'), prefix: resolve('a') }],
      ['--lang without a value', ['render', 'a.yaml', '--lang'], { input: resolve('a.yaml'), prefix: resolve('a') }],
    ];

    for (const [name, args, expected] of cases) {
      test(name, () => {
        assert.deepEqual(parseArguments(args), { type: 'render', outputType: undefined, ...expected });
      });
    }
  });

  describe('errors', () => {
    const cases = [
      ['unknown command', ['--foo'], 'biz.unknownOption'],
      ['unsupported command', ['foo', 'a.yaml'], 'biz.unknownOption'],
      ['unknown option before the input', ['render', '--foo'], 'biz.unknownOption'],
      ['unknown option after the input', ['render', 'a.yaml', '--foo'], 'biz.unknownOption'],
      ['--out without a value', ['render', 'a.yaml', '--out'], 'biz.warnOutOption'],
      ['--out followed by an option', ['render', 'a.yaml', '--out', '--out-type'], 'biz.warnOutOption'],
      ['--out-type without a value', ['render', 'a.yaml', '--out-type'], 'biz.warnOutTypeOption'],
      [
        '--out-type followed by an option',
        ['render', 'a.yaml', '--out-type', '--out', 'x'],
        'biz.warnOutTypeOption',
      ],
      ['unsupported --out-type value', ['render', 'a.yaml', '--out-type', 'jpeg'], 'biz.warnOutTypeOptionValues'],
      ['no input', ['render', '--out', 'x'], 'biz.warnInputOption'],
      ['separator only', ['render', '--'], 'biz.warnInputOption'],
      ['multiple inputs', ['render', 'a.yaml', 'b.yaml'], 'biz.warnInputOption'],
    ];

    for (const [name, args, messageId] of cases) {
      test(`${name} -> ${messageId}`, () => {
        assertBusinessError(() => parseArguments(args), messageId);
      });
    }

    test('unknown option message includes the usage', () => {
      assert.throws(() => parseArguments(['render', '--foo']), (error) => {
        assert.match(error.message, /--foo/);
        assert.ok(error.message.includes(USAGE_EN));
        return true;
      });
    });

    test('the usage in the error params follows --lang', () => {
      assert.throws(() => parseArguments(['render', '--foo', '--lang', 'ja']), (error) => {
        assert.equal(error.params.usage, USAGE_JA);
        return true;
      });
    });
  });
});

describe('detectLang', () => {
  for (const [name, args, expected] of [
    ['no --lang', ['render', 'a.yaml'], 'en'],
    ['en', ['render', 'a.yaml', '--lang', 'en'], 'en'],
    ['ja', ['render', 'a.yaml', '--lang', 'ja'], 'ja'],
    ['ja before the input', ['render', '--lang', 'ja', 'a.yaml'], 'ja'],
    ['unsupported value', ['--lang', 'fr'], 'en'],
    ['prototype key', ['--lang', 'constructor'], 'en'],
    ['without a value', ['render', 'a.yaml', '--lang'], 'en'],
    ['the last one wins', ['--lang', 'ja', '--lang', 'en'], 'en'],
  ]) {
    test(`${name} -> ${expected}`, () => {
      assert.equal(detectLang(args), expected);
    });
  }
});

describe('formatError', () => {
  test('business error is a single line without a stack trace', () => {
    const error = new BusinessError('biz.warnOutOption');

    assert.equal(formatError(error), `[biz.warnOutOption] ${error.message}`);
  });

  test('validation error is a single line without a stack trace', () => {
    const error = new ValidationError('validation.notEmpty', { label: 'title', value: '' });

    assert.equal(formatError(error), '[validation.notEmpty] title is empty: ');
  });

  test('messages follow the language', () => {
    const error = new ValidationError('validation.notEmpty', { label: 'title', value: '' });

    assert.equal(formatError(error, 'ja'), '[validation.notEmpty] title が空です: ');
    assert.equal(formatError(error, 'fr'), '[validation.notEmpty] title is empty: ');
  });

  test('unexpected error includes the stack trace', () => {
    const output = formatError(new Error('boom'));

    assert.match(output, /^Error: boom\n\s+at /);
  });

  for (const value of ['text', null, undefined, 42]) {
    test(`non-Error value ${String(value)} is converted to a string`, () => {
      assert.equal(formatError(value), String(value));
    });
  }
});

describe('renderToFiles / main', () => {
  let directory;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'matrix-renderer-command-'));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  const exists = (path) => stat(path).then(() => true, (error) => (error.code === 'ENOENT' ? false : Promise.reject(error)));

  test('main shows the help and exits with 0', async () => {
    const out = captureIo();

    assert.equal(await main([], out.io), 0);
    assert.equal(out.stdout(), `${USAGE_EN}\n`);
    assert.equal(out.stderr(), '');
  });

  test('main shows the help in Japanese with --lang ja', async () => {
    const out = captureIo();

    assert.equal(await main(['--lang', 'ja'], out.io), 0);
    assert.equal(out.stdout(), `${USAGE_JA}\n`);
  });

  test('main shows the help in English with an unsupported language', async () => {
    const out = captureIo();

    assert.equal(await main(['render', '--lang', 'fr'], out.io), 0);
    assert.equal(out.stdout(), `${USAGE_EN}\n`);
  });

  test('main reports progress and generated files in Japanese with --lang ja', async () => {
    const out = captureIo();
    const prefix = join(directory, 'matrix');

    assert.equal(await main(['render', fixturePath, '--out', prefix, '--out-type', 'svg', '--lang', 'ja'], out.io), 0);
    assert.equal(
      out.stderr(),
      '[1/3] 入力データを読み込みました\n[2/3] SVGを描画しました\n[3/3] SVGファイルを出力しました\n',
    );
    assert.equal(out.stdout(), `出力しました: ${prefix}.svg (800x423)\n`);
  });

  test('main reports errors in Japanese with --lang ja', async () => {
    const out = captureIo();

    assert.equal(await main(['render', fixturePath, '--out', '--lang', 'ja'], out.io), 1);
    assert.equal(out.stderr(), '[biz.warnOutOption] --outの後に出力先を指定してください。\n');
  });

  test('main reports usage errors with the usage in the selected language', async () => {
    const out = captureIo();

    assert.equal(await main(['render', '--foo', '--lang', 'ja'], out.io), 1);
    assert.ok(out.stderr().includes(USAGE_JA));
    assert.ok(!out.stderr().includes(USAGE_EN));
  });

  test('main writes both formats with progress and generated messages', async () => {
    const out = captureIo();
    const prefix = join(directory, 'nested', 'matrix');

    assert.equal(await main(['render', fixturePath, '--out', prefix], out.io), 0);
    assert.equal(
      out.stderr(),
      [
        '[1/5] Input data loaded',
        '[2/5] SVG rendered',
        '[3/5] PNG rendered',
        '[4/5] SVG file written',
        '[5/5] PNG file written',
        '',
      ].join('\n'),
    );
    assert.equal(out.stdout(), `Generated ${prefix}.svg (800x423)\nGenerated ${prefix}.png (800x423)\n`);
    assert.ok((await readFile(`${prefix}.svg`, 'utf8')).startsWith('<svg'));
    assert.ok((await readFile(`${prefix}.png`)).length > 0);
  });

  test('main writes only svg with --out-type svg', async () => {
    const out = captureIo();
    const prefix = join(directory, 'matrix');

    assert.equal(await main(['render', fixturePath, '--out', prefix, '--out-type', 'svg'], out.io), 0);
    assert.equal(
      out.stderr(),
      '[1/3] Input data loaded\n[2/3] SVG rendered\n[3/3] SVG file written\n',
    );
    assert.ok(await exists(`${prefix}.svg`));
    assert.ok(!(await exists(`${prefix}.png`)));
  });

  test('main writes only png with --out-type png', async () => {
    const out = captureIo();
    const prefix = join(directory, 'matrix');

    assert.equal(await main(['render', fixturePath, '--out', prefix, '--out-type', 'png'], out.io), 0);
    assert.equal(
      out.stderr(),
      '[1/3] Input data loaded\n[2/3] PNG rendered\n[3/3] PNG file written\n',
    );
    assert.ok(await exists(`${prefix}.png`));
    assert.ok(!(await exists(`${prefix}.svg`)));
  });

  test('main reports a usage error without a stack trace', async () => {
    const out = captureIo();

    assert.equal(await main(['render', fixturePath, '--foo'], out.io), 1);
    assert.match(out.stderr(), /^\[biz\.unknownOption\]/);
    assert.doesNotMatch(out.stderr(), /\n\s+at /);
    assert.equal(out.stdout(), '');
  });

  for (const [name, target] of [
    ['a missing file', 'missing.yaml'],
    ['a directory', ''],
  ]) {
    test(`main reports ${name} as biz.inputNotFound`, async () => {
      const out = captureIo();

      assert.equal(await main(['render', join(directory, target), '--out', join(directory, 'o')], out.io), 1);
      assert.match(out.stderr(), /^\[biz\.inputNotFound\]/);
    });
  }

  test('main reports a validation error and creates no output', async () => {
    const out = captureIo();
    const input = join(directory, 'invalid.yaml');
    await writeFile(input, 'xAxis: {}\nyAxis: {}\nitems: []\n');
    const outputDirectory = join(directory, 'nested');

    assert.equal(await main(['render', input, '--out', join(outputDirectory, 'x')], out.io), 1);
    assert.match(out.stderr(), /^\[validation\.notEmpty\]/);
    assert.ok(!(await exists(outputDirectory)));
  });

  test('main reports broken YAML with the stack trace', async () => {
    const out = captureIo();
    const input = join(directory, 'broken.yaml');
    await writeFile(input, 'items: [unclosed\n');

    assert.equal(await main(['render', input, '--out', join(directory, 'x')], out.io), 1);
    assert.match(out.stderr(), /YAMLParseError/);
  });

  test('renderToFiles propagates unexpected errors as is', async () => {
    const input = join(directory, 'broken.yaml');
    await writeFile(input, 'items: [unclosed\n');

    await assert.rejects(
      renderToFiles({ type: 'render', input, prefix: join(directory, 'x'), outputType: undefined }),
      { name: 'YAMLParseError' },
    );
  });
});
