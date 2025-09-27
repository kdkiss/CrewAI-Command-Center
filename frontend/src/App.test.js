import React from 'react';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import io from 'socket.io-client';
import { MemoryRouter } from 'react-router-dom';
import CrewAIManager from './features/crews/components/crewManager/CrewAIManager.jsx';

// By creating src/__mocks__/socket.io-client.js, Jest will automatically use it.
// We can import the mock instance from our manual mock file to use in tests.
const { mockSocket } = io;
const API_BASE = '/api';

const baseSystemStats = {
  status: 'success',
  cpu: { usage: 12.3, cores: 4, frequency: '2.40 GHz' },
  memory: { used: 8.2, total: 16, percent: 51.2 },
  uptime: 12345,
  boot_time: new Date().toISOString(),
  os: 'TestOS',
  python_version: '3.11.0'
};

jest.mock('axios');
const mockedAxios = axios;

jest.mock('@monaco-editor/react', () => {
  const React = require('react');
  return React.forwardRef(({ value, onChange, onMount, height, style, ...rest }, ref) => {
    React.useEffect(() => {
      if (onMount) {
        onMount(
          {
            focus: () => {},
          },
          null
        );
      }
    }, [onMount]);

    return React.createElement('textarea', {
      ...rest,
      ref,
      value: value ?? '',
      onChange: (event) => onChange?.(event.target.value, event),
      style: { ...(style || {}), height },
    });
  });
}, { virtual: true });

jest.mock('./hooks/useSystemStats');
const { default: mockUseSystemStats, mockRefreshSystemStats } = jest.requireMock('./hooks/useSystemStats');

const createMockSystemStats = () => ({
  stats: {
    ...baseSystemStats,
    history: {
      status: 'success',
      window: '1h',
      available_windows: ['1h', '24h'],
      metrics: {
        'cpu.usage': [
          { timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(), value: 20 },
          { timestamp: new Date().toISOString(), value: 25 }
        ],
        'memory.percent': [
          { timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(), value: 45 },
          { timestamp: new Date().toISOString(), value: 55 }
        ]
      },
      sample_count: 4
    }
  },
  error: null,
  isLoading: false,
  lastUpdated: new Date(),
  refresh: mockRefreshSystemStats
});

mockUseSystemStats.mockImplementation(createMockSystemStats);

jest.mock('./hooks/useSystemStatsHistory');
const {
  default: mockUseSystemStatsHistory,
  mockRefreshHistory,
  mockSetHistoryWindow
} = jest.requireMock('./hooks/useSystemStatsHistory');

const createMockSystemStatsHistory = () => ({
  history: {
    window: '1h',
    availableWindows: ['1h', '24h'],
    datasets: {
      'cpu.usage': [
        { timestamp: new Date(Date.now() - 5 * 60 * 1000), value: 20 },
        { timestamp: new Date(), value: 25 }
      ],
      'memory.percent': [
        { timestamp: new Date(Date.now() - 5 * 60 * 1000), value: 45 },
        { timestamp: new Date(), value: 55 }
      ]
    },
    sampleCount: 4
  },
  datasets: {
    'cpu.usage': [
      { timestamp: new Date(Date.now() - 5 * 60 * 1000), value: 20 },
      { timestamp: new Date(), value: 25 }
    ],
    'memory.percent': [
      { timestamp: new Date(Date.now() - 5 * 60 * 1000), value: 45 },
      { timestamp: new Date(), value: 55 }
    ]
  },
  availableWindows: ['1h', '24h'],
  window: '1h',
  setWindow: mockSetHistoryWindow,
  hasData: true,
  sampleCount: 4,
  isLoading: false,
  lastUpdated: new Date(),
  error: null,
  refresh: mockRefreshHistory,
  setError: jest.fn()
});

mockUseSystemStatsHistory.mockImplementation(createMockSystemStatsHistory);


const mockCrews = [
  {
    id: 'crew-1',
    name: 'Test Crew 1',
    description: 'Description 1',
    icon: 'rocket',
    inputs: { topic: 'AI' },
    agents: [{ role: 'Test Agent' }],
    tasks: [{ name: 'Test Task' }],
    agent_order: ['agent_alpha', 'agent_beta'],
    task_order: ['task_alpha', 'task_beta']
  },
  {
    id: 'crew-2',
    name: 'Test Crew 2',
    description: 'Description 2',
    icon: 'circle',
    inputs: { query: 'Web3' },
    agents: [{ role: 'Another Agent' }],
    tasks: [{ name: 'Another Task' }],
    agent_order: ['agent_alpha'],
    task_order: ['task_alpha']
  },
  {
    id: 'crew-typed',
    name: 'Typed Crew',
    description: 'Crew with typed inputs',
    icon: 'triangle',
    inputs: {
      max_retries: {
        type: 'integer',
        required: true,
        min: 0,
        max: 5,
        default: 2,
        description: 'Maximum retry attempts.'
      },
      launch_date: {
        type: 'date',
        required: true,
        min: '2024-01-01',
        max: '2024-12-31',
        default: '2024-06-01'
      },
      enable_notifications: {
        type: 'boolean',
        required: false,
        default: false,
        description: 'Send notifications when completed.'
      },
      execution_mode: {
        type: 'string',
        required: true,
        options: [
          { label: 'Standard', value: 'standard' },
          { label: 'Experimental', value: 'experimental' }
        ],
        default: 'standard'
      }
    },
    agents: [{ role: 'Typed Agent' }],
    tasks: [{ name: 'Typed Task' }],
    agent_order: ['agent_alpha'],
    task_order: ['task_alpha']
  }
];

const mockYamlContent = 'agents:\n  - name: Test Agent';
const mockAgentsYaml = `
agent_alpha:
  name: agent_alpha
  role: Analyst
  goal: Research the market
  backstory: Experienced analyst
agent_beta:
  name: agent_beta
  role: Strategist
  goal: Define next steps
  backstory: Seasoned strategist
`;
const mockTasksYaml = `
task_alpha:
  description: Initial research
  expected_output: Research summary
task_beta:
  description: Draft strategy
  expected_output: Strategy outline
`;
const mockEnvFiles = ['.env'];
const mockEnvContent = 'API_KEY=123';
const mockAgentLibrary = [
  {
    name: 'Discovery Researcher',
    role: 'Market Trend Analyst',
    goal: 'Identify the most important developments.',
    backstory: 'You study new markets every week.'
  },
  {
    name: 'Insight Synthesizer',
    role: 'Executive Briefing Specialist',
    goal: 'Summarize signals for decision makers.',
    backstory: 'You are trusted with high-stakes communications.'
  }
];

