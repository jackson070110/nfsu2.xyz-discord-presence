'use strict';

const MAX_MESSAGE_SIZE = 1024 * 1024;

function createNativeMessageReader(onMessage, onError = () => {}) {
  let buffer = Buffer.alloc(0);
  return (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length >= 4) {
      const size = buffer.readUInt32LE(0);
      if (size > MAX_MESSAGE_SIZE) {
        onError(new Error('Native message exceeds 1 MiB.'));
        buffer = Buffer.alloc(0);
        return;
      }
      if (buffer.length < size + 4) return;
      const body = buffer.subarray(4, size + 4).toString('utf8');
      buffer = buffer.subarray(size + 4);
      try {
        onMessage(JSON.parse(body));
      } catch (error) {
        onError(error);
      }
    }
  };
}

module.exports = { createNativeMessageReader };
