'use strict';

const net = require('node:net');
const EventEmitter = require('node:events');

const RETRY_MS = 2500;
const MAX_FRAME_SIZE = 1024 * 1024;

function encodeFrame(opcode, payload) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8');
  const header = Buffer.alloc(8);
  header.writeUInt32LE(opcode, 0);
  header.writeUInt32LE(body.length, 4);
  return Buffer.concat([header, body]);
}

class DiscordRpc extends EventEmitter {
  constructor(clientId, activityFactory) {
    super();
    this.clientId = clientId;
    this.activityFactory = activityFactory;
    this.socket = null;
    this.buffer = Buffer.alloc(0);
    this.ready = false;
    this.stopped = false;
    this.retryTimer = null;
    this.active = false;
    this.startedAt = null;
    this.nonce = 0;
    this.unavailable = false;
  }

  setActive(active) {
    if (active && !this.active) this.startedAt = Math.floor(Date.now() / 1000);
    if (!active) this.startedAt = null;
    this.active = active;
    if (this.ready) this.publish();
    else this.connect();
  }

  connect() {
    if (this.stopped || this.socket || this.retryTimer) return;
    this.tryPipe(0);
  }

  tryPipe(index) {
    if (this.stopped) return;
    if (index >= 10) {
      if (!this.unavailable) {
        this.unavailable = true;
        this.emit('warning', 'Discord desktop IPC is unavailable. Make sure the Discord desktop app is open and signed in.');
      }
      this.retryTimer = setTimeout(() => {
        this.retryTimer = null;
        this.connect();
      }, RETRY_MS);
      return;
    }

    const socket = net.createConnection(`\\\\?\\pipe\\discord-ipc-${index}`);
    this.socket = socket;
    let pipeFailed = false;

    socket.setTimeout(1500);
    socket.once('connect', () => {
      socket.setTimeout(0);
      this.send(0, { v: 1, client_id: this.clientId });
    });
    socket.on('data', (chunk) => this.readFrames(chunk));
    socket.once('timeout', () => socket.destroy(new Error('Discord IPC timed out')));
    socket.once('error', () => {
      pipeFailed = true;
      if (this.socket === socket) this.socket = null;
      socket.destroy();
      if (index < 9) this.tryPipe(index + 1);
    });
    socket.once('close', () => {
      if (this.socket === socket) this.socket = null;
      this.ready = false;
      this.buffer = Buffer.alloc(0);
      if (pipeFailed) return;
      this.scheduleReconnect();
    });
  }

  readFrames(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (this.buffer.length >= 8) {
      const opcode = this.buffer.readUInt32LE(0);
      const size = this.buffer.readUInt32LE(4);
      if (size > MAX_FRAME_SIZE) {
        this.socket?.destroy(new Error('Discord IPC frame exceeds limit'));
        return;
      }
      if (this.buffer.length < size + 8) return;
      const body = this.buffer.subarray(8, size + 8).toString('utf8');
      this.buffer = this.buffer.subarray(size + 8);
      if (opcode !== 1 && opcode !== 2) continue;
      try {
        this.handleMessage(JSON.parse(body));
      } catch {
        this.emit('warning', 'Received an invalid Discord IPC message.');
      }
    }
  }

  handleMessage(message) {
    if (message.evt === 'READY') {
      this.unavailable = false;
      this.ready = true;
      this.emit('ready');
      this.publish();
    } else if (message.evt === 'ERROR' || message.code) {
      this.emit('warning', message.data?.message || message.message || 'Discord rejected Rich Presence.');
    }
  }

  publish() {
    if (!this.ready || !this.socket) return;
    const activity = this.active
      ? this.activityFactory(this.startedAt)
      : null;
    this.send(1, {
      cmd: 'SET_ACTIVITY',
      args: { pid: process.pid, activity },
      nonce: String(++this.nonce),
    });
  }

  send(opcode, payload) {
    if (!this.socket || this.socket.destroyed) return;
    this.socket.write(encodeFrame(opcode, payload));
  }

  scheduleReconnect() {
    if (this.stopped || this.retryTimer) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.connect();
    }, RETRY_MS);
  }

  stop() {
    this.stopped = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    if (this.ready) {
      this.active = false;
      this.publish();
    }
    this.socket?.end();
    this.socket = null;
    this.ready = false;
  }
}

module.exports = { DiscordRpc, encodeFrame };
