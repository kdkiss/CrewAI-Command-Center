import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import CrewCard from '../CrewCard';

describe('CrewCard', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const baseCrew = {
    id: '1',
    name: 'Crew Alpha',
    description: 'Handles mission critical tasks.',
    agents: [{ id: 'agent-1' }, { id: 'agent-2' }],
    tasks: [{ id: 'task-1' }, { id: 'task-2' }, { id: 'task-3' }]
  };

  it('renders crew metrics and run statistics', () => {
    jest.spyOn(Date, 'now').mockReturnValue(30 * 1000);
    const logs = {
      '1': [
        { id: 'log-1', level: 'info', operation_status: 'complete', timestamp: new Date(0) },
        { id: 'log-2', level: 'success', operation_status: 'complete', timestamp: new Date(0) }
      ]
    };

    render(
      <CrewCard
        crew={baseCrew}
        selectedCrewId={null}
        crewLogs={logs}
        onSelect={jest.fn()}
      />
    );

    expect(screen.getByText('Crew Alpha')).toBeInTheDocument();
    expect(screen.getByText('Handles mission critical tasks.')).toBeInTheDocument();
    expect(screen.getByText(/^Agents$/i).previousElementSibling).toHaveTextContent('2');
    expect(screen.getByText(/^Tasks$/i).previousElementSibling).toHaveTextContent('3');

    const lastRunLabel = screen.getByText('Last run');
    expect(lastRunLabel.parentElement?.querySelector('dd')).toHaveTextContent('just now');

    const totalExecutionsLabel = screen.getByText('Total executions');
    expect(totalExecutionsLabel.parentElement?.querySelector('dd')).toHaveTextContent('2');
  });

  it('invokes callbacks for quick actions', async () => {
    const handleSelect = jest.fn();
    const handleRun = jest.fn();
    const handleStop = jest.fn();
    const handleEdit = jest.fn();
    const handleClone = jest.fn();
    const handleDelete = jest.fn();

    const { rerender } = render(
      <CrewCard
        crew={baseCrew}
        selectedCrewId={null}
        crewLogs={{}}
        onSelect={handleSelect}
        onRun={handleRun}
        onStop={handleStop}
        onEdit={handleEdit}
        onClone={handleClone}
        onDelete={handleDelete}
      />
    );

    const card = screen.getByRole('button', { name: /Crew Alpha/i });

    fireEvent.click(card);
    expect(handleSelect).toHaveBeenCalledTimes(1);

    fireEvent.focus(card);

    const runButton = await screen.findByRole('button', { name: /^Run$/i });
    const toolbar = runButton.parentElement;
    if (!toolbar) {
      throw new Error('Quick action toolbar is not rendered');
    }

    const toolbarQueries = within(toolbar);

    fireEvent.click(runButton);
    expect(handleRun).toHaveBeenCalledTimes(1);
    expect(handleRun.mock.calls[0][0]).toMatchObject({ id: '1' });

    fireEvent.click(toolbarQueries.getByRole('button', { name: /^Edit$/i }));
    fireEvent.click(toolbarQueries.getByRole('button', { name: /^Clone$/i }));
    fireEvent.click(toolbarQueries.getByRole('button', { name: /^Delete$/i }));

    expect(handleEdit).toHaveBeenCalledTimes(1);
    expect(handleClone).toHaveBeenCalledTimes(1);
    expect(handleDelete).toHaveBeenCalledTimes(1);
    expect(handleSelect).toHaveBeenCalledTimes(1);

    rerender(
      <CrewCard
        crew={baseCrew}
        selectedCrewId={null}
        crewLogs={{}}
        isRunning
        onSelect={handleSelect}
        onRun={handleRun}
        onStop={handleStop}
        onEdit={handleEdit}
        onClone={handleClone}
        onDelete={handleDelete}
      />
    );

    const updatedCard = screen.getByRole('button', { name: /Crew Alpha/i });
    fireEvent.focus(updatedCard);

    const stopButton = await screen.findByRole('button', { name: /^Stop$/i });
    fireEvent.click(stopButton);
    expect(handleStop).toHaveBeenCalledTimes(1);
    expect(handleStop.mock.calls[0][0]).toMatchObject({ id: '1' });
  });
});
