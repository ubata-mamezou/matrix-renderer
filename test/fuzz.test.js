import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import * as fc from 'fast-check';
import { parse, stringify } from 'yaml';
import { BusinessError } from '../src/errors/error.js';
import { MatrixDefinition } from '../src/input.js';
import { renderSvg } from '../src/svg.js';

const xmlCharacter = fc.constantFrom(
  'a',
  'Z',
  '0',
  '日',
  '&',
  '<',
  '>',
  '"',
  "'",
  ' ',
  '\n',
);
const text = fc
  .tuple(
    fc.constantFrom('a', '日', '&', '<', '>', '"', "'"),
    fc.array(xmlCharacter, { maxLength: 31 }),
  )
  .map(([first, rest]) => first + rest.join(''));

const escapeXml = (value) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&apos;',
      })[character],
  );

describe('property-based input and rendering checks', () => {
  test('arbitrary YAML-compatible structures fail only with validation errors', () => {
    fc.assert(
      fc.property(fc.jsonValue(), (source) => {
        const parsedSource = parse(stringify(source));
        let definition;
        try {
          definition = MatrixDefinition.from(parsedSource);
        } catch (error) {
          assert.ok(
            error instanceof BusinessError,
            `Unexpected error: ${error?.stack ?? error}`,
          );
          return;
        }

        const { svg } = renderSvg(definition);
        assert.ok(svg.startsWith('<svg'));
        assert.ok(svg.endsWith('</svg>'));
      }),
      { numRuns: 100 },
    );
  });

  test('valid generated labels render as escaped SVG text', () => {
    fc.assert(
      fc.property(fc.record({ title: text, label: text }), ({ title, label }) => {
        const definition = MatrixDefinition.from({
          title,
          xAxis: { label: 'Phase', values: ['Plan', 'Done'] },
          yAxis: { label: 'Category', values: ['Operations'] },
          items: [
            {
              id: 'item',
              label,
              lane: 'Operations',
              from: 'Plan',
              to: 'Done',
              url: 'https://example.com',
              color: '#abc',
            },
          ],
        });
        const { svg, width, height } = renderSvg(definition);

        assert.ok(svg.startsWith('<svg'));
        assert.ok(svg.endsWith('</svg>'));
        assert.equal(width, MatrixDefinition.defaultWidth);
        assert.ok(Number.isFinite(height) && height > 0);
        assert.ok(svg.includes(escapeXml(title)));
        assert.ok(svg.includes(escapeXml(label)));
      }),
      { numRuns: 100 },
    );
  });
});
