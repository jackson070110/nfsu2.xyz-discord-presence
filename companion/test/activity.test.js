'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createActivity, isGameUrl, GAME_TITLE, GAME_URL } = require('../src/activity');
const { createNativeMessageReader } = require('../src/native-host');
const { encodeFrame } = require('../src/discord-rpc');

test('only accepts the exact HTTPS game origin', () => {
  assert.equal(isGameUrl('https://nfsu2.xyz/'), true);
  assert.equal(isGameUrl('https://nfsu2.xyz/race'), true);
  assert.equal(isGameUrl('http://nfsu2.xyz/'), false);
  assert.equal(isGameUrl('https://www.nfsu2.xyz/'), false);
  assert.equal(isGameUrl('https://nfsu2.xyz.attacker.invalid/'), false);
});

test('activity has the requested single button and elapsed timestamp', () => {
  const activity = createActivity(1234, 'underground2_cover');
  assert.equal(activity.name, GAME_TITLE);
  assert.equal(activity.type, 0);
  assert.equal(activity.details, 'Playing on nfsu2.xyz');
  assert.equal(activity.state, 'Underground 2 in the browser');
  assert.deepEqual(activity.timestamps, { start: 1234 });
  assert.deepEqual(activity.assets, {
    large_image: 'underground2_cover',
    large_text: GAME_TITLE,
  });
  assert.deepEqual(activity.buttons, [{ label: 'Play NFSU2', url: GAME_URL }]);
});

test('native-message parser accepts fragmented and consecutive frames', () => {
  const seen = [];
  const read = createNativeMessageReader((message) => seen.push(message));
  const first = encodeFrame(0, { type: 'tab-state', active: true, url: 'https://nfsu2.xyz/' });
  const second = encodeFrame(0, { type: 'tab-state', active: false, url: '' });
  read(first.subarray(0, 3));
  read(Buffer.concat([first.subarray(3), second]));
  assert.deepEqual(seen, [
    { type: 'tab-state', active: true, url: 'https://nfsu2.xyz/' },
    { type: 'tab-state', active: false, url: '' },
  ]);
});
