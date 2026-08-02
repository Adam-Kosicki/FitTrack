// jest-dom adds custom jest matchers for asserting on DOM nodes.
import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';
import { ReadableStream } from 'stream/web';

global.TextEncoder = global.TextEncoder || TextEncoder;
global.TextDecoder = global.TextDecoder || TextDecoder;
global.ReadableStream = global.ReadableStream || ReadableStream;

// Mock Firebase Auth for headless Jest tests
jest.mock('firebase/auth', () => ({
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (auth, callback) => {
    if (typeof callback === 'function') callback(null);
    return () => {};
  },
  signInWithPopup: jest.fn(),
  GoogleAuthProvider: jest.fn().mockImplementation(() => ({})),
  signOut: jest.fn()
}));

// Silence ResizeObserver missing in jsdom warnings used by some components
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = window.ResizeObserver || MockResizeObserver;
