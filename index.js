// DOMException is a browser-only API not available in React Native's Hermes engine.
if (typeof global.DOMException === 'undefined') {
  global.DOMException = class DOMException extends Error {
    constructor(message, name) {
      super(message);
      this.name = name ?? 'DOMException';
    }
  };
}

require('expo-router/entry');
