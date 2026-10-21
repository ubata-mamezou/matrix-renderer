import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { loadInput, validate } from '../src/input.js';
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
  assert.equal(result.height, 419);
});

test('renders a PNG with the SVG dimensions', async () => {
  const data = await loadInput(fixturePath);
  const { svg, width, height } = renderSvg(data);
  const metadata = await sharp(await renderPng(svg)).metadata();

  assert.equal(metadata.format, 'png');
  assert.equal(metadata.width, width);
  assert.equal(metadata.height, height);
});

test('validation rejects invalid item and width values', async (context) => {
  const cases = [
    ['duplicate item id', (data) => { data.items[1].id = data.items[0].id; }, 'array.uniqueBy'],
    ['unknown lane', (data) => { data.items[0].lane = 'Unknown'; }, 'validation.notInList'],
    ['reversed interval', (data) => { data.items[0].from = 'Review'; data.items[0].to = 'Plan'; }, 'validation.order'],
    ['non-http URL', (data) => { data.items[0].url = 'ftp://example.com'; }, 'url.badProtocol'],
    ['invalid item color', (data) => { data.items[0].color = 'red'; }, 'validation.format.rgb'],
    ['width outside the supported range', (data) => { data.width = 699; }, 'validation.number.inRange'],
  ];

  for (const [name, mutate, expectedError] of cases) {
    await context.test(name, async () => {
      const data = structuredClone(await loadInput(fixturePath));
      mutate(data);
      if (expectedError && typeof expectedError === 'object' && 'messageId' in expectedError) {
        assert.throws(() => validate(data), (error) => {
          assert.equal(error.messageId, { messageId: expectedError.messageId });
          return true;
        });
      } else {
        assert.throws(() => validate(data), expectedError);
      }
    });
  }
});

test('CLI writes the SVG and PNG to the requested output prefix', async () => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'matrix-renderer-'));
  const outputPrefix = join(temporaryDirectory, 'nested', 'matrix');

  try {
    const result = spawnSync(process.execPath, [cliPath, 'render', fixturePath, '--out', outputPrefix], {
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Generated .*matrix\.svg and .*matrix\.png \(800x419\)/);

    const [svg, png] = await Promise.all([
      readFile(`${outputPrefix}.svg`, 'utf8'),
      readFile(`${outputPrefix}.png`),
    ]);
    const baseline = (await readFile(snapshotPath, 'utf8')).replace(/\r\n/g, '\n').trimEnd();
    const metadata = await sharp(png).metadata();

    assert.equal(svg, baseline);
    assert.equal(metadata.format, 'png');
    assert.equal(metadata.width, 800);
    assert.equal(metadata.height, 419);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
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
    assert.match(result.stderr, /Error: xAxis.label is empty/);
    await assert.rejects(readFile(`${outputPrefix}.svg`), { code: 'ENOENT' });
    await assert.rejects(readFile(`${outputPrefix}.png`), { code: 'ENOENT' });
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});