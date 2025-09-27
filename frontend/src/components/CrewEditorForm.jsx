import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

import { API_BASE } from '../config/apiConfig';
import { getApiErrorMessage } from '../utils/apiErrorUtils';

import {
  buildInputSchemaFromEntries,
  coerceValue,
  formatValueForInput,
  isValueEmpty,
  normalizeInputSchemaForEditor,
  normalizeType,
  validateInputParameterDefinition,
} from './crewInputUtils';

let uniqueIdCounter = 0;
const generateInternalKey = (prefix) => `${prefix}-${Date.now().toString(36)}-${(uniqueIdCounter++).toString(36)}`;

const safeString = (value) => {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value);
};

const sanitizeDependencies = (dependencies, excludeName = '') => {
  if (!Array.isArray(dependencies) || dependencies.length === 0) {
    return [];
  }

  const trimmedExclude = typeof excludeName === 'string' ? excludeName.trim() : '';
  const seen = new Set();
  const result = [];

  dependencies.forEach((dependency) => {
    const trimmed = typeof dependency === 'string' ? dependency.trim() : '';
    if (!trimmed || trimmed === trimmedExclude || seen.has(trimmed)) {
      return;
    }
    seen.add(trimmed);
    result.push(trimmed);
  });

  return result;
};

const standardizeAgentLibraryEntry = (fallbackName, definition) => {
  const normalizedDefinition = definition && typeof definition === 'object' ? definition : {};
  const nameSource = typeof normalizedDefinition.name === 'string' && normalizedDefinition.name.trim()
    ? normalizedDefinition.name
    : fallbackName;

  return {
    name: typeof nameSource === 'string' ? nameSource : safeString(nameSource || ''),
    role: safeString(normalizedDefinition.role),
    goal: safeString(normalizedDefinition.goal),
    backstory: safeString(normalizedDefinition.backstory),
  };
};

const extractAgentLibraryEntries = (payload) => {
  if (!payload) {
    return [];
  }

  const candidateArrays = [];

  if (Array.isArray(payload)) {
    candidateArrays.push(payload);
  }

  if (Array.isArray(payload?.agents)) {
    candidateArrays.push(payload.agents);
  }

  if (Array.isArray(payload?.items)) {
    candidateArrays.push(payload.items);
  }

  if (Array.isArray(payload?.data)) {
    candidateArrays.push(payload.data);
  }

  for (const candidate of candidateArrays) {
    if (Array.isArray(candidate) && candidate.length > 0) {
      return candidate
        .filter((entry) => entry && typeof entry === 'object')
        .map((entry) => standardizeAgentLibraryEntry(entry.name, entry));
    }
  }

  if (payload?.agents && typeof payload.agents === 'object' && !Array.isArray(payload.agents)) {
    return Object.entries(payload.agents).map(([key, value]) => standardizeAgentLibraryEntry(key, value));
  }

  return [];
};

const defaultAgent = () => ({
  __key: generateInternalKey('agent'),
  name: '',
  role: '',
  goal: '',
  backstory: ''
});

const defaultTask = () => ({
  __key: generateInternalKey('task'),
  name: '',
  description: '',
  expected_output: '',
  dependencies: [],
  inputs: [],
});

const defaultTaskInput = () => ({
  __key: generateInternalKey('task-input'),
  name: '',
  type: 'string',
  required: false,
  defaultValue: '',
});

const baseInputClasses =
  'rounded border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950/60 dark:text-gray-100 dark:placeholder-gray-500 dark:focus:border-blue-400';

const INPUT_TYPE_OPTIONS = [
  { value: 'string', label: 'Text' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'integer', label: 'Integer' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'time', label: 'Time' },
  { value: 'datetime-local', label: 'Date & Time' },
];

