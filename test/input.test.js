import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  AxisDefinition,
  AxisValue,
  buildMatrixItemList,
  loadInput,
  MatrixDefinition,
  MatrixItem,
} from '../src/input.js';
import { assertRejectsValidationError, assertValidationError } from './helpers/assertions.js';

const fixturePath = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'all-features.yaml');

const validSource = () => ({
  title: 'sample',
  width: 800,
  xAxis: { label: 'Phase', values: ['Plan', { label: 'Doing', color: '#abc' }, 'Done'] },
  yAxis: { label: 'Category', values: ['Ops', 'Data'] },
  items: [
    { id: 'a', label: 'Item A', lane: 'Ops', from: 'Plan', to: 'Doing' },
    {
      id: 'b',
      label: 'Item B',
      lane: 'Data',
      from: 'Doing',
      to: 'Done',
      url: 'https://example.com',
      color: '#245080',
    },
  ],
});

const validItem = (overrides = {}) => ({
  id: 'a',
  label: 'A',
  lane: 'Ops',
  from: 'Plan',
  to: 'Doing',
  ...overrides,
});

const xAxes = () => AxisDefinition.from('xAxis', { label: 'Phase', values: ['Plan', 'Doing', 'Done'] });
const yAxes = () => AxisDefinition.from('yAxis', { label: 'Category', values: ['Ops', 'Data'] });

describe('MatrixDefinition.from', () => {
  test('builds a definition from a valid source', () => {
    const definition = MatrixDefinition.from(validSource());

    assert.ok(definition instanceof MatrixDefinition);
    assert.equal(definition.title, 'sample');
    assert.equal(definition.width, 800);
    assert.equal(definition.xAxes.label, 'Phase');
    assert.deepEqual(
      definition.xAxes.values.map(({ label, color }) => [label, color]),
      [['Plan', undefined], ['Doing', '#abc'], ['Done', undefined]],
    );
    assert.deepEqual(definition.yAxes.values.map(({ label }) => label), ['Ops', 'Data']);
    assert.deepEqual(definition.items.map(({ id }) => id), ['a', 'b']);
    assert.equal(definition.items[1].url, 'https://example.com');
  });

  test('uses defaults when title and width are omitted', () => {
    const source = validSource();
    delete source.title;
    delete source.width;
    const definition = MatrixDefinition.from(source);

    assert.equal(definition.title, MatrixDefinition.defaultTitle);
    assert.equal(definition.width, MatrixDefinition.defaultWidth);
  });

  test('uses defaults when title and width are null', () => {
    const definition = MatrixDefinition.from({ ...validSource(), title: null, width: null });

    assert.equal(definition.title, MatrixDefinition.defaultTitle);
    assert.equal(definition.width, MatrixDefinition.defaultWidth);
  });

  describe('width', () => {
    for (const width of [MatrixDefinition.minWidth, MatrixDefinition.maxWidth]) {
      test(`accepts ${width}`, () => {
        assert.equal(MatrixDefinition.from({ ...validSource(), width }).width, width);
      });
    }

    for (const width of [699, 4001, 0, -1, 'abc', '800', true, Number.NaN]) {
      test(`rejects ${String(width)} (${typeof width})`, () => {
        assertValidationError(
          () => MatrixDefinition.from({ ...validSource(), width }),
          'validation.number.inRange',
        );
      });
    }
  });

  describe('root', () => {
    for (const [name, source] of [
      ['undefined', undefined],
      ['null', null],
      ['string', 'text'],
      ['number', 42],
      ['array', []],
    ]) {
      test(`rejects ${name}`, () => {
        assertValidationError(() => MatrixDefinition.from(source), 'validation.notEmpty');
      });
    }
  });

  describe('title', () => {
    for (const [name, title] of [
      ['empty string', ''],
      ['blank string', '   '],
      ['number', 123],
      ['boolean', false],
    ]) {
      test(`rejects ${name}`, () => {
        assertValidationError(
          () => MatrixDefinition.from({ ...validSource(), title }),
          'validation.notEmpty',
        );
      });
    }
  });

  describe('items', () => {
    for (const [name, items] of [
      ['missing', undefined],
      ['string', 'text'],
      ['object', {}],
    ]) {
      test(`rejects ${name} (not an array)`, () => {
        assertValidationError(
          () => MatrixDefinition.from({ ...validSource(), items }),
          'validation.type.array',
        );
      });
    }

    test('rejects an empty array', () => {
      assertValidationError(
        () => MatrixDefinition.from({ ...validSource(), items: [] }),
        'validation.notEmpty',
      );
    });
  });

  describe('axes', () => {
    test('rejects a missing xAxis', () => {
      const source = validSource();
      delete source.xAxis;
      assertValidationError(() => MatrixDefinition.from(source), 'validation.type.valid');
    });

    test('rejects a missing yAxis', () => {
      const source = validSource();
      delete source.yAxis;
      assertValidationError(() => MatrixDefinition.from(source), 'validation.type.valid');
    });
  });
});

