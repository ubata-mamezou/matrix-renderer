import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { MatrixDefinition } from '../src/input.js';
import { RenderItem, renderSvg, Track, MARGIN } from '../src/svg.js';

/** 3列（Plan、Doing、Done）と3レーン（Ops、Data、Empty）を持つ定義。Opsの2項目は期間が重なる。 */
const definition = (overrides = {}) =>
  MatrixDefinition.from({
    title: 'sample',
    width: 800,
    xAxis: { label: 'Phase', values: ['Plan', 'Doing', 'Done'] },
    yAxis: { label: 'Category', values: ['Ops', 'Data', 'Empty'] },
    items: [
      { id: 'a', label: 'Item A', lane: 'Ops', from: 'Plan', to: 'Doing' },
      { id: 'b', label: 'Item B', lane: 'Ops', from: 'Doing', to: 'Done' },
      { id: 'c', label: 'Item C', lane: 'Data', from: 'Doing', to: 'Doing' },
    ],
    ...overrides,
  });

describe('RenderItem', () => {
  test('keeps its source and geometry and prepares the label', () => {
    const source = definition().items[0];
    const item = new RenderItem(source, 1, 2, 290, 100);

    assert.equal(item.source, source);
    assert.deepEqual([item.start, item.end, item.x, item.width], [1, 2, 290, 100]);
    assert.deepEqual(item.lines, ['Item A']);
    assert.equal(item.height, 31);
  });

  test('derives height from wrapped lines', () => {
    const source = definition({
      items: [{ id: 'long', label: '一'.repeat(13), lane: 'Ops', from: 'Plan', to: 'Plan' }],
    }).items[0];
    const item = new RenderItem(source, 0, 1, 190, 100);

    assert.deepEqual(item.lines.map((line) => Array.from(line).length), [6, 6, 1]);
    assert.equal(item.height, 65);
  });
});

describe('Track', () => {
  const renderItem = (start, end, label = 'A', width = 100) =>
    new RenderItem({ label }, start, end, start * 100, width);

  test('accepts and adds non-overlapping items while updating its end', () => {
    const track = new Track();
    const first = renderItem(0, 1);
    const second = renderItem(1, 2);

    assert.equal(track.canAccept(first), true);
    track.add(first);
    assert.equal(track.end, 1);
    assert.equal(track.canAccept(second), true);
    track.add(second);

    assert.deepEqual(track.items, [first, second]);
    assert.equal(track.end, 2);
  });

  test('rejects overlapping items', () => {
    const track = new Track();
    track.add(renderItem(0, 2));

    assert.equal(track.canAccept(renderItem(1, 3)), false);
    assert.throws(() => track.add(renderItem(1, 3)), RangeError);
  });

  test('derives height from its tallest item with a minimum height', () => {
    const track = new Track();

    assert.equal(track.height, 42);
    track.add(renderItem(0, 1));
    assert.equal(track.height, 42);
    track.add(renderItem(1, 2, '一'.repeat(13)));
    assert.equal(track.height, 65);
  });
});

