import React from 'react';
import { RefreshCw, Users, ListChecks, Sparkles } from 'lucide-react';

const TemplateGallery = ({
  templates = [],
  loading = false,
  isApplying = false,
  selectedTemplateId = null,
  error = null,
  onRefresh,
  onSelect
}) => {
  const handleSelect = (templateId) => {
    if (typeof onSelect === 'function') {
      onSelect(templateId);
    }
  };

  const handleRefresh = () => {
    if (typeof onRefresh === 'function') {
      onRefresh();
    }
  };

  const showEmptyState = !loading && (!templates || templates.length === 0);
  const showApplyingMessage = isApplying && !loading;

  return (
    <section aria-labelledby="crew-template-gallery-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="crew-template-gallery-heading" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Start from a template
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Choose a blueprint to pre-fill the editor or build a crew from scratch.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleSelect(null)}
            disabled={isApplying}
            className={`rounded border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 dark:border-slate-600 dark:text-gray-200 dark:hover:bg-slate-800 ${
              selectedTemplateId == null
                ? 'border-blue-500 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-400 dark:bg-blue-500/10 dark:text-blue-200'
                : 'border-gray-300 text-gray-700 hover:bg-gray-100 dark:text-gray-200'
            }`}
            aria-pressed={selectedTemplateId == null}
          >
            Start from scratch
          </button>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            className="inline-flex h-9 w-9 items-center justify-center rounded border border-gray-300 text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-50 dark:border-slate-600 dark:text-gray-300 dark:hover:bg-slate-800"
            aria-label="Refresh templates"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200" role="alert">
          {error}
        </div>
      )}

      {showApplyingMessage && (
        <div className="text-sm text-blue-600 dark:text-blue-300">Loading template definition...</div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {loading ? (
          <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white text-sm text-gray-500 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-300">
            Loading templates...
          </div>
        ) : showEmptyState ? (
          <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white text-sm text-gray-500 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-300">
            No templates available yet.
          </div>
        ) : (
          templates.map((template) => {
            const tags = Array.isArray(template?.tags) ? template.tags : [];
            const isSelected = selectedTemplateId === template?.id;

            return (
              <button
                key={template?.id || template?.name}
                type="button"
                onClick={() => handleSelect(template?.id)}
                disabled={isApplying}
                aria-pressed={isSelected}
                className={`group flex h-full flex-col justify-between rounded-lg border bg-white p-4 text-left text-gray-900 shadow-sm transition-colors hover:border-blue-500 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-75 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-100 ${
                  isSelected ? 'border-blue-500 ring-2 ring-blue-400 dark:border-blue-400' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  {template?.icon ? (
                    <span className="text-3xl" aria-hidden="true">{template.icon}</span>
                  ) : (
                    <Sparkles className="h-6 w-6 text-blue-500" aria-hidden="true" />
                  )}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold">{template?.name || template?.id}</h3>
                      {isSelected && (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-500/20 dark:text-blue-200">
                          Selected
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-3 dark:text-gray-300">
                      {template?.description || 'Reusable configuration for a new crew.'}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" aria-hidden="true" />
                    <span>{template?.agentCount ?? 0} agents</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ListChecks className="h-4 w-4" aria-hidden="true" />
                    <span>{template?.taskCount ?? 0} tasks</span>
                  </div>
                </div>

                {tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-slate-800 dark:text-gray-300"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>
    </section>
  );
};

export default TemplateGallery;
