import React, { useMemo } from 'react';
import { ArrowLeft, PenSquare } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

import CrewDetailPanel from './CrewDetailPanel';

const includesId = (collection, id) => {
  if (!id) {
    return false;
  }

  if (collection instanceof Set) {
    return collection.has(id);
  }

  if (Array.isArray(collection)) {
    return collection.includes(id);
  }

  if (collection && typeof collection === 'object') {
    return Boolean(collection[id]);
  }

  return false;
};

const CrewDetailPage = ({
  crew,
  crewsLoading,
  runningCrews,
  pendingStarts,
  pendingStops,
  crewLogs = {},
  logFilters,
  onChangeLogFilters,
  onResetLogFilters,
  createPreferredLogFilters,
  logFontSize = 'medium',
  onStartCrew,
  onStopCrew,
  onEditCrew,
  crewError
}) => {
  const navigate = useNavigate();
  const { crewId: rawCrewId } = useParams();

  const decodedCrewId = useMemo(() => {
    if (typeof rawCrewId !== 'string' || rawCrewId.length === 0) {
      return '';
    }

    try {
      return decodeURIComponent(rawCrewId);
    } catch (error) {
      console.warn('Failed to decode crewId parameter', error);
      return rawCrewId;
    }
  }, [rawCrewId]);

  const normalizedCrew = useMemo(() => {
    if (!crew) {
      return null;
    }

    const nextId = crew?.id != null ? String(crew.id) : decodedCrewId;

    return {
      ...crew,
      id: nextId
    };
  }, [crew, decodedCrewId]);

  const activeCrewId = normalizedCrew?.id || decodedCrewId;

  const crewLogsForCrew = useMemo(() => {
    if (!activeCrewId) {
      return [];
    }

    const entries = crewLogs?.[String(activeCrewId)];
    return Array.isArray(entries) ? entries : [];
  }, [activeCrewId, crewLogs]);

  const isRunning = useMemo(() => includesId(runningCrews, activeCrewId), [runningCrews, activeCrewId]);
  const isPendingStart = useMemo(() => includesId(pendingStarts, activeCrewId), [pendingStarts, activeCrewId]);
  const isPendingStop = useMemo(() => includesId(pendingStops, activeCrewId), [pendingStops, activeCrewId]);

  const handleBack = () => {
    navigate('/crews');
  };

  const handleEditCrew = () => {
    if (typeof onEditCrew === 'function' && activeCrewId) {
      onEditCrew(activeCrewId);
    }
  };

  const heading = normalizedCrew?.name || decodedCrewId || 'Crew details';
  const description = normalizedCrew?.description || '';

  let content;

  if (normalizedCrew) {
    content = (
      <CrewDetailPanel
        crew={normalizedCrew}
        isRunning={isRunning}
        isPendingStart={isPendingStart}
        isPendingStop={isPendingStop}
        onStartCrew={onStartCrew}
        onStopCrew={onStopCrew}
        crewLogs={crewLogsForCrew}
        logFilters={logFilters}
        onChangeLogFilters={onChangeLogFilters}
        onResetLogFilters={onResetLogFilters}
        createPreferredLogFilters={createPreferredLogFilters}
        logFontSize={logFontSize}
        crewError={crewError}
      />
    );
  } else if (crewsLoading) {
    content = (
      <div className="flex h-full items-center justify-center text-gray-600 dark:text-gray-300">
        <div className="flex items-center gap-3 text-sm">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-b-2 border-t-2 border-blue-500" />
          Loading crew details…
        </div>
      </div>
    );
  } else {
    content = (
      <div className="mx-auto max-w-3xl rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-gray-600 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-300">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Crew not found</h2>
        <p className="mt-2 text-sm">
          We couldn&apos;t find a crew with the identifier
          {decodedCrewId ? (
            <span className="ml-1 font-mono text-gray-800 dark:text-gray-100">{decodedCrewId}</span>
          ) : ' provided.'}
        </p>
        <p className="mt-2 text-sm">
          Return to the crews list to select a different crew.
        </p>
        <button
          type="button"
          onClick={handleBack}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-500 dark:hover:bg-blue-400 dark:focus:ring-offset-slate-950"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to crews
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-gray-50 text-gray-900 transition-colors dark:bg-slate-950 dark:text-gray-100">
      <div className="border-b border-gray-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex w-fit items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-slate-700 dark:bg-slate-950 dark:text-gray-200 dark:hover:bg-slate-800 dark:focus:ring-offset-slate-950"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to crews
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-semibold text-gray-900 dark:text-gray-100">{heading}</h1>
              {description ? (
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{description}</p>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleEditCrew}
              disabled={!activeCrewId || typeof onEditCrew !== 'function'}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-75 dark:bg-blue-500 dark:hover:bg-blue-400 dark:focus:ring-offset-slate-950"
            >
              <PenSquare className="h-4 w-4" />
              Edit crew
            </button>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-5xl">
          {content}
        </div>
      </div>
    </div>
  );
};

export default CrewDetailPage;