const mockTemplateCatalog = [
  {
    id: 'research',
    name: 'Insight Research Crew',
    description: 'Two-step research workflow.',
    icon: '🧠',
    agentCount: 2,
    taskCount: 2,
    tags: ['analysis']
  },
  {
    id: 'writing',
    name: 'Editorial Writing Crew',
    description: 'Long-form writing workflow.',
    icon: '✍️',
    agentCount: 3,
    taskCount: 3,
    tags: ['content']
  }
];

const mockTemplateDefinitions = {
  research: {
    id: 'research',
    name: 'Insight Research Crew',
    description: 'Two-step research workflow.',
    icon: '🧠',
    tags: ['analysis'],
    agents: [
      {
        name: 'Lead Researcher',
        role: 'Senior Trend Researcher',
        goal: 'Discover insights about {topic}.',
        backstory: 'Experienced researcher.'
      },
      {
        name: 'Insight Analyst',
        role: 'Insight Analyst',
        goal: 'Summarize findings for stakeholders.',
        backstory: 'Seasoned analyst.'
      }
    ],
    tasks: [
      {
        name: 'gather_sources',
        description: 'Collect recent sources.',
        expected_output: 'Annotated source list.',
        agent: 'Lead Researcher'
      },
      {
        name: 'synthesize_brief',
        description: 'Summarize insights.',
        expected_output: 'Executive brief.',
        agent: 'Insight Analyst',
        dependencies: ['gather_sources']
      }
    ],
    agentOrder: ['Lead Researcher', 'Insight Analyst'],
    taskOrder: ['gather_sources', 'synthesize_brief'],
    metadata: {
      name: 'Insight Research Crew',
      description: 'Two-step research workflow.',
      icon: '🧠',
      agent_order: ['Lead Researcher', 'Insight Analyst'],
      task_order: ['gather_sources', 'synthesize_brief'],
      tags: ['analysis']
    }
  }
};

const mockSystemStats = {
  status: 'success',
  cpu: { usage: 12.3, cores: 4, frequency: '2.40 GHz' },
  memory: { used: 8.2, total: 16, percent: 51.2 },
  uptime: 12345,
  boot_time: new Date().toISOString(),
};

describe('App module exports', () => {
  test('re-exports CrewAIManager component and API_BASE', () => {
    jest.isolateModules(() => {
      const AppModule = require('./App');
      const CrewModule = require('./features/crews/components/crewManager/CrewAIManager.jsx');

      expect(AppModule.default).toBe(CrewModule.default);
      expect(AppModule.API_BASE).toBe(CrewModule.API_BASE);
    });
  });
});

describe('configuration overrides', () => {
  const originalApiBase = process.env.REACT_APP_API_BASE_URL;
  const originalWsUrl = process.env.REACT_APP_WS_URL;

  afterEach(() => {
    if (originalApiBase === undefined) {
      delete process.env.REACT_APP_API_BASE_URL;
    } else {
      process.env.REACT_APP_API_BASE_URL = originalApiBase;
    }

    if (originalWsUrl === undefined) {
      delete process.env.REACT_APP_WS_URL;
    } else {
      process.env.REACT_APP_WS_URL = originalWsUrl;
    }
  });

  test('computes API_BASE from REACT_APP_API_BASE_URL', () => {
    const customBase = 'https://api.example.com/custom/';
    process.env.REACT_APP_API_BASE_URL = customBase;

    jest.isolateModules(() => {
      const AppModule = require('./App');
      expect(AppModule.API_BASE).toBe('https://api.example.com/custom');
    });
  });

  test('falls back to same-origin API path for service-style hostnames', () => {
    process.env.REACT_APP_API_BASE_URL = 'http://backend:8001/api';

    jest.isolateModules(() => {
      const AppModule = require('./App');
      expect(AppModule.API_BASE).toBe('/api');
    });
  });

  test('resolveSocketOptions defaults to same-origin socket path', () => {
    delete process.env.REACT_APP_API_BASE_URL;
    delete process.env.REACT_APP_WS_URL;

    jest.isolateModules(() => {
      const { resolveSocketOptions } = require('./config/apiConfig.js');
      expect(resolveSocketOptions()).toEqual({ url: null, options: { path: '/socket.io' } });
    });
  });

  test('resolveSocketOptions derives path from API base prefix', () => {
    process.env.REACT_APP_API_BASE_URL = 'https://api.example.com/nested/api';
    delete process.env.REACT_APP_WS_URL;

    jest.isolateModules(() => {
      const { resolveSocketOptions } = require('./config/apiConfig.js');
      expect(resolveSocketOptions()).toEqual({ url: 'https://api.example.com', options: { path: '/nested/socket.io' } });
    });
  });

  test('resolveSocketOptions respects explicit WebSocket URL with custom path', () => {
    process.env.REACT_APP_WS_URL = 'https://ws.example.com/custom-socket/';

    jest.isolateModules(() => {
      const { resolveSocketOptions } = require('./config/apiConfig.js');
      expect(resolveSocketOptions()).toEqual({ url: 'https://ws.example.com', options: { path: '/custom-socket' } });
    });
  });

  test('resolveSocketOptions falls back to same-origin when REACT_APP_WS_URL targets an internal hostname', () => {
    process.env.REACT_APP_WS_URL = 'http://backend:8001/socket.io';

    jest.isolateModules(() => {
      const { resolveSocketOptions } = require('./config/apiConfig.js');
      expect(resolveSocketOptions()).toEqual({ url: null, options: { path: '/socket.io' } });
    });
  });

  test('resolveSocketOptions supports relative WebSocket paths', () => {
    process.env.REACT_APP_WS_URL = 'alt-socket';

    jest.isolateModules(() => {
      const { resolveSocketOptions } = require('./config/apiConfig.js');
      expect(resolveSocketOptions()).toEqual({ url: null, options: { path: '/alt-socket' } });
    });
  });
});


// Helper function to wait for the initial crew load, scoped to the sidebar
const waitForCrews = async () => {
  await waitFor(() => {
    expect(getCrewFetchCalls().length).toBeGreaterThan(0);
  });

  await waitFor(() => {
    const sidebar = screen.queryByRole('complementary');

    if (sidebar) {
      expect(within(sidebar).getByText('Test Crew 1')).toBeInTheDocument();
      expect(within(sidebar).getByText('Test Crew 2')).toBeInTheDocument();
      expect(within(sidebar).getByText('Typed Crew')).toBeInTheDocument();
      return;
    }

    const crewNameVisible = ['Test Crew 1', 'Test Crew 2', 'Typed Crew']
      .some(label => screen.queryAllByText(label).length > 0);

    expect(crewNameVisible).toBe(true);
  });
};

