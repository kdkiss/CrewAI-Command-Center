import { act } from 'react-dom/test-utils';

const mockSocket = {
  on: jest.fn((event, callback) => {
    mockSocket.handlers[event] = callback;
  }),
  emit: jest.fn((event, ...args) => {
    if (mockSocket.handlers[event]) {
      act(() => {
        mockSocket.handlers[event](...args);
      });
    }
  }),
  off: jest.fn((event, callback) => {
    if (mockSocket.handlers[event] === callback) {
      delete mockSocket.handlers[event];
    }
  }),
  disconnect: jest.fn(),
  handlers: {},
};

const io = jest.fn(() => mockSocket);

// Export the mock socket so we can access it in tests
io.mockSocket = mockSocket;

export default io;