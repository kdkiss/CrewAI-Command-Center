import React, { useMemo, useState } from 'react';
import { Play, Square, Monitor, AlertCircle, User, Bot, Settings, X, ExternalLink } from 'lucide-react';

import InputValuesForm from './crewManager/InputValuesForm';
import LogViewer from '../../../components/logs/LogViewer';
import { createDefaultLogFilters as baseCreateDefaultLogFilters, filterLogs } from '../../../components/logs/utils';
import CollapsibleSection from './CollapsibleSection';

const CrewDetailPanel = ({
  crew,
  isRunning,
  isPendingStart,
  isPendingStop,
  onStartCrew,
  onStopCrew,
  crewLogs,
  logFilters,
  onChangeLogFilters,
  onResetLogFilters,
  crewError,
  createPreferredLogFilters,
  logFontSize = 'medium',
  onClose,
  isDrawer = false,
  onOpenFullPage
}) => {
  const [areInputsCollapsed, setAreInputsCollapsed] = useState(false);
  const [areDetailsCollapsed, setAreDetailsCollapsed] = useState(false);
  const [isMonitorCollapsed, setIsMonitorCollapsed] = useState(false);

  const createDefaultLogFilters = useMemo(() => {
    if (typeof createPreferredLogFilters !== 'function') {
      return baseCreateDefaultLogFilters;
    }

    return () => {
      const base = baseCreateDefaultLogFilters();

      try {
        const preferred = createPreferredLogFilters();
        if (preferred && typeof preferred === 'object') {
          return { ...base, ...preferred };
        }
      } catch (error) {
        console.warn('Failed to apply preferred log filters', error);
      }

      return base;
    };
  }, [createPreferredLogFilters]);

  const actionButtonBase = `${
    isDrawer ? 'px-3 py-2 text-sm' : 'px-4 py-2 text-sm'
  } flex items-center gap-2 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-950`;

  const stopCrewButton = (
    <button
      type="button"
      onClick={() => {
        if (typeof onStopCrew === 'function') {
          onStopCrew(crew.id);
        }
      }}
      className={`${actionButtonBase} bg-red-600 text-white hover:bg-red-700 dark:hover:bg-red-500`}
    >
      <Square className="h-4 w-4" />
      Stop Crew
    </button>
  );

  const runCrewButton = (
    <button
      type="button"
      onClick={() => {
        if (typeof onStartCrew === 'function') {
          onStartCrew(crew.id);
        }
      }}
      className={`${actionButtonBase} bg-green-600 text-white hover:bg-green-700 dark:hover:bg-green-500`}
    >
      <Play className="h-4 w-4" />
      Run Crew
    </button>
  );

  let controlButton = runCrewButton;

  if (isRunning) {
    if (isPendingStop) {
      controlButton = (
        <button
          type="button"
          disabled
        className={`${actionButtonBase} bg-red-600 text-white opacity-80 disabled:cursor-not-allowed disabled:opacity-80 disabled:hover:bg-red-600`}
        >
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          Stopping...
        </button>
      );
    } else {
      controlButton = stopCrewButton;
    }
  } else if (isPendingStart) {
    controlButton = (
      <button
        type="button"
        disabled
        className={`${actionButtonBase} bg-green-600 text-white opacity-80 disabled:cursor-not-allowed disabled:opacity-80 disabled:hover:bg-green-600`}
      >
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
        Starting...
      </button>
    );
  }

  const handleOpenFullPage = () => {
    if (typeof onOpenFullPage === 'function') {
      onOpenFullPage(crew.id);
      return;
    }

    if (typeof window !== 'undefined' && crew?.id != null) {
      const crewId = String(crew.id);
      window.location.href = `/crews/${crewId}`;
    }
  };

  const openFullPageButton = isDrawer
    ? (
      <button
        type="button"
        onClick={handleOpenFullPage}
        className={`${
          isDrawer ? 'px-3 py-2 text-sm' : 'px-4 py-2 text-sm'
        } inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white font-medium text-gray-700 transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-slate-700 dark:bg-slate-950 dark:text-gray-200 dark:hover:bg-slate-800 dark:focus:ring-offset-slate-950`}
        aria-label="Open crew in full page"
      >
        <ExternalLink className="h-4 w-4" />
        Open full page ↗︎
      </button>
    )
    : null;

  const closeButton = isDrawer && typeof onClose === 'function'
    ? (
      <button
        type="button"
        onClick={onClose}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-gray-500 transition hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:text-gray-300 dark:hover:text-gray-100 dark:focus:ring-offset-slate-950"
        aria-label="Close crew details"
        title="Close"
        data-testid="crew-detail-close-button"
      >
        <X className="h-4 w-4" />
      </button>
    )
    : null;

  const headerClassName = isDrawer
    ? 'flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-4 dark:border-slate-800'
    : 'flex flex-wrap items-center justify-between gap-4';

  const titleClassName = isDrawer
    ? 'text-lg font-semibold text-gray-900 dark:text-gray-100'
    : 'text-2xl font-semibold text-gray-900 dark:text-gray-100';

  const descriptionClassName = isDrawer
    ? 'mt-1 text-sm text-gray-600 dark:text-gray-300'
    : 'text-gray-600 dark:text-gray-300';

  const actionsClassName = isDrawer
    ? 'flex flex-shrink-0 items-center gap-2'
    : 'flex flex-wrap items-center justify-end gap-2';

  const header = (
    <div className={headerClassName}>
      <div className="min-w-0 flex-1">
        <h2 className={titleClassName}>{crew.name}</h2>
        {crew.description ? <p className={descriptionClassName}>{crew.description}</p> : null}
      </div>
      <div className={actionsClassName}>
        {openFullPageButton}
        {controlButton}
        {closeButton}
      </div>
    </div>
  );

  const sections = (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CollapsibleSection
          title="Input Values"
          icon={Settings}
          isCollapsed={areInputsCollapsed}
          onToggle={setAreInputsCollapsed}
          toggleAriaLabel="Toggle input values"
        >
          <InputValuesForm
            crew={crew}
            hideHeader
            containerClassName=""
          />
        </CollapsibleSection>

        <CollapsibleSection
          title="Crew Details"
          icon={User}
          isCollapsed={areDetailsCollapsed}
          onToggle={setAreDetailsCollapsed}
          toggleAriaLabel="Toggle crew details"
        >
          <div className="space-y-4">
            <div>
              <h4 className="mb-2 font-medium text-gray-700 dark:text-gray-200">Agents</h4>
              <div className="flex flex-wrap gap-2">
                {crew.agents.map((agent, index) => {
                  const agentKey = typeof agent === 'object' ? (agent.name || agent.role || String(index)) : String(agent);
                  return (
                    <span
                      key={`${agentKey}-${index}`}
                      className="rounded bg-blue-100 px-2 py-1 text-sm text-blue-800 dark:bg-blue-900/40 dark:text-blue-200"
                    >
                      <Bot className="mr-1 inline h-3 w-3" />
                      {typeof agent === 'object' ? agent.name || agent.role || 'Unknown Agent' : agent}
                    </span>
                  );
                })}
              </div>
            </div>
            <div>
              <h4 className="mb-2 font-medium text-gray-700 dark:text-gray-200">Tasks</h4>
              <div className="space-y-1">
                {crew.tasks.map((task, index) => {
                  const taskKey = typeof task === 'object' ? (task.name || task.description || String(index)) : String(task);
                  return (
                    <div key={`${taskKey}-${index}`} className="text-sm text-gray-600 dark:text-gray-300">
                      • {typeof task === 'object' ? task.name || task.description || 'Unknown Task' : task.replace('_', ' ')}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </CollapsibleSection>
      </div>

      <CollapsibleSection
        title="Execution Monitor"
        icon={Monitor}
        className="lg:col-span-2"
        isCollapsed={isMonitorCollapsed}
        onToggle={setIsMonitorCollapsed}
        toggleAriaLabel="Toggle execution monitor"
      >
        <div className="space-y-4">
          {crewError && (
            <div className="rounded-lg border border-red-400 bg-red-100 p-3 text-red-700 dark:border-red-500 dark:bg-red-900/40 dark:text-red-200">
              <div className="flex items-center">
                <AlertCircle className="mr-2 h-5 w-5" />
                <span>Error: {crewError}</span>
              </div>
            </div>
          )}

          {crewLogs?.length ? (
            <LogViewer
              logs={crewLogs}
              filters={logFilters}
              onFiltersChange={onChangeLogFilters}
              onClearFilters={onResetLogFilters}
              createDefaultLogFilters={createDefaultLogFilters}
              filterLogs={filterLogs}
              logFontSize={logFontSize}
            />
          ) : (
            <div className="py-8 text-center text-gray-500 dark:text-gray-400">
              <Monitor className="mx-auto mb-2 h-12 w-12 opacity-50" />
              <p>No execution logs yet</p>
              <p className="text-sm text-gray-600 dark:text-gray-300">Run the crew to see real-time monitoring</p>
            </div>
          )}
        </div>
      </CollapsibleSection>
    </div>
  );

  if (isDrawer) {
    return (
      <div className="flex h-full flex-col bg-white dark:bg-slate-950">
        {header}
        <div className="flex-1 overflow-y-auto px-6 py-4">{sections}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}
      {sections}
    </div>
  );
};

export default CrewDetailPanel;
