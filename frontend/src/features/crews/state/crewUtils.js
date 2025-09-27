import * as yaml from 'js-yaml';

export const normalizeLogLevel = (level) => {
  if (!level) return null;
  const normalized = String(level).toLowerCase();
  if (normalized === 'warn') return 'warning';
  if (['fatal', 'critical'].includes(normalized)) return 'error';
  if (['success', 'ok', 'completed'].includes(normalized)) return 'success';
  return normalized;
};

export const createLogDeduplicator = (windowMs = 5000, maxOccurrences = 3) => {
  const recentLogs = new Map();

  return ({ agent, message }) => {
    const key = `${agent || ''}::${message || ''}`;
    const now = Date.now();
    const timestamps = recentLogs.get(key) || [];
    const activeTimestamps = timestamps.filter(timestamp => now - timestamp < windowMs);

    if (activeTimestamps.length >= maxOccurrences) {
      recentLogs.set(key, activeTimestamps);
      return true;
    }

    activeTimestamps.push(now);
    recentLogs.set(key, activeTimestamps);
    return false;
  };
};

export const readFileContent = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = (event) => {
    resolve(event.target.result);
  };
  reader.onerror = (error) => {
    reject(error);
  };
  reader.readAsText(file);
});

export const parseCrewYaml = (yamlContent) => {
  try {
    const parsedData = yaml.load(yamlContent);

    if (!parsedData || typeof parsedData !== 'object') {
      throw new Error('Invalid YAML structure');
    }

    const crewData = {
      name: parsedData.name || 'Imported Crew',
      agents: [],
      tasks: [],
      description: parsedData.description || ''
    };

    if (parsedData.agents && Array.isArray(parsedData.agents)) {
      crewData.agents = parsedData.agents.map(agent => ({
        name: agent.name || '',
        role: agent.role || '',
        goal: agent.goal || '',
        backstory: agent.backstory || ''
      }));
    }

    if (parsedData.tasks && Array.isArray(parsedData.tasks)) {
      crewData.tasks = parsedData.tasks.map(task => ({
        name: task.name || '',
        description: task.description || '',
        expected_output: task.expected_output || ''
      }));
    }

    return crewData;
  } catch (error) {
    throw new Error(`Failed to parse YAML content: ${error.message}`);
  }
};

export const validateCrewData = (crewData) => {
  if (!crewData.name) {
    throw new Error('Crew name is required');
  }

  if (!Array.isArray(crewData.agents)) {
    throw new Error('Agents must be an array');
  }

  for (const agent of crewData.agents) {
    if (!agent.name) {
      throw new Error('Each agent must have a name');
    }
    if (!agent.role) {
      throw new Error('Each agent must have a role');
    }
    if (!agent.goal) {
      throw new Error('Each agent must have a goal');
    }
    if (!agent.backstory) {
      throw new Error('Each agent must have a backstory');
    }
  }

  if (!Array.isArray(crewData.tasks)) {
    throw new Error('Tasks must be an array');
  }

  for (const task of crewData.tasks) {
    if (!task.name) {
      throw new Error('Each task must have a name');
    }
    if (!task.description) {
      throw new Error('Each task must have a description');
    }
    if (!task.expected_output) {
      throw new Error('Each task must have an expected output');
    }
  }
};

