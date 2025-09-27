import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';

import { API_BASE } from '../../config/apiConfig';

const INITIAL_FORM_STATE = {
  name: '',
  role: '',
  goal: '',
  backstory: ''
};

const FIELD_LABELS = {
  name: 'Agent name',
  role: 'Role',
  goal: 'Goal',
  backstory: 'Backstory'
};

const AgentLibraryPanel = () => {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [formValues, setFormValues] = useState(INITIAL_FORM_STATE);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [editingUserIndex, setEditingUserIndex] = useState(null);
  const isActiveRef = useRef(true);

  const loadAgents = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const response = await axios.get(`${API_BASE}/agents`);
      const entries = Array.isArray(response.data) ? response.data : [];
      if (!isActiveRef.current) {
        return;
      }
      setAgents(entries);
    } catch (error) {
      const message =
        error?.response?.data?.detail || error?.message || 'Failed to load agent library.';
      if (isActiveRef.current) {
        setLoadError(message);
      }
    } finally {
      if (isActiveRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    isActiveRef.current = true;
    loadAgents();

    return () => {
      isActiveRef.current = false;
    };
  }, [loadAgents]);

  const resetForm = useCallback(() => {
    setFormValues(INITIAL_FORM_STATE);
    setFieldErrors({});
    setEditingUserIndex(null);
  }, [setFormValues, setFieldErrors, setEditingUserIndex]);

  const isEditing = Number.isInteger(editingUserIndex);

  const handleEditAgent = useCallback(
    (agent) => {
      if (typeof agent?.userIndex !== 'number') {
        return;
      }

      setFormValues({
        name: agent?.name || '',
        role: agent?.role || '',
        goal: agent?.goal || '',
        backstory: agent?.backstory || ''
      });
      setFieldErrors({});
      setSubmitError(null);
      setSubmitSuccess(null);
      setEditingUserIndex(agent.userIndex);
    },
    [setFieldErrors, setFormValues, setSubmitError, setSubmitSuccess, setEditingUserIndex]
  );

  const handleCancelEditing = useCallback(() => {
    resetForm();
    setSubmitError(null);
    setSubmitSuccess(null);
  }, [resetForm, setSubmitError, setSubmitSuccess]);

  const handleInputChange = (event) => {
    const { name, value } = event.target;

    setFormValues((current) => ({
      ...current,
      [name]: value
    }));

    if (fieldErrors[name]) {
      setFieldErrors((current) => {
        const next = { ...current };
        delete next[name];
        return next;
      });
    }

    if (submitSuccess) {
      setSubmitSuccess(null);
    }

    if (submitError) {
      setSubmitError(null);
    }
  };

  const handleDeleteAgent = useCallback(
    async (agent) => {
      if (typeof agent?.userIndex !== 'number' || submitting) {
        return;
      }

      setSubmitting(true);
      setSubmitError(null);
      setSubmitSuccess(null);

      try {
        const response = await axios.delete(`${API_BASE}/agents/${agent.userIndex}`);
        const entries = Array.isArray(response.data) ? response.data : [];

        if (!isActiveRef.current) {
          return;
        }

        setAgents(entries);

        if (editingUserIndex === agent.userIndex) {
          resetForm();
        }

        setSubmitSuccess('Agent removed from the library.');
      } catch (error) {
        if (isActiveRef.current) {
          const message =
            error?.response?.data?.detail || error?.message || 'Failed to delete agent.';
          setSubmitError(message);
        }
      } finally {
        if (isActiveRef.current) {
          setSubmitting(false);
        }
      }
    },
    [editingUserIndex, resetForm, submitting]
  );

  const validationMessages = useMemo(() => ({
    name: 'Please provide a short, descriptive name for the agent.',
    role: 'Describe what role the agent plays in the crew.',
    goal: 'Outline the agent\'s primary objective.',
    backstory: 'Share context that helps the model adopt the correct persona.'
  }), []);

  const validate = useCallback((values) => {
    const errors = {};

    Object.entries(values).forEach(([field, value]) => {
      const trimmed = typeof value === 'string' ? value.trim() : '';

      if (!trimmed) {
        const baseLabel = FIELD_LABELS[field] || field;
        errors[field] = `${baseLabel} is required.`;
      }
    });

    return errors;
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitSuccess(null);
    setSubmitError(null);

    const errors = validate(formValues);

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setSubmitError('Please fix the highlighted fields before submitting.');
      return;
    }

    const payload = Object.fromEntries(
      Object.entries(formValues).map(([field, value]) => [field, value.trim()])
    );

    setSubmitting(true);

    try {
      if (isEditing) {
        const userIndex = editingUserIndex;
        if (!Number.isInteger(userIndex) || userIndex < 0) {
          setSubmitError('Unable to determine which agent to update.');
          return;
        }

        const response = await axios.put(`${API_BASE}/agents/${userIndex}`, payload);
        const entries = Array.isArray(response.data) ? response.data : [];
        setAgents(entries);
        resetForm();
        setSubmitSuccess('Agent updated.');
      } else {
        const response = await axios.post(`${API_BASE}/agents`, payload);
        const entries = Array.isArray(response.data) ? response.data : [];
        setAgents(entries);
        resetForm();
        setSubmitSuccess('Agent added to the library.');
      }
    } catch (error) {
      const message =
        error?.response?.data?.detail || error?.message || 'Failed to add agent to the library.';
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Agent Library</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Browse curated examples and add your own reusable agents for the crew editor.
        </p>
      </header>

      <div className="space-y-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Available agents</h3>

          {loading ? (
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">Loading agent library…</p>
          ) : loadError ? (
            <div className="mt-3 space-y-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/60 dark:text-red-200" role="alert">
              <p>{loadError}</p>
              <button
                type="button"
                onClick={loadAgents}
                className="inline-flex items-center rounded-md bg-red-600 px-3 py-1 text-sm font-medium text-white shadow-sm transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:bg-red-700 dark:hover:bg-red-600"
              >
                Try again
              </button>
            </div>
          ) : agents.length === 0 ? (
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
              No agents have been added yet. Use the form below to contribute your first entry.
            </p>
          ) : (
            <ul className="mt-4 space-y-4">
              {agents.map((agent, index) => (
                <li
                  key={`${agent?.name || 'agent'}-${index}`}
                  className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:border-blue-500 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-blue-400"
                >
                  <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100">{agent?.name || 'Unnamed agent'}</h4>
                  <dl className="mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-300">
                    {agent?.role ? (
                      <div>
                        <dt className="font-medium text-gray-700 dark:text-gray-200">Role</dt>
                        <dd>{agent.role}</dd>
                      </div>
                    ) : null}
                    {agent?.goal ? (
                      <div>
                        <dt className="font-medium text-gray-700 dark:text-gray-200">Goal</dt>
                        <dd>{agent.goal}</dd>
                      </div>
                    ) : null}
                    {agent?.backstory ? (
                      <div>
                        <dt className="font-medium text-gray-700 dark:text-gray-200">Backstory</dt>
                        <dd>{agent.backstory}</dd>
                      </div>
                    ) : null}
                  </dl>
                  {agent?.source === 'user' && typeof agent?.userIndex === 'number' ? (
                    <div className="mt-3 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleEditAgent(agent)}
                        className="inline-flex items-center rounded-md border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-950 dark:text-gray-200 dark:hover:bg-slate-900"
                        aria-label={`Edit ${agent?.name || 'agent'}`}
                        disabled={submitting}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteAgent(agent)}
                        className="inline-flex items-center rounded-md border border-red-200 bg-white px-3 py-1 text-xs font-medium text-red-700 shadow-sm transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:border-red-700 dark:bg-slate-950 dark:text-red-300 dark:hover:bg-slate-900"
                        aria-label={`Delete ${agent?.name || 'agent'}`}
                        disabled={submitting}
                      >
                        Delete
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          noValidate
        >
          <div className="space-y-3">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">{isEditing ? 'Edit agent' : 'Add an agent'}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {isEditing
                ? 'Update the saved agent so everyone sees the latest guidance in the crew editor.'
                : 'Share reusable agents with your team. All fields are required to help others understand the context.'}
            </p>
            {isEditing ? (
              <p className="text-xs font-medium text-blue-700 dark:text-blue-300">
                Editing an existing entry. Use "Cancel editing" to switch back to creating new agents.
              </p>
            ) : null}
          </div>

          {submitSuccess ? (
            <p className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950/60 dark:text-green-200" role="status">
              {submitSuccess}
            </p>
          ) : null}

          {submitError ? (
            <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/60 dark:text-red-200" role="alert">
              {submitError}
            </p>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="agent-name" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                {FIELD_LABELS.name}
              </label>
              <input
                id="agent-name"
                name="name"
                type="text"
                value={formValues.name}
                onChange={handleInputChange}
                className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-gray-100"
                aria-describedby="agent-name-help"
              />
              <p id="agent-name-help" className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {validationMessages.name}
              </p>
              {fieldErrors.name ? (
                <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400" role="alert">
                  {fieldErrors.name}
                </p>
              ) : null}
            </div>

            <div>
              <label htmlFor="agent-role" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                {FIELD_LABELS.role}
              </label>
              <input
                id="agent-role"
                name="role"
                type="text"
                value={formValues.role}
                onChange={handleInputChange}
                className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-gray-100"
                aria-describedby="agent-role-help"
              />
              <p id="agent-role-help" className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {validationMessages.role}
              </p>
              {fieldErrors.role ? (
                <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400" role="alert">
                  {fieldErrors.role}
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="agent-goal" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                {FIELD_LABELS.goal}
              </label>
              <textarea
                id="agent-goal"
                name="goal"
                value={formValues.goal}
                onChange={handleInputChange}
                className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-gray-100"
                rows={3}
                aria-describedby="agent-goal-help"
              />
              <p id="agent-goal-help" className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {validationMessages.goal}
              </p>
              {fieldErrors.goal ? (
                <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400" role="alert">
                  {fieldErrors.goal}
                </p>
              ) : null}
            </div>

            <div>
              <label htmlFor="agent-backstory" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                {FIELD_LABELS.backstory}
              </label>
              <textarea
                id="agent-backstory"
                name="backstory"
                value={formValues.backstory}
                onChange={handleInputChange}
                className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-gray-100"
                rows={3}
                aria-describedby="agent-backstory-help"
              />
              <p id="agent-backstory-help" className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {validationMessages.backstory}
              </p>
              {fieldErrors.backstory ? (
                <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400" role="alert">
                  {fieldErrors.backstory}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            {isEditing ? (
              <button
                type="button"
                onClick={handleCancelEditing}
                className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-700 dark:bg-slate-950 dark:text-gray-200 dark:hover:bg-slate-900"
                disabled={submitting}
              >
                Cancel editing
              </button>
            ) : null}
            <button
              type="submit"
              className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-blue-500 dark:hover:bg-blue-400"
              disabled={submitting}
            >
              {submitting ? (isEditing ? 'Saving…' : 'Adding…') : isEditing ? 'Save changes' : 'Add Agent'}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
};

export default AgentLibraryPanel;
