'use strict';

const HOST_NAME = 'com.nfsu2.discord_presence';
let port;
let reconnectTimer;

function activeGameTab(tab) {
  return Boolean(tab && typeof tab.url === 'string' && (() => {
    try {
      const url = new URL(tab.url);
      return url.protocol === 'https:' && url.hostname === 'nfsu2.xyz';
    } catch {
      return false;
    }
  })());
}

function sendState() {
  chrome.tabs.query({ url: 'https://nfsu2.xyz/*' }, (tabs) => {
    if (chrome.runtime.lastError) {
      console.error(`Could not check open game tabs: ${chrome.runtime.lastError.message}`);
    }
    const tab = tabs?.find(activeGameTab);
    try {
      port?.postMessage({
        type: 'tab-state',
        active: activeGameTab(tab),
        url: activeGameTab(tab) ? tab.url : '',
      });
    } catch (error) {
      console.error(`Could not send game-tab state to the companion: ${error.message}`);
    }
  });
}

function connect() {
  if (port) return;
  try {
    port = chrome.runtime.connectNative(HOST_NAME);
    port.onDisconnect.addListener(() => {
      const error = chrome.runtime.lastError;
      if (error) console.error(`Native companion disconnected: ${error.message}`);
      port = undefined;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(connect, 2000);
    });
    sendState();
  } catch {
    port = undefined;
    console.error('Could not connect to the native companion.');
    if (!reconnectTimer) reconnectTimer = setTimeout(() => {
      reconnectTimer = undefined;
      connect();
    }, 2000);
  }
}

chrome.tabs.onActivated.addListener(sendState);
chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
  if (changeInfo.url || changeInfo.status === 'complete') sendState();
});
chrome.tabs.onRemoved.addListener(sendState);
chrome.runtime.onStartup.addListener(() => {
  connect();
  sendState();
});
chrome.runtime.onInstalled.addListener(() => {
  connect();
  sendState();
});

connect();