const normalizeInitialData = (initialData = {}, mode) => ({
  id: initialData.id ?? '',
  name: initialData.name ?? initialData.id ?? '',
  description: initialData.description ?? '',
  icon: initialData.icon ?? '',
  agents: Array.isArray(initialData.agents)
    ? initialData.agents.map((agent, index) => ({
      __key: agent?.__key || generateInternalKey(`agent-${index}`),
      name: agent?.name ?? '',
      role: agent?.role ?? '',
      goal: agent?.goal ?? '',
      backstory: agent?.backstory ?? ''
    }))
    : [],
  tasks: Array.isArray(initialData.tasks)
    ? initialData.tasks.map((task, index) => {
      const dependenciesSource = Array.isArray(task?.dependencies)
        ? task.dependencies
        : Array.isArray(task?.context)
          ? task.context
          : [];
      const dependencies = sanitizeDependencies(dependenciesSource, task?.name ?? '');

      let inputs = [];

      if (Array.isArray(task?.inputs)) {
        inputs = task.inputs
          .filter(input => input && typeof input === 'object')
          .map((input, inputIndex) => {
            const normalizedType = normalizeType(input?.type, input?.default ?? input?.defaultValue);
            const metadata = { type: normalizedType };
            const defaultSource = input?.default ?? input?.defaultValue;
            const formattedDefault = formatValueForInput(
              metadata,
              coerceValue(metadata, defaultSource)
            );

            return {
              __key: input?.__key || generateInternalKey(`task-input-${index}-${inputIndex}`),
              name: input?.name ?? '',
              type: normalizedType,
              required: Boolean(input?.required),
              defaultValue: formattedDefault,
            };
          });
      } else {
        const schemaSource = task?.inputs && typeof task.inputs === 'object' && !Array.isArray(task.inputs)
          ? task.inputs
          : task?.input_schema && typeof task.input_schema === 'object' && !Array.isArray(task.input_schema)
            ? task.input_schema
            : {};

        const normalizedEntries = normalizeInputSchemaForEditor(schemaSource);
        inputs = normalizedEntries.map((entry, inputIndex) => ({
          __key: generateInternalKey(`task-input-${index}-${inputIndex}`),
          name: entry?.name ?? '',
          type: entry?.type ?? 'string',
          required: Boolean(entry?.required),
          defaultValue: entry?.defaultValue,
        }));
      }

      return {
        __key: task?.__key || generateInternalKey(`task-${index}`),
        name: task?.name ?? '',
        description: task?.description ?? '',
        expected_output: task?.expected_output ?? '',
        dependencies,
        inputs,
      };
    })
    : [],
  agentOrder: Array.isArray(initialData.agentOrder)
    ? [...initialData.agentOrder]
    : (Array.isArray(initialData.agents) ? initialData.agents.map(agent => agent?.name ?? '') : []),
  taskOrder: Array.isArray(initialData.taskOrder)
    ? [...initialData.taskOrder]
    : (Array.isArray(initialData.tasks) ? initialData.tasks.map(task => task?.name ?? '') : []),
  mode
});

