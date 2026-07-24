import assert from 'node:assert/strict';
import test from 'node:test';

import { __test } from '../src/content/modules/notificationAlerts/index.js';

function element(textContent = '', { className = '', attributes = [], children = [] } = {}) {
  return {
    textContent,
    className,
    id: '',
    attributes,
    getAttribute(name) {
      return attributes.find((attribute) => attribute.name === name)?.value ?? null;
    },
    querySelectorAll() {
      return children;
    },
  };
}

function row(cells) {
  return {
    ...element('', { children: cells }),
    querySelectorAll() {
      return cells;
    },
  };
}

test('parses an English espionage Town News row from icon metadata', () => {
  const event = __test.parseRow(row([
    element('', { className: 'event spyReport' }),
    element('Ika City'),
    element('24.07.2026 12:34'),
    element('A spy was discovered'),
  ]));

  assert.deepEqual(event, {
    category: 'espionage',
    location: 'Ika City',
    gameDateText: '24.07.2026 12:34',
    subject: 'A spy was discovered',
  });
});

test('parses localized rows without English headers and recognizes Vietnamese categories', () => {
  const event = __test.parseRow(row([
    element('', { className: 'report-icon' }),
    element('Thành phố Ika'),
    element('24/07/2026 12:34'),
    element('Đã phát hiện gián điệp trong thành phố'),
  ]));

  assert.equal(event?.category, 'espionage');
  assert.equal(event?.location, 'Thành phố Ika');
});

test('recognizes military icon identifiers and leaves production reports non-alerting', () => {
  const military = __test.parseRow(row([
    element('', { className: 'event blockade' }),
    element('Harbor'),
    element('2026-07-24 12:34'),
    element('Localized report'),
  ]));
  const production = __test.parseRow(row([
    element('', { className: 'productionReport' }),
    element('Workshop'),
    element('2026-07-24 12:35'),
    element('Building was expanded'),
  ]));

  assert.equal(military?.category, 'military');
  assert.notEqual(production?.category, 'espionage');
  assert.notEqual(production?.category, 'military');
});

test('uses stable keys for duplicate rows and ignores malformed rows', () => {
  const first = __test.parseRow(row([
    element('', { className: 'spy' }),
    element('Ika City'),
    element('24.07.2026 12:34'),
    element('Spy report'),
  ]));
  const duplicate = __test.parseRow(row([
    element('', { className: 'spy' }),
    element('Ika City'),
    element('24.07.2026 12:34'),
    element('Spy report'),
  ]));

  assert.equal(__test.eventKey(first), __test.eventKey(duplicate));
  assert.equal(__test.parseRow(row([element('Ika City'), element('No date'), element('Report')])), null);
});

test('handles empty or malformed advisor responses without throwing', () => {
  assert.deepEqual(__test.parseAdvisorResult({ html: '', htmlFragments: [] }), []);

  const originalDomParser = globalThis.DOMParser;
  const originalWarn = console.warn;
  globalThis.DOMParser = class {
    parseFromString() {
      throw new Error('malformed advisor response');
    }
  };
  console.warn = () => {};
  try {
    assert.deepEqual(__test.parseAdvisorResult({ html: '<not-html>', htmlFragments: [] }), []);
  } finally {
    globalThis.DOMParser = originalDomParser;
    console.warn = originalWarn;
  }
});