const getCrewFetchCalls = () => mockedAxios.get.mock.calls.filter(([url]) => url.endsWith('/crews'));

const clickSidebarTab = async (tabLabel) => {
  const sidebar = screen.getByRole('complementary');
  const tab = within(sidebar).getByRole('link', { name: new RegExp(`^${tabLabel}$`, 'i') });
  await act(async () => {
    userEvent.click(tab);
  });
};

const findSidebarButton = async (labelPattern) => {
  const sidebar = screen.getByRole('complementary');
  return within(sidebar).findByRole('button', { name: labelPattern });
};

const clickSidebarButton = async (labelPattern) => {
  const button = await findSidebarButton(labelPattern);
  await act(async () => {
    userEvent.click(button);
  });
};

const openCrewDetail = async (labelPattern = /Test Crew 1/i) => {
  await clickSidebarButton(labelPattern);

  const headingPattern = labelPattern instanceof RegExp
    ? labelPattern
    : new RegExp(`^${labelPattern}$`, 'i');

  await screen.findAllByRole('heading', { name: headingPattern });
};

const getSocketHandler = (event) => mockSocket.on.mock.calls.find(([name]) => name === event)?.[1];

const renderWithRouter = (ui, { route = '/crews' } = {}) => {
  window.history.pushState({}, 'Test page', route);
  return render(
    <MemoryRouter initialEntries={[route]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      {ui}
    </MemoryRouter>
  );
};

describe('CrewAIManager - Comprehensive Test Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSocket.on.mockClear();
    mockSocket.emit.mockClear();
    mockSocket.disconnect.mockClear();
    mockSocket.handlers = {};
    window.localStorage.clear();
    mockRefreshSystemStats.mockClear();
    mockRefreshHistory.mockClear();
    mockSetHistoryWindow.mockClear();
    mockUseSystemStats.mockImplementation(createMockSystemStats);
    mockUseSystemStatsHistory.mockImplementation(createMockSystemStatsHistory);

    // Default success mocks
    mockedAxios.get.mockImplementation((url) => {
      if (url.endsWith('/crew-templates')) {
        return Promise.resolve({ data: mockTemplateCatalog });
      }
      if (url.endsWith('/agents') && !url.includes('/crews/')) {
        return Promise.resolve({ data: mockAgentLibrary });
      }
      if (url.includes('/crew-templates/')) {
        const templateId = decodeURIComponent(url.split('/').pop());
        const payload = mockTemplateDefinitions[templateId];
        if (!payload) {
          return Promise.reject(new Error('template not found'));
        }
        return Promise.resolve({ data: payload });
      }
      if (url.endsWith('/crews')) {
        return Promise.resolve({ data: mockCrews });
      }
      if (url.endsWith('/activity')) {
        return Promise.resolve({ data: { status: 'success', events: [] } });
      }
      if (url.endsWith('/system/stats')) {
        return Promise.resolve({ data: mockSystemStats });
      }
      if (url.includes('/env-files')) {
        return Promise.resolve({ data: { success: true, files: mockEnvFiles } });
      }
      if (url.includes('/env/')) {
        return Promise.resolve({ data: { success: true, content: mockEnvContent } });
      }
      if (url.includes('/crews/') && url.endsWith('/agents')) {
        return Promise.resolve({ data: { success: true, content: mockAgentsYaml } });
      }
      if (url.includes('/crews/') && url.endsWith('/tasks')) {
        return Promise.resolve({ data: { success: true, content: mockTasksYaml } });
      }
      if (url.includes('.yaml')) {
        return Promise.resolve({ data: { success: true, content: mockYamlContent } });
      }
      return Promise.reject(new Error('not found'));
    });

    mockedAxios.post.mockResolvedValue({ data: { success: true } });
    mockedAxios.put.mockResolvedValue({ data: { success: true } });
    mockedAxios.delete.mockResolvedValue({ data: { success: true } });
  });

  test('renders the component and loads initial crews', async () => {
    renderWithRouter(<CrewAIManager />);
    await waitForCrews();
    // Assertions are now in the helper
  });

  test('allows selecting a crew and displays its details', async () => {
    renderWithRouter(<CrewAIManager />);
    await waitForCrews();

    await openCrewDetail(/Test Crew 2/i);

    const headings = screen.getAllByRole('heading', { name: /Test Crew 2/i });
    expect(headings.length).toBeGreaterThan(0);
    expect(screen.getAllByText('Description 2').length).toBeGreaterThan(0);
    expect(await screen.findByRole('button', { name: /Run Crew/i })).toBeInTheDocument();
  });

  test('hydrates crew details when deep linking to the detail route', async () => {
    renderWithRouter(<CrewAIManager />, { route: '/crews/crew-2' });
    await waitForCrews();

    const headings = await screen.findAllByRole('heading', { name: /Test Crew 2/i });
    expect(headings.length).toBeGreaterThan(0);
    expect(screen.getAllByText('Description 2').length).toBeGreaterThan(0);
    expect(await screen.findByRole('button', { name: /Run Crew/i })).toBeInTheDocument();
  });

  describe('Run and Stop Crew Functionality', () => {
    test('clicking "Run Crew" emits "startCrew" and shows pending state until started', async () => {
      renderWithRouter(<CrewAIManager />);
      await waitForCrews();

      await openCrewDetail(/Test Crew 1/i);

      await waitFor(() => {
        expect(getSocketHandler('crew_started')).toBeInstanceOf(Function);
      });

      const runButton = screen.getByRole('button', { name: /Run Crew/i });
      await act(async () => { userEvent.click(runButton); });

      const startingButton = await screen.findByRole('button', { name: /Starting.../i });
      expect(startingButton).toBeDisabled();

      act(() => {
        getSocketHandler('crew_started')?.({ crew_id: 'crew-1' });
      });

      await waitFor(() => {
        expect(mockSocket.emit).toHaveBeenCalledWith('startCrew', { crew_id: 'crew-1', inputs: { topic: 'AI' } });
      });

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /Starting.../i })).not.toBeInTheDocument();
      });
    });

    test('confirming "Stop Crew" emits "stopCrew" and shows pending state until stopped', async () => {
      renderWithRouter(<CrewAIManager />);
      await waitForCrews();

      await openCrewDetail(/Test Crew 1/i);

      const runButton = screen.getByRole('button', { name: /Run Crew/i });
      await act(async () => { userEvent.click(runButton); });
      act(() => {
        getSocketHandler('crew_started')?.({ crew_id: 'crew-1' });
      });

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /Starting.../i })).not.toBeInTheDocument();
      });

      const stopButton = screen.getByRole('button', { name: /Stop Crew/i });
      await act(async () => { userEvent.click(stopButton); });

      const dialog = await screen.findByRole('dialog', { name: /Stop Crew/i });
      expect(dialog).toBeInTheDocument();
      expect(within(dialog).getByText(/Are you sure you want to stop/)).toBeInTheDocument();
      expect(mockSocket.emit.mock.calls.filter(([event]) => event === 'stopCrew')).toHaveLength(0);

      const confirmButton = within(dialog).getByRole('button', { name: /Stop Crew/i });
      await act(async () => { userEvent.click(confirmButton); });

      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: /Stop Crew/i })).not.toBeInTheDocument();
      });

      const stoppingButton = await screen.findByRole('button', { name: /Stopping.../i });
      expect(stoppingButton).toBeDisabled();

      await waitFor(() => {
        expect(mockSocket.emit).toHaveBeenCalledWith('stopCrew', { crew_id: 'crew-1' });
      });

      act(() => {
        getSocketHandler('crew_stopped')?.({ crew_id: 'crew-1' });
      });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Run Crew/i })).toBeInTheDocument();
      });
    });

    test('cancelling "Stop Crew" closes the dialog without emitting', async () => {
      renderWithRouter(<CrewAIManager />);
      await waitForCrews();

      await openCrewDetail(/Test Crew 1/i);

      const runButton = screen.getByRole('button', { name: /Run Crew/i });
      await act(async () => { userEvent.click(runButton); });
      act(() => {
        getSocketHandler('crew_started')?.({ crew_id: 'crew-1' });
      });

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /Starting.../i })).not.toBeInTheDocument();
      });

      const stopButton = screen.getByRole('button', { name: /Stop Crew/i });
      await act(async () => { userEvent.click(stopButton); });

      const dialog = await screen.findByRole('dialog', { name: /Stop Crew/i });
      expect(dialog).toBeInTheDocument();

      const cancelButton = within(dialog).getByRole('button', { name: /Keep Running/i });
      await act(async () => { userEvent.click(cancelButton); });

      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: /Stop Crew/i })).not.toBeInTheDocument();
      });

      expect(mockSocket.emit.mock.calls.filter(([event]) => event === 'stopCrew')).toHaveLength(0);
      expect(screen.getByRole('button', { name: /Stop Crew/i })).toBeInTheDocument();
    });

    test('pending start state clears on crew_error event', async () => {
      renderWithRouter(<CrewAIManager />);
      await waitForCrews();

      await openCrewDetail(/Test Crew 1/i);

      const runButton = screen.getByRole('button', { name: /Run Crew/i });
      await act(async () => { userEvent.click(runButton); });

      await screen.findByRole('button', { name: /Starting.../i });

      act(() => {
        getSocketHandler('crew_error')?.({ crew_id: 'crew-1', error: 'Boom!' });
      });

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /Starting.../i })).not.toBeInTheDocument();
      });
    });

    test('displays logs received from the socket', async () => {
      renderWithRouter(<CrewAIManager />);
      await waitForCrews();

      const sidebar = screen.getByRole('complementary');
      const crew1Button = within(sidebar).getAllByText('Test Crew 1')[0];
      await act(async () => {
        userEvent.click(crew1Button);
      });

      await waitFor(() => {
        expect(getSocketHandler('crew_log')).toBeInstanceOf(Function);
      });

      act(() => {
        getSocketHandler('crew_log')?.({
          crewId: 'crew-1',
          message: 'Test log message',
          level: 'info',
          timestamp: new Date().toISOString(),
          agent: 'Agent Smith'
        });
      });

      await waitFor(() => {
        expect(screen.getByText(/Test log message/i)).toBeInTheDocument();
      });
    });

    test('refreshes crew list when crews_updated event arrives', async () => {
      renderWithRouter(<CrewAIManager />);
      await waitForCrews();

      await openCrewDetail(/Test Crew 1/i);

      await waitFor(() => {
        expect(getSocketHandler('crews_updated')).toBeInstanceOf(Function);
      });

      const updatedCrews = [
        {
          id: 'crew-3',
          name: 'New Crew',
          description: 'Brand new crew',
          agents: [],
          tasks: []
        }
      ];

      act(() => {
        getSocketHandler('crews_updated')?.(updatedCrews);
      });

      const backButton = await screen.findByRole('button', { name: /Back to crews/i });
      await act(async () => {
        userEvent.click(backButton);
      });

      await waitFor(() => {
        const sidebar = screen.getByRole('complementary');
        expect(within(sidebar).getByText('New Crew')).toBeInTheDocument();
        expect(within(sidebar).queryByText('Test Crew 1')).not.toBeInTheDocument();
      });

      await openCrewDetail(/New Crew/i);
    });

    test('updates existing crew details when crew_updated event arrives', async () => {
      renderWithRouter(<CrewAIManager />);
      await waitForCrews();

      await openCrewDetail(/Test Crew 1/i);

      await waitFor(() => {
        expect(getSocketHandler('crew_updated')).toBeInstanceOf(Function);
      });

      act(() => {
        getSocketHandler('crew_updated')?.({
          id: 'crew-1',
          name: 'Renamed Crew 1',
          description: 'Updated description',
          agents: mockCrews[0].agents,
          tasks: mockCrews[0].tasks
        });
      });

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Renamed Crew 1', level: 2 })).toBeInTheDocument();
      });

      const backButton = await screen.findByRole('button', { name: /Back to crews/i });
      await act(async () => {
        userEvent.click(backButton);
      });

      const sidebar = screen.getByRole('complementary');
      await waitFor(() => {
        expect(within(sidebar).getByText('Renamed Crew 1')).toBeInTheDocument();
      });
    });
  });

  describe('Crew input metadata handling', () => {
    test('renders appropriate controls for typed metadata inputs', async () => {
      renderWithRouter(<CrewAIManager />);
      await waitForCrews();

      const sidebar = screen.getByRole('complementary');
      const typedCrewButton = within(sidebar).getAllByText('Typed Crew')[0];
      await act(async () => {
        userEvent.click(typedCrewButton);
      });

      const maxRetriesInput = await screen.findByRole('spinbutton', { name: /Max Retries/i });
      expect(maxRetriesInput).toBeInTheDocument();

      const enableNotifications = screen.getByRole('checkbox', { name: /Enable Notifications/i });
      expect(enableNotifications).toBeInTheDocument();

      const launchDateInput = screen.getByLabelText(/Launch Date/i);
      expect(launchDateInput).toHaveAttribute('type', 'date');

      const executionModeSelect = screen.getByRole('combobox', { name: /Execution Mode/i });
      expect(executionModeSelect.tagName.toLowerCase()).toBe('select');
      expect(within(executionModeSelect).getByRole('option', { name: 'Standard' })).toBeInTheDocument();
      expect(within(executionModeSelect).getByRole('option', { name: 'Experimental' })).toBeInTheDocument();
    });

    test('requires valid metadata-driven inputs before emitting startCrew', async () => {
      renderWithRouter(<CrewAIManager />);
      await waitForCrews();

      const sidebar = screen.getByRole('complementary');
      const typedCrewButton = within(sidebar).getAllByText('Typed Crew')[0];
      await act(async () => {
        userEvent.click(typedCrewButton);
      });

      const maxRetriesInput = await screen.findByRole('spinbutton', { name: /Max Retries/i });
      const launchDateInput = screen.getByLabelText(/Launch Date/i);
      const executionModeSelect = screen.getByRole('combobox', { name: /Execution Mode/i });
      const enableNotifications = screen.getByRole('checkbox', { name: /Enable Notifications/i });
      const runButton = screen.getByRole('button', { name: /Run Crew/i });

      await act(async () => {
        await userEvent.clear(maxRetriesInput);
      });
      await waitFor(() => {
        expect(screen.getByText('This field is required.')).toBeInTheDocument();
      });

      await act(async () => {
        await userEvent.type(maxRetriesInput, '9');
      });
      await waitFor(() => {
        expect(screen.getByText('Value must be at most 5.')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.change(launchDateInput, { target: { value: '2023-12-31' } });
      });
      await waitFor(() => {
        expect(screen.getByText('Date must be on or after the minimum date.')).toBeInTheDocument();
      });

      await act(async () => {
        userEvent.click(runButton);
      });

      expect(mockSocket.emit).not.toHaveBeenCalled();

      await act(async () => {
        await userEvent.clear(maxRetriesInput);
        await userEvent.type(maxRetriesInput, '0');
      });
      await waitFor(() => {
        expect(screen.queryByText('Value must be at most 5.')).not.toBeInTheDocument();
        expect(screen.queryByText('This field is required.')).not.toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.change(launchDateInput, { target: { value: '2024-05-01' } });
      });
      await waitFor(() => {
        expect(screen.queryByText('Date must be on or after the minimum date.')).not.toBeInTheDocument();
      });

      await act(async () => {
        await userEvent.selectOptions(executionModeSelect, 'experimental');
      });

      await act(async () => {
        await userEvent.click(enableNotifications);
      });
      await act(async () => {
        await userEvent.click(enableNotifications);
      });

      await act(async () => {
        await userEvent.click(runButton);
      });

      await waitFor(() => {
        expect(mockSocket.emit).toHaveBeenCalledWith('startCrew', {
          crew_id: 'crew-typed',
          inputs: {
            max_retries: 0,
            launch_date: '2024-05-01',
            enable_notifications: false,
            execution_mode: 'experimental'
          }
        });
      });
    });
  });

  test('selecting a crew in the config view keeps the configuration editor visible', async () => {
    renderWithRouter(<CrewAIManager />, { route: '/config' });
    await waitForCrews();

    await waitFor(() => {
      expect(screen.getAllByText(/Configuration/i).length).toBeGreaterThan(0);
    });

    const crewSelect = screen.getByLabelText(/Select crew/i);

    await act(async () => {
      fireEvent.change(crewSelect, { target: { value: 'crew-2' } });
    });

    expect(screen.getAllByText(/Configuration/i).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /Back to crews/i })).not.toBeInTheDocument();

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalledWith(expect.stringContaining('/crews/crew-2/env-files'));
    });
  });

  describe('YAML Editor Functionality', () => {
    test('opens, edits, and saves agents.yaml', async () => {
      renderWithRouter(<CrewAIManager />);
      await waitForCrews();

      // Switch to config tab
      await clickSidebarTab('config');

      // Open editor
      await clickSidebarButton(/Edit agents\.yaml/i);
      await waitFor(() => expect(screen.getByText('Editing agents.yaml')).toBeInTheDocument());
      await waitFor(() =>
        expect(screen.queryByTestId('config-editor-skeleton')).not.toBeInTheDocument()
      );

      // Edit content
      const editor = screen.getByTestId('config-editor');
      fireEvent.change(editor, { target: { value: 'new yaml content' } });
      await waitFor(() => expect(editor).toHaveValue('new yaml content'));

      // Save
      await act(async () => { userEvent.click(screen.getByRole('button', { name: /Save/i })); });
      await waitFor(() => {
        expect(mockedAxios.post).toHaveBeenCalledWith(
          expect.stringContaining('/crews/crew-1/agents.yaml'),
          { content: 'new yaml content' }
        );
      });
      await screen.findByText(/Configuration Saved/i);
    });

    test('cancels editing yaml', async () => {
      renderWithRouter(<CrewAIManager />);
      await waitForCrews();

      // Switch to config tab and open editor
      await clickSidebarTab('config');
      await clickSidebarButton(/Edit agents\.yaml/i);
      await waitFor(() => expect(screen.getByText('Editing agents.yaml')).toBeInTheDocument());
      await waitFor(() =>
        expect(screen.queryByTestId('config-editor-skeleton')).not.toBeInTheDocument()
      );

      // Cancel
      await act(async () => { userEvent.click(screen.getByRole('button', { name: /Cancel/i })); });
      await waitFor(() => {
        expect(screen.queryByText('Editing agents.yaml')).not.toBeInTheDocument();
      });
    });

    test('autosaves drafts, restores versions, and clears local history', async () => {
      jest.useFakeTimers();
      try {
        renderWithRouter(<CrewAIManager />);
        await waitForCrews();

        await clickSidebarTab('config');
        await clickSidebarButton(/Edit agents\.yaml/i);

        await waitFor(() => expect(screen.getByText('Editing agents.yaml')).toBeInTheDocument());
        await waitFor(() =>
          expect(screen.queryByText('Loading YAML content...')).not.toBeInTheDocument()
        );

        const editor = screen.getByTestId('config-editor');
        await waitFor(() => expect(editor).toHaveValue(mockYamlContent));

        await act(async () => {
          jest.advanceTimersByTime(650);
        });

        await waitFor(() => {
          expect(screen.getByTestId('autosave-status')).toHaveTextContent(/Autosaved|Last autosaved/i);
        });

        fireEvent.change(editor, { target: { value: 'updated yaml content' } });
        await waitFor(() => expect(editor).toHaveValue('updated yaml content'));

        await act(async () => {
          jest.advanceTimersByTime(650);
        });

        await waitFor(() => {
          expect(screen.getByTestId('autosave-status')).toHaveTextContent(/Last autosaved/i);
        });

        const storageKey = 'crew-config:crew-1:yaml:agents.yaml';
        await waitFor(() => {
          const stored = window.localStorage.getItem(storageKey);
          expect(stored).toBe('updated yaml content');
        });

        const getVersionsPanel = () => screen.getByTestId('autosave-versions');
        let versionsPanel = getVersionsPanel();
        await waitFor(() => {
          expect(within(versionsPanel).getAllByRole('listitem')).toHaveLength(2);
        });

        let versionItems = within(versionsPanel).getAllByRole('listitem');
        const originalItem = versionItems.find(item => item.textContent?.includes('Test Agent'));
        expect(originalItem).toBeTruthy();

        const restoreButton = within(originalItem).getByRole('button', { name: /Restore/i });
        await act(async () => {
          fireEvent.click(restoreButton);
        });

        await waitFor(() => {
          const storedDraft = window.localStorage.getItem(storageKey);
          expect(storedDraft).toBe(mockYamlContent);
        });

        versionsPanel = getVersionsPanel();
        versionItems = within(versionsPanel).getAllByRole('listitem');
        const clearButton = within(versionsPanel).getByRole('button', { name: /Clear drafts/i });
        await act(async () => {
          fireEvent.click(clearButton);
        });

        await waitFor(() => {
          const refreshedPanel = getVersionsPanel();
          expect(within(refreshedPanel).queryAllByRole('listitem')).toHaveLength(0);
          expect(within(refreshedPanel).getByText(/No autosaved drafts yet\./i)).toBeInTheDocument();
        });
      } finally {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
      }
    });
  });

  describe('Environment Editor Functionality', () => {
    test('opens, edits, and saves .env file', async () => {
      renderWithRouter(<CrewAIManager />);
      await waitForCrews();

      await clickSidebarTab('config');

      const envButton = await findSidebarButton(/Edit \.env/i);
      await act(async () => { userEvent.click(envButton); });

      await waitFor(() => expect(screen.getByText('Editing .env')).toBeInTheDocument());
      await waitFor(() =>
        expect(screen.queryByTestId('config-editor-skeleton')).not.toBeInTheDocument()
      );

      const editor = screen.getByTestId('config-editor');
      fireEvent.change(editor, { target: { value: 'API_KEY=456' } });
      await waitFor(() => expect(editor).toHaveValue('API_KEY=456'));

      await act(async () => { userEvent.click(screen.getByRole('button', { name: /Save/i })); });

      await waitFor(() => {
        expect(mockedAxios.post).toHaveBeenCalledWith(
          expect.stringContaining('/crews/crew-1/env/.env'),
          { content: 'API_KEY=456' }
        );
      });
      await screen.findByText(/Configuration Saved/i);
    });

    test('shows validation error for invalid environment content', async () => {
      renderWithRouter(<CrewAIManager />);
      await waitForCrews();

      await clickSidebarTab('config');

      const envButton = await findSidebarButton(/Edit \.env/i);
      await act(async () => { userEvent.click(envButton); });

      await waitFor(() => expect(screen.getByText('Editing .env')).toBeInTheDocument());
      await waitFor(() =>
        expect(screen.queryByTestId('config-editor-skeleton')).not.toBeInTheDocument()
      );

      const editor = screen.getByTestId('config-editor');
      fireEvent.change(editor, { target: { value: 'INVALID LINE' } });
      await waitFor(() => expect(editor).toHaveValue('INVALID LINE'));

      await act(async () => { userEvent.click(screen.getByRole('button', { name: /Save/i })); });

      expect(mockedAxios.post).not.toHaveBeenCalled();

      await screen.findByText(/Validation Error/i);
    });
  });

  describe('Error Handling', () => {
    test('handles error when fetching initial crews', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Network Error'));
      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      renderWithRouter(<CrewAIManager />);
      
      await waitFor(() => {
        // We can check for a state that indicates loading failed, e.g., no crews are displayed.
        expect(screen.queryByText('Test Crew 1')).not.toBeInTheDocument();
      });
      
      consoleSpy.mockRestore();
    });

    test('handles error when saving YAML', async () => {
      mockedAxios.post.mockRejectedValue({ response: { data: { detail: 'Invalid YAML format' } } });
      renderWithRouter(<CrewAIManager />);
      await waitForCrews();

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Open editor
      await clickSidebarTab('config');
      await clickSidebarButton(/Edit agents\.yaml/i);
      await waitFor(() => expect(screen.getByText('Editing agents.yaml')).toBeInTheDocument());

      // Attempt to save
      await act(async () => { userEvent.click(screen.getByRole('button', { name: /Save/i })); });

      await screen.findByText(/Save Failed/i);
      consoleSpy.mockRestore();
    });
  });

  describe('Header and Tab Functionality', () => {
    test('refresh crews button fetches crews again', async () => {
      renderWithRouter(<CrewAIManager />);
      await waitFor(() => expect(getCrewFetchCalls()).toHaveLength(1));

      await act(async () => { userEvent.click(screen.getByRole('button', { name: /Refresh Crews/i })); });

      await waitFor(() => expect(getCrewFetchCalls()).toHaveLength(2));
    });

    test('can switch to library tab', async () => {
      renderWithRouter(<CrewAIManager />);
      await waitForCrews();

      await clickSidebarTab('library');

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Agent Library/i })).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText('Discovery Researcher')).toBeInTheDocument();
      });
    });

    test('can switch to monitor tab', async () => {
      renderWithRouter(<CrewAIManager />);
      await waitForCrews();

      await clickSidebarTab('monitor');

      await waitFor(() => {
        const sidebar = screen.getByRole('complementary');
        expect(within(sidebar).getByText(/Active Crews/i)).toBeInTheDocument();
      });
    });

    test('can switch to activity tab', async () => {
      renderWithRouter(<CrewAIManager />);
      await waitForCrews();

      await clickSidebarTab('activity');

      await waitFor(() => {
        expect(screen.getByText(/Filter timeline/i)).toBeInTheDocument();
      });
    });

    test('desktop sidebar toggle hides and shows crew filters', async () => {
      renderWithRouter(<CrewAIManager />);
      await waitForCrews();

      const header = screen.getByRole('banner');
      const initialToggle = within(header).getByRole('button', { name: /Hide filters/i });
      expect(initialToggle).toHaveAttribute('aria-pressed', 'true');

      const sidebar = screen.getByRole('complementary');
      expect(within(sidebar).getByText('Test Crew 1')).toBeInTheDocument();

      await act(async () => {
        userEvent.click(initialToggle);
      });

      await waitFor(() => {
        expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
      });

      const reopenToggle = within(header).getByRole('button', { name: /Show filters/i });
      expect(reopenToggle).toHaveAttribute('aria-pressed', 'false');

      await act(async () => {
        userEvent.click(reopenToggle);
      });

      await waitFor(() => {
        const reopenedSidebar = screen.getByRole('complementary');
        expect(within(reopenedSidebar).getByText('Test Crew 1')).toBeInTheDocument();
      });
    });
  });

  describe('Activity Feed', () => {
    test('renders and updates with lifecycle and log events', async () => {
      renderWithRouter(<CrewAIManager />);
      await waitForCrews();

      await clickSidebarTab('activity');

      const mainRegion = screen.getByRole('main');

      await screen.findByText(/No activity yet/i);

      await waitFor(() => {
        expect(getSocketHandler('crew_log')).toBeDefined();
        expect(getSocketHandler('crew_started')).toBeDefined();
        expect(getSocketHandler('crew_error')).toBeDefined();
      });

      const crewLogHandler = getSocketHandler('crew_log');
      const crewStartedHandler = getSocketHandler('crew_started');
      const crewErrorHandler = getSocketHandler('crew_error');

      const logTimestamp = new Date('2024-04-01T12:00:00Z').toISOString();

      act(() => {
        crewLogHandler({
          crewId: 'crew-1',
          agent: 'Test Agent',
          message: 'Processing new lead',
          level: 'info',
          timestamp: logTimestamp
        });
      });

      act(() => {
        crewStartedHandler({ crew_id: 'crew-1' });
      });

      act(() => {
        crewErrorHandler({ crew_id: 'crew-2', error: 'Crew 2 failure detected' });
      });

      await within(mainRegion).findByText('Processing new lead');
      await within(mainRegion).findByText(/Test Crew 1 started\./i);
      await within(mainRegion).findByText(/Crew 2 failure detected/i);

      const alertsButton = screen.getByRole('button', { name: /Alerts & errors/i });
      await act(async () => {
        userEvent.click(alertsButton);
      });

      await within(mainRegion).findByText(/Crew 2 failure detected/i);
      expect(within(mainRegion).queryByText('Processing new lead')).not.toBeInTheDocument();

      const crewSelect = screen.getByLabelText(/Crew filter/i);
      await act(async () => {
        userEvent.selectOptions(crewSelect, 'crew-2');
      });

      await waitFor(() => expect(screen.getByText(/Showing 1 of 3 events/i)).toBeInTheDocument());

      const allButton = screen.getByRole('button', { name: /All activity/i });
      await act(async () => {
        userEvent.click(allButton);
      });
      await act(async () => {
        userEvent.selectOptions(crewSelect, 'all');
      });

      await within(mainRegion).findByText('Processing new lead');
    });
  });

  describe('Import Crew Functionality', () => {
    const validYaml = `
name: Imported Crew
description: A valid crew for testing.
agents:
  - name: Import Agent
    role: Test
    goal: Test
    backstory: Test
tasks:
  - name: Import Task
    description: Test
    expected_output: Test
`;
    const mockFile = new File([validYaml], 'crew.yaml', { type: 'application/x-yaml' });
    const invalidFile = new File(['not yaml'], 'invalid.yaml', { type: 'application/x-yaml' });
    let createElementSpy;
    let fileInput;

    beforeEach(() => {
      // Create a fresh input for each test
      fileInput = document.createElement('input');
      fileInput.type = 'file';
      const originalCreateElement = document.createElement;
      // Spy on createElement, returning our controlled input only for 'input' elements
      createElementSpy = jest.spyOn(document, 'createElement').mockImplementation((tagName) => {
        if (tagName === 'input') {
          return fileInput;
        }
        // For other elements, call the original createElement
        return originalCreateElement.call(document, tagName);
      });
    });

    afterEach(() => {
      // Restore the original implementation after each test to prevent pollution
      createElementSpy.mockRestore();
    });

    test('successfully imports a valid crew', async () => {
      mockedAxios.post.mockResolvedValue({ data: { success: true } });

      renderWithRouter(<CrewAIManager />);
      await waitForCrews();
      expect(getCrewFetchCalls()).toHaveLength(1);

      await act(async () => {
        userEvent.click(screen.getByRole('button', { name: /Import Crew/i }));
      });
      await act(async () => {
        Object.defineProperty(fileInput, 'files', { value: [mockFile] });
        fireEvent.change(fileInput);
      });

      await waitFor(() => {
        expect(mockedAxios.post).toHaveBeenCalledWith(
          expect.stringContaining('/crews/import'),
          expect.objectContaining({ name: 'Imported Crew' })
        );
        expect(getCrewFetchCalls()).toHaveLength(2); // Refresh triggered
      });
      const crewImportedToasts = await screen.findAllByText(/Crew Imported/i);
      expect(crewImportedToasts.length).toBeGreaterThan(0);
    });

    test('handles server error during file import', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Network Error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      renderWithRouter(<CrewAIManager />);
      await waitForCrews();
      
      await act(async () => {
        userEvent.click(screen.getByRole('button', { name: /Import Crew/i }));
      });
      await act(async () => {
        Object.defineProperty(fileInput, 'files', { value: [mockFile] });
        fireEvent.change(fileInput);
      });

      await screen.findByText(/Import Failed/i);

      consoleSpy.mockRestore();
    });

    test('handles invalid YAML file during import', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      renderWithRouter(<CrewAIManager />);
      await waitForCrews();

      await act(async () => {
        userEvent.click(screen.getByRole('button', { name: /Import Crew/i }));
      });
      await act(async () => {
        Object.defineProperty(fileInput, 'files', { value: [invalidFile] });
        fireEvent.change(fileInput);
      });

      await screen.findByText(/Import Failed/i);

      consoleSpy.mockRestore();
    });
  });

  describe('Crew editor flow', () => {
    test('navigates to create crew editor from header', async () => {
      renderWithRouter(<CrewAIManager />);

      await waitForCrews();

      await act(async () => {
        userEvent.click(screen.getByRole('button', { name: /New Crew/i }));
      });

      await screen.findByRole('heading', { name: /Create Crew/i });
    });

    test('displays template gallery and applies selected template', async () => {
      renderWithRouter(<CrewAIManager />, { route: '/crews/new' });

      await waitForCrews();

      await screen.findByRole('heading', { name: /Create Crew/i });

      const templateButton = await screen.findByRole('button', { name: /Insight Research Crew/i });
      expect(templateButton).toBeInTheDocument();

      await act(async () => {
        userEvent.click(templateButton);
      });

      await waitFor(() => {
        expect(mockedAxios.get).toHaveBeenCalledWith('/api/crew-templates/research');
      });

      const nameInputs = await screen.findAllByLabelText('Name');
      expect(nameInputs[0]).toHaveValue('Insight Research Crew');
      expect(nameInputs[1]).toHaveValue('Lead Researcher');
      expect(nameInputs[2]).toHaveValue('Insight Analyst');

      const roleInputs = await screen.findAllByLabelText('Role');
      expect(roleInputs[0]).toHaveValue('Senior Trend Researcher');
      expect(roleInputs[1]).toHaveValue('Insight Analyst');

      expect(nameInputs[3]).toHaveValue('gather_sources');
      expect(nameInputs[4]).toHaveValue('synthesize_brief');
    });

    test('navigates to edit crew editor from header when a crew is selected', async () => {
      renderWithRouter(<CrewAIManager />);

      await waitForCrews();

      await openCrewDetail(/Test Crew 1/i);

      const editButtons = await screen.findAllByRole('button', { name: /Edit Crew/i });
      const detailEditButton = editButtons[editButtons.length - 1];

      await act(async () => {
        userEvent.click(detailEditButton);
      });

      await screen.findByRole('heading', { name: /Edit Crew: Test Crew 1/i });

      await waitFor(() => {
        expect(mockedAxios.get).toHaveBeenCalledWith('/api/crews/crew-1/agents');
        expect(mockedAxios.get).toHaveBeenCalledWith('/api/crews/crew-1/tasks');
      });
    });

    test('provides a back button on the edit crew page to return to the overview', async () => {
      renderWithRouter(<CrewAIManager />, { route: '/crews/crew-1/edit' });

      await screen.findByRole('heading', { name: /Edit Crew: Test Crew 1/i });

      const backButton = screen.getByRole('button', { name: /Back to crews/i });

      await act(async () => {
        userEvent.click(backButton);
      });

      await screen.findByRole('button', { name: /New Crew/i });
    });

    test('allows creating a new crew', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: { status: 'success', id: 'new-crew' } });

      renderWithRouter(<CrewAIManager />, { route: '/crews/new' });

      await screen.findByRole('heading', { name: /Create Crew/i });

      await act(async () => {
        userEvent.type(screen.getByLabelText(/Crew ID/i), 'new-crew');
      });
      await act(async () => {
        userEvent.type(screen.getAllByLabelText(/^Name$/i)[0], 'New Crew');
      });
      await act(async () => {
        userEvent.type(screen.getByLabelText(/Icon/i), 'spark');
      });
      await act(async () => {
        userEvent.type(screen.getByLabelText(/Crew Description/i), 'New crew description');
      });

      await act(async () => {
        userEvent.click(screen.getByRole('button', { name: /Add Agent/i }));
      });
      await act(async () => {
        userEvent.click(screen.getByRole('button', { name: /Add Task/i }));
      });

      const agentCard = screen.getByTestId('agent-card-0');
      await act(async () => {
        userEvent.type(within(agentCard).getByLabelText('Name'), 'agent_alpha');
      });
      await act(async () => {
        userEvent.type(within(agentCard).getByLabelText('Role'), 'Builder');
      });
      await act(async () => {
        userEvent.type(within(agentCard).getByLabelText('Goal'), 'Build experiments');
      });
      await act(async () => {
        userEvent.type(within(agentCard).getByLabelText('Backstory'), 'Created for testing');
      });

      const taskCard = screen.getByTestId('task-card-0');
      await act(async () => {
        userEvent.type(within(taskCard).getByLabelText('Name'), 'task_alpha');
      });
      await act(async () => {
        userEvent.type(within(taskCard).getByLabelText('Expected Output'), 'Detailed summary');
      });
      await act(async () => {
        userEvent.type(within(taskCard).getByLabelText('Description'), 'Perform initial research');
      });

      await act(async () => {
        userEvent.click(screen.getByTestId('crew-editor-submit'));
      });

      await waitFor(() => {
        expect(mockedAxios.post).toHaveBeenCalledWith(
          '/api/crews',
          expect.objectContaining({
            id: 'new-crew',
            agents: [
              expect.objectContaining({
                name: 'agent_alpha',
                role: 'Builder',
                goal: 'Build experiments',
                backstory: 'Created for testing'
              })
            ],
            tasks: [
              expect.objectContaining({
                name: 'task_alpha',
                description: 'Perform initial research',
                expected_output: 'Detailed summary'
              })
            ],
            metadata: expect.objectContaining({
              name: 'New Crew',
              description: 'New crew description',
              icon: 'spark',
              agent_order: ['agent_alpha'],
              task_order: ['task_alpha']
            })
          })
        );
      });
    });

    test('allows editing an existing crew and reordering steps', async () => {
      mockedAxios.put.mockClear();

      renderWithRouter(<CrewAIManager />, { route: '/crews/crew-1/edit' });

      await screen.findByRole('heading', { name: /Edit Crew: Test Crew 1/i });

      const agentCard = await screen.findByTestId('agent-card-0');
      const taskCard = await screen.findByTestId('task-card-0');

      await act(async () => {
        userEvent.clear(screen.getByLabelText(/Crew Description/i));
        userEvent.type(screen.getByLabelText(/Crew Description/i), 'Updated description');
      });

      await act(async () => {
        userEvent.click(screen.getByRole('button', { name: /Move agent_alpha down/i }));
      });
      await act(async () => {
        userEvent.click(screen.getByRole('button', { name: /Move task_alpha down/i }));
      });

      await act(async () => {
        userEvent.click(screen.getByRole('button', { name: /Save Changes/i }));
      });

      await waitFor(() => {
        expect(mockedAxios.put).toHaveBeenCalledWith(
          '/api/crews/crew-1',
          expect.objectContaining({
            metadata: expect.objectContaining({
              description: 'Updated description',
              agent_order: ['agent_beta', 'agent_alpha'],
              task_order: ['task_beta', 'task_alpha']
            })
          })
        );
      });
    });
  });
});