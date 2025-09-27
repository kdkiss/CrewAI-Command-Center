import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

import LogViewer from '../LogViewer';

describe('LogViewer', () => {
  const sampleLog = {
    timestamp: new Date().toISOString(),
    message: 'Scaled log entry',
    level: 'info',
    agent: 'test-agent',
    category: 'ANALYSIS'
  };

  it('applies the large font size class when configured', () => {
    render(<LogViewer logs={[sampleLog]} logFontSize="large" />);

    const message = screen.getByText('Scaled log entry');
    expect(message).toHaveClass('text-base');
  });

  it('defaults to medium font size', () => {
    render(<LogViewer logs={[sampleLog]} />);

    const message = screen.getByText('Scaled log entry');
    expect(message).toHaveClass('text-sm');
  });

  it('exposes a live log region with polite announcements', () => {
    render(<LogViewer logs={[sampleLog]} />);

    const liveRegion = screen.getByRole('log');
    expect(liveRegion).toHaveAttribute('aria-live', 'polite');
    expect(liveRegion).toHaveAttribute('aria-relevant', 'additions text');
  });

  it('moves focus to the newest log when entries are appended', async () => {
    const firstLog = { ...sampleLog, message: 'Initial entry' };
    const { rerender } = render(<LogViewer logs={[firstLog]} />);

    const secondLog = {
      ...sampleLog,
      timestamp: new Date(Date.now() + 1000).toISOString(),
      message: 'Second entry',
      sequence: 2
    };

    rerender(<LogViewer logs={[firstLog, secondLog]} />);

    const latestMessage = await screen.findByText('Second entry');
    const latestItem = latestMessage.closest('li');
    expect(latestItem).not.toBeNull();

    await waitFor(() => {
      expect(latestItem).toHaveFocus();
    });
  });
});
