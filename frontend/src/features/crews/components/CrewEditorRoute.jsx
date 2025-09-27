import React from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import TemplateGallery from './TemplateGallery';
import CrewEditorForm from '../../../components/CrewEditorForm';
import useCrewEditorState from '../hooks/useCrewEditorState';

const CrewEditorRoute = ({ crewIdOverride, mode, ...actions }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const crewId = crewIdOverride ?? params?.crewId;

  const clonedCrewDefinition = mode === 'create'
    ? location.state?.clonedCrewDefinition
    : undefined;

  const {
    heading,
    effectiveInitialData,
    showLoadingState,
    showErrorState,
    submitting,
    error,
    combinedTemplateError,
    selectedTemplateId,
    applyingTemplate,
    handleTemplateSelection,
    handleRefreshTemplates,
    handleSubmit,
    handleDelete,
    handleCancel,
    showTemplateGallery,
    crewTemplates,
    crewTemplatesLoading,
  } = useCrewEditorState({
    ...actions,
    mode,
    crewId,
    clonedCrewDefinition,
    navigate,
  });

  if (showLoadingState) {
    return (
      <div className="p-6">
        <div className="mx-auto max-w-5xl rounded border border-gray-200 bg-white px-6 py-8 text-sm text-gray-600 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-300">
          Loading crew definition...
        </div>
      </div>
    );
  }

  if (showErrorState) {
    return (
      <div className="p-6">
        <div className="mx-auto max-w-5xl space-y-4">
          <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
            {error}
          </div>
          <button
            type="button"
            onClick={handleCancel}
            className="inline-flex items-center rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-slate-600 dark:text-gray-200 dark:hover:bg-slate-800"
          >
            Back to crews
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="space-y-4">
          {mode === 'edit' && (
            <div>
              <button
                type="button"
                onClick={handleCancel}
                className="inline-flex items-center gap-2 rounded-lg border border-transparent px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:text-gray-200 dark:hover:text-white dark:focus-visible:ring-offset-slate-900"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Back to crews
              </button>
            </div>
          )}
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{heading}</h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              {mode === 'create'
                ? 'Define crew metadata, agents, and tasks to create a new automation.'
                : 'Update crew metadata, agents, and tasks. Changes are saved to crew.json, agents.yaml, and tasks.yaml.'}
            </p>
          </div>
        </div>
        {showTemplateGallery && (
          <TemplateGallery
            templates={crewTemplates}
            loading={crewTemplatesLoading}
            isApplying={applyingTemplate}
            selectedTemplateId={selectedTemplateId}
            error={combinedTemplateError}
            onRefresh={handleRefreshTemplates}
            onSelect={handleTemplateSelection}
          />
        )}
        <CrewEditorForm
          initialData={effectiveInitialData}
          mode={mode}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          onDelete={mode === 'edit' ? handleDelete : undefined}
          isSubmitting={submitting || applyingTemplate}
          error={error}
        />
      </div>
    </div>
  );
};

export default CrewEditorRoute;