describe('renderSvg', () => {
  test('returns the size derived from the layout', () => {
    const { svg, width, height } = renderSvg(definition());

    assert.equal(width, 800);
    assert.equal(height, MARGIN.top + (116 + 66 + 58) + MARGIN.bottom);
    assert.ok(svg.startsWith(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="${height}" viewBox="0 0 800 ${height}">`));
    assert.ok(svg.endsWith('</svg>'));
  });

  test('is deterministic', () => {
    assert.equal(renderSvg(definition()).svg, renderSvg(definition()).svg);
  });

  test('draws the title, axis labels and headers', () => {
    const { svg } = renderSvg(definition());

    for (const label of ['sample', 'Phase', 'Category', 'Plan', 'Doing', 'Done', 'Ops', 'Data', 'Empty']) {
      assert.ok(svg.includes(`>${label}</text>`), label);
    }
  });

  test('draws one more vertical grid line than columns', () => {
    const { svg } = renderSvg(definition());

    assert.equal(svg.match(/<line x1="[\d.]+" y1="120" /g).length, 4);
  });

  test('alternates the lane backgrounds', () => {
    const { svg } = renderSvg(definition());

    assert.ok(svg.includes('<rect x="0" y="120" width="800" height="116" fill="#f4f7fa"/>'));
    assert.ok(svg.includes('<rect x="0" y="236" width="800" height="66" fill="#ffffff"/>'));
  });

  test('uses the column color for the header', () => {
    const { svg } = renderSvg(
      definition({ xAxis: { label: 'Phase', values: [{ label: 'Plan', color: '#d6eaf8' }, 'Doing', 'Done'] } }),
    );

    assert.ok(svg.includes('fill="#d6eaf8"'));
  });

  test('draws every item with its id', () => {
    const { svg } = renderSvg(definition());

    for (const id of ['a', 'b', 'c']) {
      assert.ok(svg.includes(`<g data-item-id="${id}">`), id);
    }
  });

  test('applies the item color to the bar and the text', () => {
    const source = definition();
    source.items[0].color = '#245080';
    const { svg } = renderSvg(source);

    assert.ok(svg.includes('fill="#245080" stroke="#1a3a5c"'));
    assert.ok(svg.includes('style="fill:#ffffff">Item A</text>'));
  });

  test('draws a link only for items with a url', () => {
    const source = definition();
    source.items[0].url = 'https://example.com/x?a=1&b=2';
    const { svg } = renderSvg(source);

    assert.equal(svg.match(/<a /g).length, 1);
    assert.ok(svg.includes('<a href="https://example.com/x?a=1&amp;b=2" target="_blank" rel="noopener noreferrer"'));
    assert.ok(svg.includes('aria-label="Item Aを開く"'));
  });

  test('wraps a long label into several text elements', () => {
    const source = definition();
    source.items = [{ id: 'long', label: '一'.repeat(25), lane: 'Ops', from: 'Plan', to: 'Plan' }];
    const { svg } = renderSvg(source);

    assert.equal(svg.match(/class="bar-label"/g).length, 2);
  });

  test('places overlapping items on separate tracks and reuses a track when intervals only touch', () => {
    const source = definition({
      items: [
        { id: 'a', label: 'A', lane: 'Ops', from: 'Plan', to: 'Doing' },
        { id: 'b', label: 'B', lane: 'Ops', from: 'Doing', to: 'Done' },
        { id: 'c', label: 'C', lane: 'Data', from: 'Plan', to: 'Plan' },
        { id: 'd', label: 'D', lane: 'Data', from: 'Doing', to: 'Doing' },
      ],
    });
    const { svg } = renderSvg(source);
    const barY = (id) => {
      const group = svg.split(`<g data-item-id="${id}">`)[1].split('</g>')[0];
      return Number(group.match(/<rect x="[\d.]+" y="([\d.]+)"/)[1]);
    };

    assert.notEqual(barY('a'), barY('b'));
    assert.equal(barY('c'), barY('d'));
  });

  test('uses the tallest wrapped item to size its track and lane', () => {
    const source = definition({
      items: [
        { id: 'long', label: '一'.repeat(25), lane: 'Ops', from: 'Plan', to: 'Plan' },
      ],
    });
    const { svg } = renderSvg(source);
    assert.equal(svg.match(/class="bar-label"/g).length, 2);
    assert.ok(svg.includes('width="800" height="72"'));
    assert.ok(svg.includes('height="72" fill="#f4f7fa"'));
  });

  test('escapes special characters in every text and attribute', () => {
    const source = MatrixDefinition.from({
      title: `<b>&"'`,
      width: 800,
      xAxis: { label: '<x>', values: ['<p>'] },
      yAxis: { label: '<y>', values: ['<l>'] },
      items: [{ id: '"id"', label: '<i>&', lane: '<l>', from: '<p>', to: '<p>', url: 'https://example.com/?a="1"&b=<2>' }],
    });
    const { svg } = renderSvg(source);

    assert.ok(svg.includes('&lt;b&gt;&amp;&quot;&apos;'));
    assert.ok(svg.includes('data-item-id="&quot;id&quot;"'));
    assert.ok(svg.includes('aria-label="&lt;i&gt;&amp;を開く"'));
    assert.ok(!svg.includes('<b>'));
    assert.ok(!svg.includes('<i>'));
    assert.ok(!svg.includes('<p>'));
    assert.ok(!svg.includes('<l>'));
  });
});
