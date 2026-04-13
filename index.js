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

// Register WebRTC globals required by @livekit/react-native before any
// LiveKit module is imported by Expo Router's eager file scan.
const { registerGlobals } = require('@livekit/react-native');
registerGlobals();

require('expo-router/entry');