describe('AxisDefinition.from', () => {
  test('builds an axis from strings and objects', () => {
    const axis = AxisDefinition.from('xAxis', {
      label: 'Phase',
      values: ['Plan', { label: 'Doing', color: '#abc' }],
    });

    assert.equal(axis.label, 'Phase');
    assert.ok(axis.values.every((value) => value instanceof AxisValue));
    assert.deepEqual(
      axis.values.map(({ label, color }) => [label, color]),
      [['Plan', undefined], ['Doing', '#abc']],
    );
  });

  const cases = [
    ['undefined', undefined, 'validation.type.valid'],
    ['null', null, 'validation.type.valid'],
    ['string', 'text', 'validation.notEmpty'],
    ['array', [], 'validation.notEmpty'],
    ['missing label', { values: ['a'] }, 'validation.notEmpty'],
    ['empty label', { label: '', values: ['a'] }, 'validation.notEmpty'],
    ['missing values', { label: 'x' }, 'validation.notEmpty'],
    ['values is a string', { label: 'x', values: 'a' }, 'validation.notEmpty'],
    ['empty value string', { label: 'x', values: [''] }, 'validation.notEmpty'],
    ['value object without label', { label: 'x', values: [{ color: '#abc' }] }, 'validation.notEmpty'],
    ['numeric value', { label: 'x', values: [1] }, 'validation.type.object'],
    ['invalid color', { label: 'x', values: [{ label: 'a', color: 'red' }] }, 'validation.format.rgb'],
    ['duplicate labels (string)', { label: 'x', values: ['a', 'a'] }, 'validation.array.uniqueBy'],
    ['duplicate labels (mixed)', { label: 'x', values: ['a', { label: 'a' }] }, 'validation.array.uniqueBy'],
  ];

  for (const [name, source, messageId] of cases) {
    test(`rejects ${name}`, () => {
      assertValidationError(() => AxisDefinition.from('xAxis', source), messageId);
    });
  }

  test('reports the position of the invalid value in the message label', () => {
    assert.throws(
      () => AxisDefinition.from('xAxis', { label: 'x', values: ['a', { label: 'b', color: 'red' }] }),
      (error) => {
        assert.equal(error.params.label, 'xAxis.values[1].color');
        return true;
      },
    );
  });

  test('rejects a null value', () => {
    assertValidationError(
      () => AxisDefinition.from('xAxis', { label: 'x', values: [null] }),
      'validation.type.object',
    );
  });
});

describe('AxisValue.from', () => {
  test('keeps the label and color', () => {
    const value = AxisValue.from('label', 'Plan', '#abc');

    assert.equal(value.label, 'Plan');
    assert.equal(value.color, '#abc');
  });

  test('allows an omitted or null color', () => {
    assert.equal(AxisValue.from('label', 'Plan').color, undefined);
    assert.equal(AxisValue.from('label', 'Plan', null).color, null);
  });

  for (const color of ['red', '#12', '#1234', '#12345', '#ggg', '123456']) {
    test(`rejects color ${color}`, () => {
      assertValidationError(() => AxisValue.from('label', 'Plan', color), 'validation.format.rgb');
    });
  }

  for (const label of ['', '  ', undefined, 1]) {
    test(`rejects label ${JSON.stringify(label)}`, () => {
      assertValidationError(() => AxisValue.from('label', label), 'validation.notEmpty');
    });
  }
});