const CrewEditorForm = ({
  initialData,
  mode = 'create',
  onSubmit,
  onCancel,
  onDelete,
  isSubmitting = false,
  error: externalError = null
}) => {
  const [formState, setFormState] = useState(() => normalizeInitialData(initialData, mode));
  const [formError, setFormError] = useState(null);
  const [isAgentLibraryOpen, setIsAgentLibraryOpen] = useState(false);
  const [agentLibrary, setAgentLibrary] = useState([]);
  const [agentLibraryLoading, setAgentLibraryLoading] = useState(false);
  const [agentLibraryError, setAgentLibraryError] = useState(null);
  const [agentLibraryLoaded, setAgentLibraryLoaded] = useState(false);

  useEffect(() => {
    setFormState(normalizeInitialData(initialData, mode));
  }, [initialData, mode]);

  useEffect(() => {
    if (externalError) {
      setFormError(externalError);
    }
  }, [externalError]);

  useEffect(() => {
    if (!isAgentLibraryOpen || agentLibraryLoaded) {
      return undefined;
    }

    let cancelled = false;
    setAgentLibraryLoading(true);
    setAgentLibraryError(null);

    const controller = new AbortController();

    const loadAgents = async () => {
      try {
        const response = await axios.get(`${API_BASE}/agents`, {
          signal: controller.signal,
          headers: {
            Accept: 'application/json'
          }
        });

        if (cancelled) {
          return;
        }

        const entries = extractAgentLibraryEntries(response.data);
        const normalized = entries.map((entry, index) => ({
          __key: generateInternalKey(`library-agent-${index}`),
          ...entry,
        }));

        setAgentLibrary(normalized);
        setAgentLibraryLoaded(true);
      } catch (error) {
        if (cancelled || controller.signal.aborted) {
          return;
        }

        const message = getApiErrorMessage(error, {
          defaultMessage: 'Failed to load agent library. Please try again.',
          apiBase: API_BASE
        });
        setAgentLibraryError(message);
      } finally {
        if (cancelled) {
          return;
        }

        setAgentLibraryLoading(false);
      }
    };

    loadAgents();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [agentLibraryLoaded, isAgentLibraryOpen]);

  const agentsInOrder = useMemo(() => {
    const orderSet = new Set(formState.agentOrder);
    const ordered = formState.agentOrder
      .map(name => formState.agents.find(agent => agent.name === name))
      .filter(Boolean);

    const remaining = formState.agents.filter(agent => !orderSet.has(agent.name));
    return [...ordered, ...remaining];
  }, [formState.agentOrder, formState.agents]);

  const tasksInOrder = useMemo(() => {
    const orderSet = new Set(formState.taskOrder);
    const ordered = formState.taskOrder
      .map(name => formState.tasks.find(task => task.name === name))
      .filter(Boolean);
    const remaining = formState.tasks.filter(task => !orderSet.has(task.name));
    return [...ordered, ...remaining];
  }, [formState.taskOrder, formState.tasks]);

  const updateMetadataField = (field, value) => {
    setFormState(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const updateAgentField = (index, field, value) => {
    setFormState(prev => {
      const agents = prev.agents.slice();
      agents[index] = {
        ...agents[index],
        [field]: value
      };
      return {
        ...prev,
        agents,
        agentOrder: agents.map(agent => agent.name)
      };
    });
  };

  const updateTaskField = (index, field, value) => {
    setFormState(prev => {
      if (index < 0 || index >= prev.tasks.length) {
        return prev;
      }

      const tasks = prev.tasks.slice();
      const existingTask = tasks[index];
      const updatedTask = {
        ...existingTask,
        [field]: value
      };

      tasks[index] = updatedTask;

      let nextTasks = tasks;
      let nextTaskOrder = tasks.map(task => task.name);

      if (field === 'name') {
        const previousName = typeof existingTask?.name === 'string' ? existingTask.name : '';
        const nextName = typeof value === 'string' ? value : '';

        if (previousName && previousName !== nextName) {
          nextTasks = tasks.map(task => {
            if (!Array.isArray(task?.dependencies) || task.dependencies.length === 0) {
              return task;
            }

            const remapped = task.dependencies.map(dependency => (dependency === previousName ? nextName : dependency));
            const sanitized = sanitizeDependencies(remapped, task?.name ?? '');

            if (sanitized.length === task.dependencies.length && sanitized.every((item, idx) => item === task.dependencies[idx])) {
              return task;
            }

            return {
              ...task,
              dependencies: sanitized
            };
          });

          nextTaskOrder = nextTaskOrder.map(taskName => (taskName === previousName ? nextName : taskName));
        }
      }

      if (field === 'dependencies') {
        nextTasks = tasks.map((task, taskIndex) => (
          taskIndex === index
            ? { ...task, dependencies: sanitizeDependencies(value, task?.name ?? '') }
            : task
        ));
      }

      return {
        ...prev,
        tasks: nextTasks,
        taskOrder: nextTaskOrder
      };
    });
  };

  const handleAddAgent = () => {
    setFormState(prev => {
      const agents = [...prev.agents, defaultAgent()];
      return {
        ...prev,
        agents,
        agentOrder: agents.map(agent => agent.name)
      };
    });
  };

  const handleAddTask = () => {
    setFormState(prev => {
      const tasks = [...prev.tasks, defaultTask()];
      return {
        ...prev,
        tasks,
        taskOrder: tasks.map(task => task.name)
      };
    });
  };

  const handleToggleTaskDependency = (taskIndex, dependencyName) => {
    if (!dependencyName) {
      return;
    }

    setFormState(prev => {
      if (taskIndex < 0 || taskIndex >= prev.tasks.length) {
        return prev;
      }

      const tasks = prev.tasks.slice();
      const targetTask = tasks[taskIndex];
      if (!targetTask) {
        return prev;
      }

      const normalizedDependency = dependencyName.trim();
      if (!normalizedDependency || normalizedDependency === targetTask.name) {
        return prev;
      }

      const existingDependencies = Array.isArray(targetTask.dependencies)
        ? [...targetTask.dependencies]
        : [];

      const hasDependency = existingDependencies.includes(normalizedDependency);
      const nextDependencies = hasDependency
        ? existingDependencies.filter(dep => dep !== normalizedDependency)
        : [...existingDependencies, normalizedDependency];

      tasks[taskIndex] = {
        ...targetTask,
        dependencies: sanitizeDependencies(nextDependencies, targetTask?.name ?? ''),
      };

      return {
        ...prev,
        tasks,
      };
    });
  };

  const handleAddTaskInput = (taskIndex) => {
    setFormState(prev => {
      if (taskIndex < 0 || taskIndex >= prev.tasks.length) {
        return prev;
      }

      const tasks = prev.tasks.slice();
      const targetTask = tasks[taskIndex];
      const inputs = Array.isArray(targetTask?.inputs) ? [...targetTask.inputs, defaultTaskInput()] : [defaultTaskInput()];

      tasks[taskIndex] = {
        ...targetTask,
        inputs,
      };

      return {
        ...prev,
        tasks,
      };
    });
  };

  const handleUpdateTaskInput = (taskIndex, inputIndex, field, value) => {
    setFormState(prev => {
      if (taskIndex < 0 || taskIndex >= prev.tasks.length) {
        return prev;
      }

      const tasks = prev.tasks.slice();
      const targetTask = tasks[taskIndex];
      const inputs = Array.isArray(targetTask?.inputs) ? targetTask.inputs.slice() : [];

      if (inputIndex < 0 || inputIndex >= inputs.length) {
        return prev;
      }

      const currentInput = inputs[inputIndex] || defaultTaskInput();

      if (field === 'type') {
        const normalizedType = normalizeType(value, currentInput?.defaultValue);
        const metadata = { type: normalizedType };
        const coercedDefault = coerceValue(metadata, currentInput?.defaultValue);
        const formattedDefault = formatValueForInput(metadata, coercedDefault);

        inputs[inputIndex] = {
          ...currentInput,
          type: normalizedType,
          defaultValue: formattedDefault,
        };
      } else if (field === 'required') {
        inputs[inputIndex] = {
          ...currentInput,
          required: Boolean(value),
        };
      } else {
        inputs[inputIndex] = {
          ...currentInput,
          [field]: value,
        };
      }

      tasks[taskIndex] = {
        ...targetTask,
        inputs,
      };

      return {
        ...prev,
        tasks,
      };
    });
  };

  const handleRemoveTaskInput = (taskIndex, inputIndex) => {
    setFormState(prev => {
      if (taskIndex < 0 || taskIndex >= prev.tasks.length) {
        return prev;
      }

      const tasks = prev.tasks.slice();
      const targetTask = tasks[taskIndex];
      const inputs = Array.isArray(targetTask?.inputs) ? targetTask.inputs.slice() : [];

      if (inputIndex < 0 || inputIndex >= inputs.length) {
        return prev;
      }

      inputs.splice(inputIndex, 1);

      tasks[taskIndex] = {
        ...targetTask,
        inputs,
      };

      return {
        ...prev,
        tasks,
      };
    });
  };

  const handleAddAgentFromLibrary = (agentDefinition) => {
    if (!agentDefinition || typeof agentDefinition !== 'object') {
      return;
    }

    setFormState(prev => {
      const existingNames = new Set(prev.agents.map(agent => agent?.name ?? ''));
      const baseName = typeof agentDefinition.name === 'string' ? agentDefinition.name.trim() : '';
      let resolvedName = baseName;

      if (resolvedName) {
        let suffix = 2;
        while (existingNames.has(resolvedName)) {
          resolvedName = `${baseName} (${suffix})`;
          suffix += 1;
        }
      }

      const newAgent = {
        __key: generateInternalKey('agent'),
        name: resolvedName,
        role: agentDefinition.role ?? '',
        goal: agentDefinition.goal ?? '',
        backstory: agentDefinition.backstory ?? '',
      };

      const agents = [...prev.agents, newAgent];

      return {
        ...prev,
        agents,
        agentOrder: agents.map(agent => agent.name)
      };
    });
  };

  const handleOpenAgentLibrary = () => {
    if (!isAgentLibraryOpen) {
      setIsAgentLibraryOpen(true);
    }
    if (agentLibraryError) {
      setAgentLibraryError(null);
    }
  };

  const handleCloseAgentLibrary = () => {
    setIsAgentLibraryOpen(false);
  };

  const handleReloadAgentLibrary = () => {
    setAgentLibraryLoaded(false);
    setAgentLibrary([]);
    setAgentLibraryError(null);
  };

  const handleRemoveAgent = (index) => {
    setFormState(prev => {
      const agents = prev.agents.slice();
      const [removed] = agents.splice(index, 1);
      const agentOrder = prev.agentOrder.filter(name => name !== removed?.name);
      return {
        ...prev,
        agents,
        agentOrder
      };
    });
  };

  const handleRemoveTask = (index) => {
    setFormState(prev => {
      if (index < 0 || index >= prev.tasks.length) {
        return prev;
      }

      const tasks = prev.tasks.slice();
      const [removed] = tasks.splice(index, 1);
      const removedName = typeof removed?.name === 'string' ? removed.name : '';
      const sanitizedTasks = tasks.map(task => {
        if (!removedName || !Array.isArray(task?.dependencies) || task.dependencies.length === 0) {
          return task;
        }

        const filtered = task.dependencies.filter(dependency => dependency !== removedName);
        if (filtered.length === task.dependencies.length) {
          return task;
        }

        return {
          ...task,
          dependencies: sanitizeDependencies(filtered, task?.name ?? '')
        };
      });

      const taskOrder = prev.taskOrder.filter(name => name !== removedName);
      return {
        ...prev,
        tasks: sanitizedTasks,
        taskOrder
      };
    });
  };

  const moveItem = (list, fromIndex, direction) => {
    const toIndex = fromIndex + direction;
    if (toIndex < 0 || toIndex >= list.length) {
      return list;
    }
    const updated = list.slice();
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    return updated;
  };

  const handleReorderAgent = (index, direction) => {
    setFormState(prev => ({
      ...prev,
      agentOrder: moveItem(prev.agentOrder, index, direction)
    }));
  };

  const handleReorderTask = (index, direction) => {
    setFormState(prev => ({
      ...prev,
      taskOrder: moveItem(prev.taskOrder, index, direction)
    }));
  };

  const agentFieldId = (index, field) => `agent-${index}-${field}`;
  const taskFieldId = (index, field) => `task-${index}-${field}`;

  const validateForm = (payload) => {
    if (mode === 'create' && !payload.id.trim()) {
      return 'Crew ID is required.';
    }

    if (payload.agents.length === 0) {
      return 'At least one agent is required.';
    }

    const agentNames = payload.agents.map(agent => agent.name);
    if (new Set(agentNames).size !== agentNames.length) {
      return 'Agent names must be unique.';
    }

    if (payload.tasks.length === 0) {
      return 'At least one task is required.';
    }

    const invalidAgent = payload.agents.find(agent => !agent.name || !agent.role || !agent.goal || !agent.backstory);
    if (invalidAgent) {
      return 'All agents must include a name, role, goal, and backstory.';
    }

    const invalidTask = payload.tasks.find(task => !task.name || !task.description || !task.expected_output);
    if (invalidTask) {
      return 'All tasks must include a name, description, and expected output.';
    }

    const taskNames = payload.tasks.map(task => task.name);
    if (new Set(taskNames).size !== taskNames.length) {
      return 'Task names must be unique.';
    }

    const taskNameSet = new Set(taskNames);
    for (const task of payload.tasks) {
      const dependencies = Array.isArray(task.dependencies) ? task.dependencies : [];

      for (const dependency of dependencies) {
        if (dependency === task.name) {
          return `Task "${task.name}" cannot depend on itself.`;
        }

        if (!taskNameSet.has(dependency)) {
          return `Task "${task.name}" references an unknown dependency "${dependency}".`;
        }
      }
    }

    return null;
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setFormError(null);

    const trimmedId = formState.id.trim();
    const agents = formState.agents.map(agent => ({
      name: agent.name.trim(),
      role: agent.role,
      goal: agent.goal,
      backstory: agent.backstory
    }));

    const tasks = [];

    for (let index = 0; index < formState.tasks.length; index += 1) {
      const task = formState.tasks[index];
      const trimmedName = task.name.trim();
      const { schema, errors } = buildInputSchemaFromEntries(Array.isArray(task.inputs) ? task.inputs : []);

      if (errors.length > 0) {
        const label = trimmedName || `Task ${index + 1}`;
        setFormError(`Task "${label}": ${errors[0]}`);
        return;
      }

      const dependencies = sanitizeDependencies(task.dependencies, trimmedName).filter(dependency => dependency !== trimmedName);

      const normalizedTask = {
        name: trimmedName,
        description: task.description,
        expected_output: task.expected_output
      };

      if (dependencies.length > 0) {
        normalizedTask.dependencies = dependencies;
      }

      if (Object.keys(schema).length > 0) {
        normalizedTask.inputs = schema;
      }

      tasks.push(normalizedTask);
    }

    const agentNames = agents.map(agent => agent.name);
    const taskNames = tasks.map(task => task.name);
    const trimmedAgentOrder = formState.agentOrder
      .map(name => (typeof name === 'string' ? name.trim() : ''))
      .filter(Boolean);
    const trimmedTaskOrder = formState.taskOrder
      .map(name => (typeof name === 'string' ? name.trim() : ''))
      .filter(Boolean);

    const payload = {
      id: trimmedId,
      agents,
      tasks,
      metadata: {
        name: formState.name?.trim() || trimmedId,
        description: formState.description,
        icon: formState.icon,
        agent_order: trimmedAgentOrder.length === agents.length ? trimmedAgentOrder : agentNames,
        task_order: trimmedTaskOrder.length === tasks.length ? trimmedTaskOrder : taskNames
      }
    };

    const validationMessage = validateForm(payload);
    if (validationMessage) {
      setFormError(validationMessage);
      return;
    }

    onSubmit(payload);
  };

  const renderAgentCard = (agent, agentIndex, orderIndex) => (
    <div
      key={agent.__key || agentIndex || orderIndex}
      data-testid={`agent-card-${orderIndex}`}
      className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">Agent {orderIndex + 1}</div>

        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => handleReorderAgent(orderIndex, -1)}
            className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 dark:border-slate-600 dark:text-gray-300 dark:hover:bg-slate-800"

            disabled={orderIndex === 0 || isSubmitting}
            aria-label={`Move ${(agent.name || `agent ${orderIndex + 1}`)} up`}
          >
            Up
          </button>
          <button
            type="button"
            onClick={() => handleReorderAgent(orderIndex, 1)}
            className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 dark:border-slate-600 dark:text-gray-300 dark:hover:bg-slate-800"

            disabled={orderIndex === agentsInOrder.length - 1 || isSubmitting}
            aria-label={`Move ${(agent.name || `agent ${orderIndex + 1}`)} down`}
          >
            Down
          </button>
          <button
            type="button"
            onClick={() => handleRemoveAgent(agentIndex)}
            className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-500/60 dark:text-red-300 dark:hover:bg-red-500/10"

            disabled={isSubmitting}
          >
            Remove
          </button>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="flex flex-col text-sm text-gray-700 dark:text-gray-200">
          <span className="mb-1 font-medium">Name</span>

          <input
            type="text"
            value={agent.name}
            onChange={event => updateAgentField(agentIndex, 'name', event.target.value)}
            className={baseInputClasses}
            disabled={isSubmitting}
            id={agentFieldId(agentIndex, 'name')}
            aria-label="Name"
          />
        </div>
        <div className="flex flex-col text-sm text-gray-700 dark:text-gray-200">
          <span className="mb-1 font-medium">Role</span>

          <input
            type="text"
            value={agent.role}
            onChange={event => updateAgentField(agentIndex, 'role', event.target.value)}
            className={baseInputClasses}
            disabled={isSubmitting}
            id={agentFieldId(agentIndex, 'role')}
            aria-label="Role"
          />
        </div>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="flex flex-col text-sm text-gray-700 dark:text-gray-200">
          <span className="mb-1 font-medium">Goal</span>
          <textarea
            value={agent.goal}
            onChange={event => updateAgentField(agentIndex, 'goal', event.target.value)}
            className="min-h-[64px] rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950/60 dark:text-gray-100 dark:focus:border-blue-400"

            disabled={isSubmitting}
            id={agentFieldId(agentIndex, 'goal')}
            aria-label="Goal"
          />
        </div>
        <div className="flex flex-col text-sm text-gray-700 dark:text-gray-200">
          <span className="mb-1 font-medium">Backstory</span>
          <textarea
            value={agent.backstory}
            onChange={event => updateAgentField(agentIndex, 'backstory', event.target.value)}
            className="min-h-[64px] rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950/60 dark:text-gray-100 dark:focus:border-blue-400"

            disabled={isSubmitting}
            id={agentFieldId(agentIndex, 'backstory')}
            aria-label="Backstory"
          />
        </div>
      </div>
    </div>
  );

  const renderTaskCard = (task, taskIndex, orderIndex) => {
    if (taskIndex < 0) {
      return null;
    }

    const dependencyOptions = [];
    const seenDependencies = new Set();

    formState.tasks.forEach((candidate, candidateIndex) => {
      if (candidateIndex === taskIndex) {
        return;
      }

      const candidateName = typeof candidate?.name === 'string' ? candidate.name.trim() : '';

      if (!candidateName || seenDependencies.has(candidateName) || candidateName === task.name.trim()) {
        return;
      }

      seenDependencies.add(candidateName);
      dependencyOptions.push(candidateName);
    });

    const taskDependencies = Array.isArray(task.dependencies) ? task.dependencies : [];

    return (
      <div
        key={task.__key || taskIndex || orderIndex}
        data-testid={`task-card-${orderIndex}`}
        className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">Task {orderIndex + 1}</div>

          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => handleReorderTask(orderIndex, -1)}
              className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 dark:border-slate-600 dark:text-gray-300 dark:hover:bg-slate-800"
              disabled={orderIndex === 0 || isSubmitting}
              aria-label={`Move ${(task.name || `task ${orderIndex + 1}`)} up`}
            >
              Up
            </button>
            <button
              type="button"
              onClick={() => handleReorderTask(orderIndex, 1)}
              className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 dark:border-slate-600 dark:text-gray-300 dark:hover:bg-slate-800"
              disabled={orderIndex === tasksInOrder.length - 1 || isSubmitting}
              aria-label={`Move ${(task.name || `task ${orderIndex + 1}`)} down`}
            >
              Down
            </button>
            <button
              type="button"
              onClick={() => handleRemoveTask(taskIndex)}
              className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-500/60 dark:text-red-300 dark:hover:bg-red-500/10"
              disabled={isSubmitting}
            >
              Remove
            </button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="flex flex-col text-sm text-gray-700 dark:text-gray-200">
            <span className="mb-1 font-medium">Name</span>

            <input
              type="text"
              value={task.name}
              onChange={event => updateTaskField(taskIndex, 'name', event.target.value)}
              className={baseInputClasses}
              disabled={isSubmitting}
              id={taskFieldId(taskIndex, 'name')}
              aria-label="Name"
            />
          </div>
          <div className="flex flex-col text-sm text-gray-700 dark:text-gray-200">
            <span className="mb-1 font-medium">Expected Output</span>
            <textarea
              value={task.expected_output}
              onChange={event => updateTaskField(taskIndex, 'expected_output', event.target.value)}
              className="min-h-[64px] rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950/60 dark:text-gray-100 dark:focus:border-blue-400"
              disabled={isSubmitting}
              id={taskFieldId(taskIndex, 'expected_output')}
              aria-label="Expected Output"
            />
          </div>
        </div>
        <div className="mt-3">
          <div className="flex flex-col text-sm text-gray-700 dark:text-gray-200">
            <span className="mb-1 font-medium">Description</span>
            <textarea
              value={task.description}
              onChange={event => updateTaskField(taskIndex, 'description', event.target.value)}
              className="min-h-[64px] rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950/60 dark:text-gray-100 dark:focus:border-blue-400"
              disabled={isSubmitting}
              id={taskFieldId(taskIndex, 'description')}
              aria-label="Description"
            />
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-200">Dependencies</div>
          {dependencyOptions.length === 0 ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">No other tasks available for dependency selection.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {dependencyOptions.map(option => {
                const isChecked = taskDependencies.includes(option);
                return (
                  <label
                    key={`${task.__key || taskIndex}-dependency-${option}`}
                    className="inline-flex items-center gap-2 rounded border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 dark:border-slate-600 dark:text-gray-200 dark:hover:bg-slate-800"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggleTaskDependency(taskIndex, option)}
                      disabled={isSubmitting}
                      className="h-3 w-3"
                    />
                    <span>{option}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-200">Input Parameters</div>
            <button
              type="button"
              onClick={() => handleAddTaskInput(taskIndex)}
              className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:border-slate-600 dark:text-gray-200 dark:hover:bg-slate-800"
              disabled={isSubmitting}
            >
              Add Input
            </button>
          </div>

          {(!Array.isArray(task.inputs) || task.inputs.length === 0) ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">No input parameters defined.</p>
          ) : (
            <div className="space-y-3">
              {task.inputs.map((input, inputIndex) => {
                const validation = validateInputParameterDefinition(input, { requireName: false });
                const hasDefault = !isValueEmpty(input?.defaultValue);
                const showDefaultError = hasDefault && !validation.isValid;
                const knownType = INPUT_TYPE_OPTIONS.find(option => option.value === input?.type);
                const typeValue = knownType ? knownType.value : (input?.type || 'string');

                let defaultControl;
                if (typeValue === 'boolean') {
                  defaultControl = (
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={Boolean(input?.defaultValue)}
                        onChange={event => handleUpdateTaskInput(taskIndex, inputIndex, 'defaultValue', event.target.checked)}
                        disabled={isSubmitting}
                        className="h-4 w-4"
                      />
                      <span className="text-xs text-gray-600 dark:text-gray-300">Checked by default</span>
                    </div>
                  );
                } else {
                  let inputType = 'text';
                  const inputProps = {};

                  if (typeValue === 'integer' || typeValue === 'number') {
                    inputType = 'number';
                    if (typeValue === 'integer') {
                      inputProps.step = 1;
                    }
                  } else if (['date', 'time', 'datetime-local'].includes(typeValue)) {
                    inputType = typeValue;
                  }

                  defaultControl = (
                    <input
                      type={inputType}
                      value={input?.defaultValue ?? ''}
                      onChange={event => handleUpdateTaskInput(taskIndex, inputIndex, 'defaultValue', event.target.value)}
                      disabled={isSubmitting}
                      className={baseInputClasses}
                      {...inputProps}
                    />
                  );
                }

                return (
                  <div
                    key={input.__key || `${task.__key || taskIndex}-input-${inputIndex}`}
                    className="rounded border border-gray-200 p-3 dark:border-slate-700"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Parameter {inputIndex + 1}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveTaskInput(taskIndex, inputIndex)}
                        className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-500/60 dark:text-red-300 dark:hover:bg-red-500/10"
                        disabled={isSubmitting}
                      >
                        Remove
                      </button>
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div className="flex flex-col text-sm text-gray-700 dark:text-gray-200">
                        <span className="mb-1 font-medium">Name</span>
                        <input
                          type="text"
                          value={input?.name ?? ''}
                          onChange={event => handleUpdateTaskInput(taskIndex, inputIndex, 'name', event.target.value)}
                          className={baseInputClasses}
                          disabled={isSubmitting}
                        />
                      </div>
                      <div className="flex flex-col text-sm text-gray-700 dark:text-gray-200">
                        <span className="mb-1 font-medium">Type</span>
                        <select
                          value={typeValue}
                          onChange={event => handleUpdateTaskInput(taskIndex, inputIndex, 'type', event.target.value)}
                          className={baseInputClasses}
                          disabled={isSubmitting}
                        >
                          {INPUT_TYPE_OPTIONS.map(option => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                          {!knownType && input?.type ? (
                            <option value={input.type}>{input.type}</option>
                          ) : null}
                        </select>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                        <input
                          type="checkbox"
                          checked={Boolean(input?.required)}
                          onChange={event => handleUpdateTaskInput(taskIndex, inputIndex, 'required', event.target.checked)}
                          disabled={isSubmitting}
                          className="h-4 w-4"
                        />
                        <span>Required</span>
                      </label>
                      <div className="flex flex-col text-sm text-gray-700 dark:text-gray-200">
                        <span className="mb-1 font-medium">Default Value</span>
                        {defaultControl}
                        {showDefaultError ? (
                          <p className="mt-1 text-xs text-red-600 dark:text-red-400">{validation.error}</p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderAgentLibraryModal = () => {
    if (!isAgentLibraryOpen) {
      return null;
    }

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8">
        <div className="relative max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-slate-700">
            <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">Agent Library</h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleReloadAgentLibrary}
                className="rounded border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:border-slate-600 dark:text-gray-200 dark:hover:bg-slate-800"
                disabled={agentLibraryLoading}
              >
                Reload
              </button>
              <button
                type="button"
                onClick={handleCloseAgentLibrary}
                className="rounded border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:border-slate-600 dark:text-gray-200 dark:hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
          <div className="max-h-[70vh] overflow-y-auto px-4 py-4">
            {agentLibraryLoading ? (
              <p className="text-sm text-gray-600 dark:text-gray-300">Loading agents...</p>
            ) : agentLibraryError ? (
              <div className="space-y-3 text-sm">
                <p className="text-red-600 dark:text-red-400">{agentLibraryError}</p>
                <button
                  type="button"
                  onClick={handleReloadAgentLibrary}
                  className="rounded border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:border-slate-600 dark:text-gray-200 dark:hover:bg-slate-800"
                >
                  Try Again
                </button>
              </div>
            ) : agentLibrary.length === 0 ? (
              <p className="text-sm text-gray-600 dark:text-gray-300">No agents available in the library.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {agentLibrary.map((libraryAgent, index) => (
                  <div
                    key={libraryAgent.__key || `${libraryAgent.name || 'agent'}-${index}`}
                    className="flex h-full flex-col rounded border border-gray-200 p-3 dark:border-slate-700"
                  >
                    <div className="flex-1 space-y-2">
                      <div>
                        <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{libraryAgent.name || 'Unnamed Agent'}</h4>
                        {libraryAgent.role ? (
                          <p className="text-xs text-gray-600 dark:text-gray-300">Role: {libraryAgent.role}</p>
                        ) : null}
                      </div>
                      {libraryAgent.goal ? (
                        <div>
                          <div className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Goal</div>
                          <p className="text-xs text-gray-600 dark:text-gray-300">{libraryAgent.goal}</p>
                        </div>
                      ) : null}
                      {libraryAgent.backstory ? (
                        <div>
                          <div className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Backstory</div>
                          <p className="text-xs text-gray-600 dark:text-gray-300">{libraryAgent.backstory}</p>
                        </div>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddAgentFromLibrary(libraryAgent)}
                      className="mt-3 rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-400"
                      disabled={isSubmitting}
                    >
                      Add to Crew
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-8">
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col text-sm text-gray-700 dark:text-gray-200">
            <span className="mb-1 font-medium">Crew ID</span>

            <input
              type="text"
              value={formState.id}
              onChange={event => updateMetadataField('id', event.target.value)}
              className={baseInputClasses}
              disabled={mode === 'edit' || isSubmitting}
            />
          </label>
          <label className="flex flex-col text-sm text-gray-700 flex-1 min-w-[200px] dark:text-gray-200">
            <span className="mb-1 font-medium">Name</span>

            <input
              type="text"
              value={formState.name}
              onChange={event => updateMetadataField('name', event.target.value)}
              className={baseInputClasses}
              disabled={isSubmitting}
            />
          </label>
          <label className="flex flex-col text-sm text-gray-700 min-w-[200px] dark:text-gray-200">
            <span className="mb-1 font-medium">Icon</span>

            <input
              type="text"
              value={formState.icon}
              onChange={event => updateMetadataField('icon', event.target.value)}
              className={baseInputClasses}
              disabled={isSubmitting}
              placeholder="Optional icon identifier"
            />
          </label>
        </div>
        <label className="flex flex-col text-sm text-gray-700 dark:text-gray-200">
          <span className="mb-1 font-medium">Crew Description</span>
          <textarea
            value={formState.description}
            onChange={event => updateMetadataField('description', event.target.value)}
            className="min-h-[96px] rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950/60 dark:text-gray-100 dark:focus:border-blue-400"

            disabled={isSubmitting}
          />
        </label>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Agents</h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleOpenAgentLibrary}
              className="rounded border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:border-slate-600 dark:text-gray-200 dark:hover:bg-slate-800"
              disabled={isSubmitting}
            >
              Browse Library
            </button>
            <button
              type="button"
              onClick={handleAddAgent}
              className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-400"
              disabled={isSubmitting}
            >
              Add Agent
            </button>
          </div>
        </div>
        {agentsInOrder.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Add at least one agent to define the crew.</p>
        ) : (
          <div className="space-y-4">
            {agentsInOrder.map((agent, orderIndex) => {
              const agentIndex = formState.agents.findIndex(item => item?.__key === agent?.__key);
              return renderAgentCard(agent, agentIndex, orderIndex);
            })}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Tasks</h2>
          <button
            type="button"
            onClick={handleAddTask}
            className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-400"
            disabled={isSubmitting}
          >
            Add Task
          </button>
        </div>
        {tasksInOrder.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Add at least one task to define the crew workflow.</p>
        ) : (
          <div className="space-y-4">
            {tasksInOrder.map((task, orderIndex) => {
              const taskIndex = formState.tasks.findIndex(item => item?.__key === task?.__key);
              return renderTaskCard(task, taskIndex, orderIndex);
            })}
          </div>
        )}
      </div>

      {(formError || externalError) && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">

          {formError || externalError}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {mode === 'edit' && onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="rounded border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-500/60 dark:text-red-300 dark:hover:bg-red-500/10"
            disabled={isSubmitting}
          >
            Delete Crew
          </button>
        )}
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:border-slate-600 dark:text-gray-200 dark:hover:bg-slate-800"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            data-testid="crew-editor-submit"
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-400"
            disabled={isSubmitting}
          >
            {mode === 'edit' ? (isSubmitting ? 'Saving...' : 'Save Changes') : (isSubmitting ? 'Creating...' : 'Create Crew')}
          </button>
        </div>
      </div>
      </form>
      {renderAgentLibraryModal()}
    </>
  );
};

export default CrewEditorForm;
