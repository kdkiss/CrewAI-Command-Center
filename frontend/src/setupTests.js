// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

if (typeof window !== 'undefined' && typeof window.ResizeObserver === 'undefined') {
  class ResizeObserverMock {
    constructor(callback) {
      this.callback = callback;
    }

    observe() {
      // no-op for testing environment
    }

    unobserve() {
      // no-op for testing environment
    }

    disconnect() {
      // no-op for testing environment
    }
  }

  window.ResizeObserver = ResizeObserverMock;
  global.ResizeObserver = ResizeObserverMock;
}