describe('MatrixItem.from', () => {
  test('builds an item with required fields only', () => {
    const item = MatrixItem.from('items[0]', validItem());

    assert.ok(item instanceof MatrixItem);
    assert.deepEqual(
      [item.id, item.label, item.lane, item.from, item.to, item.color, item.url],
      ['a', 'A', 'Ops', 'Plan', 'Doing', undefined, undefined],
    );
  });

  test('keeps url and color', () => {
    const item = MatrixItem.from('items[0]', validItem({ url: 'http://example.com', color: '#AABBCC' }));

    assert.equal(item.url, 'http://example.com');
    assert.equal(item.color, '#AABBCC');
  });

  test('keeps the before-item reference', () => {
    const item = MatrixItem.from('items[0]', validItem({ 'before-item': 'previous' }));

    assert.equal(item.beforeItem, 'previous');
  });

  for (const [name, source] of [
    ['null', null],
    ['string', 'text'],
    ['array', []],
  ]) {
    test(`rejects ${name} as the item`, () => {
      assertValidationError(() => MatrixItem.from('items[0]', source), 'validation.type.object');
    });
  }

  for (const key of ['id', 'label', 'lane', 'from', 'to']) {
    for (const [name, value] of [
      ['missing', undefined],
      ['empty', ''],
      ['blank', '  '],
      ['number', 123],
    ]) {
      test(`rejects ${name} ${key}`, () => {
        assertValidationError(
          () => MatrixItem.from('items[0]', validItem({ [key]: value })),
          'validation.notEmpty',
        );
      });
    }
  }

  for (const [name, url, messageId] of [
    ['not a URL', 'not a url', 'url.badValue'],
    ['ftp', 'ftp://example.com', 'url.badProtocol'],
    ['javascript', 'javascript:alert(1)', 'url.badProtocol'],
  ]) {
    test(`rejects url (${name})`, () => {
      assertValidationError(() => MatrixItem.from('items[0]', validItem({ url })), messageId);
    });
  }

  for (const color of ['red', '#12', '#1234', '#ggg', '123456']) {
    test(`rejects color ${color}`, () => {
      assertValidationError(
        () => MatrixItem.from('items[0]', validItem({ color })),
        'validation.format.rgb',
      );
    });
  }

  test('rejects a non-string url', () => {
    assertValidationError(() => MatrixItem.from('items[0]', validItem({ url: 123 })), 'validation.type.invalid');
  });

  test('rejects a non-string color', () => {
    assertValidationError(() => MatrixItem.from('items[0]', validItem({ color: 123 })), 'validation.type.invalid');
  });
});

