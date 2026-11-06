'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createActivity, isGameUrl } = require('./src/activity');
const { DiscordRpc } = require('./src/discord-rpc');
const { createNativeMessageReader } = require('./src/native-host');

const configPath = path.join(__dirname, 'config.json');
let config;
try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch {
  process.stderr.write(`Missing or invalid ${configPath}. Run setup.ps1 first.\n`);
  process.exit(1);
}

if (!/^\d{15,25}$/.test(config.clientId || '') || !/^[a-zA-Z0-9_-]{1,128}$/.test(config.coverAssetKey || '')) {
  process.stderr.write('config.json must contain a numeric clientId and valid coverAssetKey.\n');
  process.exit(1);
}

const rpc = new DiscordRpc(
  config.clientId,
  (startedAt) => createActivity(startedAt, config.coverAssetKey),
);
rpc.on('warning', (message) => process.stderr.write(`Discord RPC: ${message}\n`));
rpc.setActive(false);

const readMessage = createNativeMessageReader((message) => {
  const active = message?.type === 'tab-state' && message.active === true && isGameUrl(message.url);
  rpc.setActive(active);
});

process.stdin.on('data', readMessage);
process.stdin.on('end', () => {
  rpc.setActive(false);
  rpc.stop();
});
process.stdin.on('error', () => {
  rpc.setActive(false);
  rpc.stop();
});
process.stdin.resume();

process.on('SIGTERM', () => {
  rpc.setActive(false);
  rpc.stop();
  process.exit(0);
});
