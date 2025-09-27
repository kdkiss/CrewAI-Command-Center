import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';

import AgentLibraryPanel from '../AgentLibraryPanel';

jest.mock('axios');
const mockedAxios = axios;

const API_ENDPOINT = expect.stringMatching(/\/api\/agents$/);
const PUT_ENDPOINT = expect.stringMatching(/\/api\/agents\/\d+$/);
const DELETE_ENDPOINT = expect.stringMatching(/\/api\/agents\/\d+$/);

const renderPanel = () =>
  render(<AgentLibraryPanel />);

describe('AgentLibraryPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('loads and displays agent entries', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: [
        { name: 'Discovery Researcher', role: 'Analyst', goal: 'Find insights', backstory: 'Curious explorer.', source: 'curated' },
        { name: 'Story Architect', role: 'Strategist', goal: 'Design narratives', backstory: 'Editorial veteran.', source: 'curated' }
      ]
    });

    renderPanel();

    expect(await screen.findByText('Agent Library')).toBeInTheDocument();
    await screen.findByText('Discovery Researcher');
    expect(screen.getByText('Story Architect')).toBeInTheDocument();
    expect(mockedAxios.get).toHaveBeenCalledWith(API_ENDPOINT);
  });

  test('submits a new agent and shows success feedback', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: [] });

    const newAgent = {
      name: 'Automation Specialist',
      role: 'Workflow Orchestrator',
      goal: 'Streamline repetitive tasks.',
      backstory: 'Former operations lead with a love for tooling.'
    };

    mockedAxios.post.mockResolvedValueOnce({
      data: [
        { ...newAgent, source: 'user', userIndex: 0 }
      ]
    });

    renderPanel();

    await screen.findByText('Add an agent');

    await userEvent.type(screen.getByLabelText(/Agent name/i), newAgent.name);
    await userEvent.type(screen.getByLabelText(/Role/i), newAgent.role);
    await userEvent.type(screen.getByLabelText(/Goal/i), newAgent.goal);
    await userEvent.type(screen.getByLabelText(/Backstory/i), newAgent.backstory);

    await userEvent.click(screen.getByRole('button', { name: /Add Agent/i }));

    await waitFor(() => {
      expect(mockedAxios.post).toHaveBeenCalledWith(API_ENDPOINT, newAgent);
    });

    await screen.findByText(/Agent added to the library/i);
    expect(screen.getByText(newAgent.name)).toBeInTheDocument();
  });

  test('shows inline validation errors when fields are missing', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: [] });

    renderPanel();

    await screen.findByText('Add an agent');

    await userEvent.click(screen.getByRole('button', { name: /Add Agent/i }));

    await screen.findByText(/Please fix the highlighted fields/i);
    expect(screen.getAllByText(/is required\./i).length).toBeGreaterThanOrEqual(4);
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  test('allows editing of user-defined agents', async () => {
    const existingAgents = [
      { name: 'Discovery Researcher', role: 'Analyst', goal: 'Find insights', backstory: 'Curious explorer.', source: 'curated' },
      {
        name: 'Custom Analyst',
        role: 'Special Projects Researcher',
        goal: 'Deliver bespoke insights.',
        backstory: 'You prototype new methodologies.',
        source: 'user',
        userIndex: 0
      }
    ];

    mockedAxios.get.mockResolvedValueOnce({ data: existingAgents });

    const updatedAgent = {
      name: 'Updated Analyst',
      role: 'Lead Researcher',
      goal: 'Share crisp updates.',
      backstory: 'You translate findings for leadership.'
    };

    mockedAxios.put.mockResolvedValueOnce({
      data: [
        existingAgents[0],
        { ...updatedAgent, source: 'user', userIndex: 0 }
      ]
    });

    renderPanel();

    await screen.findByText('Custom Analyst');

    await userEvent.click(screen.getByRole('button', { name: /Edit Custom Analyst/i }));

    expect(screen.getByRole('heading', { name: /Edit agent/i })).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText(/Agent name/i));
    await userEvent.type(screen.getByLabelText(/Agent name/i), updatedAgent.name);
    await userEvent.clear(screen.getByLabelText(/Role/i));
    await userEvent.type(screen.getByLabelText(/Role/i), updatedAgent.role);
    await userEvent.clear(screen.getByLabelText(/Goal/i));
    await userEvent.type(screen.getByLabelText(/Goal/i), updatedAgent.goal);
    await userEvent.clear(screen.getByLabelText(/Backstory/i));
    await userEvent.type(screen.getByLabelText(/Backstory/i), updatedAgent.backstory);

    await userEvent.click(screen.getByRole('button', { name: /Save changes/i }));

    await waitFor(() => {
      expect(mockedAxios.put).toHaveBeenCalledWith(PUT_ENDPOINT, updatedAgent);
    });

    await screen.findByText(/Agent updated\./i);
    expect(screen.getByRole('heading', { name: /Add an agent/i })).toBeInTheDocument();
    expect(screen.getByText(updatedAgent.name)).toBeInTheDocument();
  });

  test('allows deleting user-defined agents', async () => {
    const existingAgents = [
      { name: 'Discovery Researcher', role: 'Analyst', goal: 'Find insights', backstory: 'Curious explorer.', source: 'curated' },
      {
        name: 'Custom Analyst',
        role: 'Special Projects Researcher',
        goal: 'Deliver bespoke insights.',
        backstory: 'You prototype new methodologies.',
        source: 'user',
        userIndex: 0
      }
    ];

    mockedAxios.get.mockResolvedValueOnce({ data: existingAgents });

    mockedAxios.delete.mockResolvedValueOnce({
      data: [existingAgents[0]]
    });

    renderPanel();

    await screen.findByText('Custom Analyst');

    await userEvent.click(screen.getByRole('button', { name: /Delete Custom Analyst/i }));

    await waitFor(() => {
      expect(mockedAxios.delete).toHaveBeenCalledWith(DELETE_ENDPOINT);
    });

    await screen.findByText(/Agent removed from the library/i);
    expect(screen.queryByText('Custom Analyst')).not.toBeInTheDocument();
  });
});
