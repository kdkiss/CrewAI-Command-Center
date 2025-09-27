import React from 'react';
import { FolderOpen } from 'lucide-react';

import ConfigEditor from '../../../../components/ConfigEditor';
import CrewList from './CrewList';
import { useCrewConfigEditorContext, useCrewManagerState } from './useCrewManagerState';

const CrewDetails = ({
  view = 'crews',
  crewListView = 'grid',
  setCrewListPreferences,
  onSelectCrew,
  onOpenCrewPage,
  onStartCrew,
  onStopCrew,
  onEditCrew,
  onCloneCrew,
  onDeleteCrew,
}) => {
  const {
    selectedCrew,
  } = useCrewManagerState();
  const {
    editorTarget,
    editorContent,
    setEditorContent,
    saveEditorContent,
    closeEditor,
    savingFile,
    saveSuccess,
    saveError,
    editorLoading,
    editorStorageKey,
    clearAutosavedDrafts,
  } = useCrewConfigEditorContext();

  if (view === 'crews' && !editorTarget) {
    return (
      <CrewList
        crewListView={crewListView}
        setCrewListPreferences={setCrewListPreferences}
        onSelectCrew={onSelectCrew}
        onOpenCrewPage={onOpenCrewPage}
        onStartCrew={onStartCrew}
        onStopCrew={onStopCrew}
        onEditCrew={onEditCrew}
        onCloneCrew={onCloneCrew}
        onDeleteCrew={onDeleteCrew}
      />
    );
  }

  if (editorTarget) {
    return (
      <div className="p-6">
        <div className="space-y-6">
          <ConfigEditor
            target={editorTarget}
            content={editorContent}
            onChangeContent={setEditorContent}
            onSave={saveEditorContent}
            onCancel={closeEditor}
            isSaving={savingFile}
            saveSucceeded={saveSuccess}
            saveError={saveError}
            isLoading={editorLoading}
            storageKey={editorStorageKey}
            onClearDrafts={clearAutosavedDrafts}
          />
        </div>
      </div>
    );
  }

  const shouldShowPlaceholder = !selectedCrew;
  const isConfigView = view === 'config';

  return (
    <div className="relative min-h-full">
      {shouldShowPlaceholder ? (
        <div className="p-6">
          <div className="flex min-h-full flex-col">
            <div className="flex flex-1 items-center justify-center text-gray-500 dark:text-gray-400">
              <div className="text-center">
                <FolderOpen className="mx-auto mb-4 h-16 w-16 opacity-50" />
                <p className="mb-2 text-xl">Select a crew to get started</p>
                <p>
                  {isConfigView
                    ? 'Select a crew before editing configuration files.'
                    : 'Select a crew to open its full-page details.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-6" aria-hidden="true">
          <div className="min-h-full" />
        </div>
      )}
    </div>
  );
};

export default CrewDetails;
