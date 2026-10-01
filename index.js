// This file runs before Expo Router's file scanner, making it the right place
// for global polyfills that LiveKit needs at module-evaluation time.

// DOMException is a browser-only API not available in React Native's Hermes engine.
if (typeof global.DOMException === 'undefined') {
  global.DOMException = class DOMException extends Error {
    constructor(message, name) {
      super(message);
      this.name = name ?? 'DOMException';
    }
  };
}

// Buffer is a Node global not available in Hermes. A few files already import
// it explicitly from the 'buffer' package, but third-party library internals
// (e.g. @ecency/render-helper's catchPostImage, via its multihashes
// dependency) reference the ambient global directly and crash without it.
if (typeof global.Buffer === 'undefined') {
  global.Buffer = require('buffer').Buffer;
}

// Register WebRTC globals required by @livekit/react-native before any
// LiveKit module is imported by Expo Router's eager file scan.
const { registerGlobals } = require('@livekit/react-native');
registerGlobals();

require('expo-router/entry');
