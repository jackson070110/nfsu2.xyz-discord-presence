'use strict';

const GAME_TITLE = 'Need for Speed: Underground 2';
const GAME_URL = 'https://nfsu2.xyz/';

function isGameUrl(value) {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'nfsu2.xyz';
  } catch {
    return false;
  }
}

function createActivity(startedAt, coverAssetKey) {
  return {
    name: GAME_TITLE,
    type: 0,
    details: 'Playing on nfsu2.xyz',
    state: 'Underground 2 in the browser',
    timestamps: { start: startedAt },
    assets: {
      large_image: coverAssetKey,
      large_text: GAME_TITLE,
    },
    buttons: [{ label: 'Play NFSU2', url: GAME_URL }],
  };
}

module.exports = { GAME_TITLE, GAME_URL, isGameUrl, createActivity };
