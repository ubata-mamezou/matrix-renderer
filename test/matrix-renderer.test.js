import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { loadInput } from '../src/input.js';
import { renderPng } from '../src/png.js';
import { renderSvg } from '../src/svg.js';

const testDirectory = dirname(fileURLToPath(import.meta.url));
const projectDirectory = dirname(testDirectory);
const fixturePath = join(testDirectory, 'fixtures', 'all-features.yaml');
const snapshotPath = join(testDirectory, 'fixtures', 'all-features.svg');
const cliPath = join(projectDirectory, 'src', 'cli.js');

test('renders all supported settings to the SVG baseline', async () => {
  const data = await loadInput(fixturePath);
  const result = renderSvg(data);
  const baseline = (await readFile(snapshotPath, 'utf8')).replace(/\r\n/g, '\n').trimEnd();

  assert.equal(result.svg, baseline);
  assert.equal(result.width, 800);
  assert.equal(result.height, 423);
});

test('renders a PNG with the SVG dimensions', async () => {
  const data = await loadInput(fixturePath);
  const { svg, width, height } = renderSvg(data);
  const metadata = await sharp(await renderPng(svg)).metadata();

  assert.equal(metadata.format, 'png');
  assert.equal(metadata.width, width);
  assert.equal(metadata.height, height);
});

test('CLI writes the SVG and PNG to the requested output prefix', async () => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'matrix-renderer-'));
  const outputPrefix = join(temporaryDirectory, 'nested', 'matrix');

  try {
    const result = spawnSync(process.execPath, [cliPath, 'render', fixturePath, '--out', outputPrefix], {
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Generated .*matrix\.svg \(800x423\)/);
    assert.match(result.stdout, /Generated .*matrix\.png \(800x423\)/);

    const [svg, png] = await Promise.all([
      readFile(`${outputPrefix}.svg`, 'utf8'),
      readFile(`${outputPrefix}.png`),
    ]);
    const baseline = (await readFile(snapshotPath, 'utf8')).replace(/\r\n/g, '\n').trimEnd();
    const metadata = await sharp(png).metadata();

    assert.equal(svg, baseline);
    assert.equal(metadata.format, 'png');
    assert.equal(metadata.width, 800);
    assert.equal(metadata.height, 423);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test('CLI --out-type writes only the selected format', async (context) => {
  for (const outputType of ['svg', 'png']) {
    await context.test(outputType, async () => {
      const temporaryDirectory = await mkdtemp(join(tmpdir(), 'matrix-renderer-'));
      const outputPrefix = join(temporaryDirectory, 'selected-format');
      const selectedPath = `${outputPrefix}.${outputType}`;
      const otherType = outputType === 'svg' ? 'png' : 'svg';

      try {
        const result = spawnSync(process.execPath, [
          cliPath,
          'render',
          fixturePath,
          '--out',
          outputPrefix,
          '--out-type',
          outputType,
        ], { encoding: 'utf8' });

        assert.equal(result.status, 0, result.stderr);
        await readFile(selectedPath);
        await assert.rejects(readFile(`${outputPrefix}.${otherType}`), { code: 'ENOENT' });
        assert.match(result.stdout, new RegExp(`Generated .*\\.${outputType} \\(800x423\\)`));
      } finally {
        await rm(temporaryDirectory, { recursive: true, force: true });
      }
    });
  }
});

test('CLI rejects missing or unsupported --out-type values', async (context) => {
  const cases = [
    ['missing output type', [], 'biz.warnOutTypeOption'],
    ['unsupported output type', ['jpeg'], 'biz.warnOutTypeOptionValues'],
  ];

  for (const [name, outputTypeArgs, expectedError] of cases) {
    await context.test(name, async () => {
      const result = spawnSync(process.execPath, [
        cliPath,
        'render',
        fixturePath,
        '--out-type',
        ...outputTypeArgs,
      ], { encoding: 'utf8' });

      assert.equal(result.status, 1);
      assert.match(result.stderr, new RegExp(`\\[${expectedError}\\]`));
    });
  }
});

test('CLI displays help without generating output', () => {
  const result = spawnSync(process.execPath, [cliPath, '--help'], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Usage:/);
});

test('CLI reports invalid YAML input and does not write artifacts', async () => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'matrix-renderer-'));
  const inputPath = join(temporaryDirectory, 'invalid.yaml');
  const outputPrefix = join(temporaryDirectory, 'invalid-output');

  try {
    await writeFile(inputPath, 'xAxis: {}\nyAxis: {}\nitems: []\n');
    const result = spawnSync(process.execPath, [cliPath, 'render', inputPath, '--out', outputPrefix], {
      encoding: 'utf8',
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /\[validation.notEmpty\]/);
    await assert.rejects(readFile(`${outputPrefix}.svg`), { code: 'ENOENT' });
    await assert.rejects(readFile(`${outputPrefix}.png`), { code: 'ENOENT' });
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});