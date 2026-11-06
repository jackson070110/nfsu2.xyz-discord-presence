'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createEvent() {
  const listeners = [];
  return {
    addListener(listener) {
      listeners.push(listener);
    },
    dispatch(...args) {
      for (const listener of listeners) listener(...args);
    },
  };
}

test('extension manifest keeps one stable ID across Chromium browsers', () => {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'),
  );
  const publicKey = Buffer.from(manifest.key, 'base64');
  const id = [...crypto.createHash('sha256').update(publicKey).digest().subarray(0, 16)]
    .map((byte) => String.fromCharCode(97 + (byte >> 4), 97 + (byte & 15)))
    .join('');

  assert.equal(id, 'leailbbgnbjdnlegcgmhibpkhlgogcff');
});

test('presence follows an open game tab even when it is in the background', () => {
  const messages = [];
  let openTabs = [
    { url: 'https://nfsu2.xyz/', active: false },
    { url: 'https://example.com/', active: true },
  ];
  const port = {
    onDisconnect: createEvent(),
    postMessage: (message) => messages.push(message),
  };
  const chrome = {
    tabs: {
      query: (query, callback) => {
        assert.equal(JSON.stringify(query), '{"url":"https://nfsu2.xyz/*"}');
        callback(openTabs);
      },
      onActivated: createEvent(),
      onUpdated: createEvent(),
      onRemoved: createEvent(),
    },
    runtime: {
      lastError: null,
      connectNative: () => port,
      onStartup: createEvent(),
      onInstalled: createEvent(),
    },
  };
  const source = fs.readFileSync(path.join(__dirname, 'service-worker.js'), 'utf8');

  vm.runInNewContext(source, { chrome, URL, console, setTimeout, clearTimeout });
  assert.equal(JSON.stringify(messages.at(-1)), JSON.stringify({
    type: 'tab-state',
    active: true,
    url: 'https://nfsu2.xyz/',
  }));

  openTabs = [{ url: 'https://example.com/', active: true }];
  chrome.tabs.onRemoved.dispatch(1);
  assert.equal(JSON.stringify(messages.at(-1)), JSON.stringify({
    type: 'tab-state',
    active: false,
    url: '',
  }));
});
