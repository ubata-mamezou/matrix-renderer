import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { toUrl } from '../../../src/adapter/web/url.js';
import { assertValidationError } from '../../helpers/assertions.js';

describe('toUrl', () => {
  for (const value of [
    'http://example.com',
    'https://example.com/path?query=1#hash',
    'https://example.com:8443/',
    'HTTPS://EXAMPLE.COM',
  ]) {
    test(`accepts ${value}`, () => {
      const url = toUrl(value);

      assert.ok(url instanceof URL);
      assert.match(url.protocol, /^https?:$/);
    });
  }

  for (const value of [undefined, null, '', '   ', 123]) {
    test(`rejects ${JSON.stringify(value)} as empty`, () => {
      assertValidationError(() => toUrl(value), 'validation.notEmpty');
    });
  }

  for (const value of ['example.com', 'not a url', '//example.com', '/relative/path']) {
    test(`rejects ${value} as not a URL`, () => {
      assertValidationError(() => toUrl(value), 'url.badValue');
    });
  }

  for (const value of [
    'ftp://example.com',
    'file:///etc/passwd',
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'mailto:user@example.com',
  ]) {
    test(`rejects ${value} as an unsupported protocol`, () => {
      assertValidationError(() => toUrl(value), 'url.badProtocol');
    });
  }
});
