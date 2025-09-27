import React, { useMemo } from 'react';
import { FileText, Edit, Settings, AlertCircle } from 'lucide-react';

const getCrewLabel = (crew) => {
  if (!crew) {
    return '';
  }

  const metadataName = crew?.metadata?.name;
  if (metadataName && typeof metadataName === 'string') {
    const trimmed = metadataName.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }

  if (typeof crew?.name === 'string' && crew.name.trim().length > 0) {
    return crew.name.trim();
  }

  return String(crew.id ?? '').trim();
};

const ConfigSidebar = ({
  crews = [],
  selectedCrew,
  envFiles,
  envLoading,
  envError,
  onOpenEditor,
  onSelectCrew,
  crewsLoading
}) => {
  const crewOptions = useMemo(() => {
    if (!Array.isArray(crews)) {
      return [];
    }

    return crews
      .filter(crew => crew && crew.id != null)
      .map(crew => ({
        id: String(crew.id),
        label: getCrewLabel(crew) || String(crew.id),
        crew
      }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  }, [crews]);

  const selectedCrewId = selectedCrew?.id != null ? String(selectedCrew.id) : '';

  const handleSelectCrew = (event) => {
    const nextId = event?.target?.value;
    if (typeof onSelectCrew !== 'function') {
      return;
    }

    if (!nextId) {
      onSelectCrew(null);
      return;
    }

    const match = crewOptions.find(option => option.id === nextId);
    if (match?.crew) {
      const normalizedCrew = { ...match.crew, id: match.id };
      onSelectCrew(normalizedCrew);
    }
  };

  return (
    <div className="space-y-4 text-gray-900 dark:text-gray-100">
      <h3 className="font-semibold text-gray-900 dark:text-gray-100">Configuration</h3>
      <div className="space-y-4">
        <div className="space-y-2">
          <h4 className="text-sm font-medium uppercase tracking-wide text-gray-700 dark:text-gray-200">Crew</h4>
          {crewsLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <div className="inline-block h-4 w-4 animate-spin rounded-full border-b-2 border-t-2 border-blue-500" />
              Loading crews...
            </div>
          ) : crewOptions.length > 0 ? (
            <div className="relative">
              <label className="sr-only" htmlFor="config-sidebar-crew-select">
                Select crew
              </label>
              <select
                id="config-sidebar-crew-select"
                value={selectedCrewId}
                onChange={handleSelectCrew}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-100 dark:focus:border-blue-400 dark:focus:ring-blue-400"
              >
                <option value="" disabled>
                  Select a crew…
                </option>
                {crewOptions.map(option => (
                  <option key={option.id} value={option.id}>
                    {option.label || option.id}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-3 text-sm text-gray-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-gray-300">
              No crews available. Create a crew in the Crews tab to begin editing configuration files.
            </p>
          )}
        </div>

        {!selectedCrew && crewOptions.length > 0 ? (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-700 dark:border-yellow-500 dark:bg-yellow-900/30 dark:text-yellow-200">
            Choose a crew to enable configuration editing.
          </div>
        ) : null}

        {selectedCrew ? (
          <>
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-700 uppercase tracking-wide dark:text-gray-200">YAML Files</h4>
              <button
                onClick={() => onOpenEditor({ type: 'yaml', name: 'agents.yaml' })}
                className="flex w-full items-center gap-2 rounded-lg bg-gray-50 p-3 transition-colors hover:bg-gray-100 dark:bg-slate-900 dark:hover:bg-slate-800"
              >
                <FileText className="w-4 h-4" />
                <span>Edit agents.yaml</span>
                <Edit className="w-4 h-4 ml-auto" />
              </button>

              <button
                onClick={() => onOpenEditor({ type: 'yaml', name: 'tasks.yaml' })}
                className="flex w-full items-center gap-2 rounded-lg bg-gray-50 p-3 transition-colors hover:bg-gray-100 dark:bg-slate-900 dark:hover:bg-slate-800"
              >
                <FileText className="w-4 h-4" />
                <span>Edit tasks.yaml</span>
                <Edit className="w-4 h-4 ml-auto" />
              </button>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-700 uppercase tracking-wide dark:text-gray-200">Environment Files</h4>
              {envError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500 dark:bg-red-900/40 dark:text-red-200">
                  <AlertCircle className="mr-2 inline h-4 w-4" />
                  {envError}
                </div>
              )}
              {envLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <div className="inline-block h-4 w-4 animate-spin rounded-full border-b-2 border-t-2 border-blue-500" />
                  Loading environment files...
                </div>
              ) : envFiles.length > 0 ? (
                envFiles.map((file) => (
                  <button
                    key={file}
                    onClick={() => onOpenEditor({ type: 'env', name: file })}
                    className="flex w-full items-center gap-2 rounded-lg bg-gray-50 p-3 transition-colors hover:bg-gray-100 dark:bg-slate-900 dark:hover:bg-slate-800"
                  >
                    <Settings className="w-4 h-4" />
                    <span>Edit {file}</span>
                    <Edit className="w-4 h-4 ml-auto" />
                  </button>
                ))
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">No environment files detected for this crew.</p>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default ConfigSidebar;