describe('buildMatrixItemList', () => {
  test('returns items in the given order', () => {
    const items = buildMatrixItemList(
      'items',
      [validItem({ id: 'a' }), validItem({ id: 'b', lane: 'Data', from: 'Doing', to: 'Done' })],
      xAxes(),
      yAxes(),
    );

    assert.ok(items.every((item) => item instanceof MatrixItem));
    assert.deepEqual(items.map(({ id }) => id), ['a', 'b']);
  });

  test('accepts an item whose from and to are the same', () => {
    const items = buildMatrixItemList('items', [validItem({ from: 'Doing', to: 'Doing' })], xAxes(), yAxes());

    assert.equal(items.length, 1);
  });

  test('accepts a chain of non-overlapping items in the same lane', () => {
    const items = buildMatrixItemList(
      'items',
      [
        validItem({ id: 'a', from: 'Plan', to: 'Plan' }),
        validItem({ id: 'b', from: 'Doing', to: 'Doing', 'before-item': 'a' }),
        validItem({ id: 'c', from: 'Done', to: 'Done', 'before-item': 'b' }),
      ],
      xAxes(),
      yAxes(),
    );

    assert.deepEqual(items.map(({ beforeItem }) => beforeItem), [undefined, 'a', 'b']);
  });

  const relationCases = [
    [
      'unknown target',
      [validItem({ 'before-item': 'missing' })],
      'validation.itemRelation.notFound',
    ],
    [
      'different lane',
      [
        validItem({ id: 'a', from: 'Plan', to: 'Plan' }),
        validItem({
          id: 'b',
          lane: 'Data',
          from: 'Doing',
          to: 'Doing',
          'before-item': 'a',
        }),
      ],
      'validation.itemRelation.differentLane',
    ],
    [
      'overlapping X-axis ranges',
      [
        validItem({ id: 'a', from: 'Plan', to: 'Doing' }),
        validItem({ id: 'b', from: 'Doing', to: 'Done', 'before-item': 'a' }),
      ],
      'validation.itemRelation.overlap',
    ],
    [
      'target to the right',
      [
        validItem({ id: 'a', from: 'Doing', to: 'Doing' }),
        validItem({ id: 'b', from: 'Plan', to: 'Plan', 'before-item': 'a' }),
      ],
      'validation.itemRelation.targetToRight',
    ],
    [
      'multiple items referencing the same target',
      [
        validItem({ id: 'a', from: 'Plan', to: 'Plan' }),
        validItem({ id: 'b', from: 'Doing', to: 'Doing', 'before-item': 'a' }),
        validItem({ id: 'c', from: 'Done', to: 'Done', 'before-item': 'a' }),
      ],
      'validation.itemRelation.duplicateTarget',
    ],
    [
      'self reference',
      [validItem({ 'before-item': 'a' })],
      'validation.itemRelation.overlap',
    ],
  ];

  for (const [name, source, messageId] of relationCases) {
    test(`rejects ${name}`, () => {
      assertValidationError(
        () => buildMatrixItemList('items', source, xAxes(), yAxes()),
        messageId,
      );
    });
  }

  const cases = [
    ['empty list', [], 'validation.notEmpty'],
    ['not an array', 'text', 'validation.notEmpty'],
    ['null entry', [null], 'validation.notEmpty'],
    ['string entry', ['text'], 'validation.notEmpty'],
    ['duplicate id', [validItem(), validItem({ label: 'B' })], 'validation.duplicate'],
    ['unknown lane', [validItem({ lane: 'Nowhere' })], 'validation.notInList'],
    ['unknown from', [validItem({ from: 'Nowhere' })], 'validation.notInList'],
    ['unknown to', [validItem({ to: 'Nowhere' })], 'validation.notInList'],
    ['reversed interval', [validItem({ from: 'Doing', to: 'Plan' })], 'validation.order'],
  ];

  for (const [name, source, messageId] of cases) {
    test(`rejects ${name}`, () => {
      assertValidationError(() => buildMatrixItemList('items', source, xAxes(), yAxes()), messageId);
    });
  }
});

describe('loadInput', () => {
  let directory;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'matrix-renderer-input-'));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  test('loads a valid YAML file', async () => {
    const definition = await loadInput(fixturePath);

    assert.ok(definition instanceof MatrixDefinition);
    assert.equal(definition.title, 'Full feature regression');
    assert.equal(definition.width, 800);
    assert.equal(definition.items.length, 4);
  });

  test('rejects a missing file', async () => {
    await assert.rejects(loadInput(join(directory, 'missing.yaml')), { code: 'ENOENT' });
  });

  test('rejects a directory', async () => {
    await assert.rejects(loadInput(directory), { code: 'EISDIR' });
  });

  test('rejects broken YAML syntax', async () => {
    const path = join(directory, 'broken.yaml');
    await writeFile(path, 'items: [unclosed\n');

    await assert.rejects(loadInput(path), { name: 'YAMLParseError' });
  });

  test('rejects an empty file', async () => {
    const path = join(directory, 'empty.yaml');
    await writeFile(path, '');

    await assertRejectsValidationError(loadInput(path), 'validation.notEmpty');
  });

  test('rejects a definition that fails validation', async () => {
    const path = join(directory, 'invalid.yaml');
    await writeFile(path, 'xAxis: {}\nyAxis: {}\nitems: []\n');

    await assertRejectsValidationError(loadInput(path), 'validation.notEmpty');
  });
});
