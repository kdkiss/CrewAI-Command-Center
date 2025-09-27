import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

import LogViewer from '../LogViewer';
import LogEntry from '../LogEntry';
import LogGroup from '../LogGroup';

expect.extend(toHaveNoViolations);

describe('Log accessibility', () => {

  const baseLog = {
    timestamp: new Date().toISOString(),
    message: 'Accessibility test message',
    level: 'info',
    agent: 'accessibility-agent',
    category: 'ANALYSIS',
    sequence: 1
  };

  afterEach(() => {
    cleanup();
  });

  it('LogViewer renders without accessibility violations', async () => {
    const { container } = render(<LogViewer logs={[baseLog]} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('LogEntry meets accessibility expectations when isolated', async () => {
    const { container } = render(
      <ul role="list">
        <LogEntry log={baseLog} />
      </ul>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('LogGroup supports accessible interactions when expanded', async () => {
    const groupedLogs = [
      baseLog,
      {
        ...baseLog,
        timestamp: new Date(Date.now() + 500).toISOString(),
        message: 'Accessibility test message copy',
        sequence: 2
      }
    ];

    const { container } = render(
      <ul role="list">
        <LogGroup logs={groupedLogs} groupTitle="Analysis: accessibility-agent" category="ANALYSIS" expanded />
      </ul>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
