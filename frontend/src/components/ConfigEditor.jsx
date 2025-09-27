import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Save, History, RotateCcw, Trash2 } from 'lucide-react';
import Editor from '@monaco-editor/react';

const ConfigEditor = ({
  target,
  content,
  onChangeContent,
  onSave,
  onCancel,
  isSaving,
  saveSucceeded,
  saveError,
  isLoading,
  storageKey,
  onClearDrafts,
}) => {
  const editorRef = useRef(null);

  const language = useMemo(
    () => (target?.type === 'env' ? 'ini' : 'yaml'),
    [target?.type]
  );

  const placeholder = useMemo(() => {
    if (!target) {
      return '';
    }

    return target.type === 'env'
      ? 'Edit environment variables (KEY=VALUE)'
      : 'Edit YAML configuration...';
  }, [target]);

  const autosaveTimerRef = useRef(null);
  const previousContentRef = useRef();
  const clearingDraftsRef = useRef(false);
  const versionsStorageKey = useMemo(
    () => (storageKey ? `${storageKey}:versions` : null),
    [storageKey]
  );
  const [autosaveStatus, setAutosaveStatus] = useState('idle');
  const [lastAutosave, setLastAutosave] = useState(null);
  const [versions, setVersions] = useState([]);
  const versionsRef = useRef([]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const isMonacoCancellation = (reason) => {
      if (!reason) {
        return false;
      }

      const collectText = [];

      if (typeof reason === 'string') {
        collectText.push(reason);
      } else {
        if (typeof reason.message === 'string') {
          collectText.push(reason.message);
        }
        if (typeof reason.name === 'string') {
          collectText.push(reason.name);
        }
      }

      const joinedText = collectText.join(' ').toLowerCase();
      if (!joinedText.includes('cancel')) {
        return false;
      }

      const stackText =
        typeof reason === 'object' && typeof reason.stack === 'string'
          ? reason.stack.toLowerCase()
          : '';

      return (
        joinedText.includes('canceled') ||
        joinedText.includes('cancelled') ||
        stackText.includes('monaco') ||
        stackText.includes('wordhighlighter') ||
        stackText.includes('async.ts')
      );
    };

    const handleUnhandledRejection = (event) => {
      try {
        if (isMonacoCancellation(event?.reason)) {
          if (typeof event.preventDefault === 'function') {
            event.preventDefault();
          }
          if (typeof event.stopImmediatePropagation === 'function') {
            event.stopImmediatePropagation();
          }
        }
      } catch (error) {
        console.warn('Failed to filter Monaco cancellation error', error);
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  const persistVersions = useCallback((entries) => {
    if (!versionsStorageKey || typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(versionsStorageKey, JSON.stringify(entries));
    } catch (error) {
      console.warn('Failed to persist autosave versions', error);
    }
  }, [versionsStorageKey]);

  const buildSnippet = useCallback((value) => {
    if (!value) {
      return '(empty file)';
    }

    const normalized = value.replace(/\s+/g, ' ').trim();
    if (!normalized) {
      return '(empty file)';
    }

    return normalized.length > 120 ? `${normalized.slice(0, 117)}...` : normalized;
  }, []);

  const formatRelativeTime = useCallback((timestamp) => {
    if (!timestamp) {
      return '';
    }

    const diffSeconds = Math.floor((Date.now() - timestamp) / 1000);
    if (diffSeconds < 5) {
      return 'just now';
    }
    if (diffSeconds < 60) {
      return `${diffSeconds}s ago`;
    }
    if (diffSeconds < 3600) {
      const minutes = Math.floor(diffSeconds / 60);
      return `${minutes}m ago`;
    }

    return new Date(timestamp).toLocaleString();
  }, []);

  useEffect(() => {
    if (!versionsStorageKey || typeof window === 'undefined') {
      versionsRef.current = [];
      setVersions([]);
      setAutosaveStatus('idle');
      setLastAutosave(null);
      previousContentRef.current = undefined;
      return;
    }

    try {
      const stored = window.localStorage.getItem(versionsStorageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          versionsRef.current = parsed;
          setVersions(parsed);
          if (parsed.length > 0) {
            const mostRecent = parsed[0];
            if (typeof mostRecent.timestamp === 'number') {
              setLastAutosave(mostRecent.timestamp);
            }
            setAutosaveStatus('saved');
          } else {
            setAutosaveStatus('idle');
            setLastAutosave(null);
          }
        } else {
          versionsRef.current = [];
          setVersions([]);
          setAutosaveStatus('idle');
          setLastAutosave(null);
        }
      } else {
        versionsRef.current = [];
        setVersions([]);
        setAutosaveStatus('idle');
        setLastAutosave(null);
      }
    } catch (error) {
      console.warn('Failed to load autosave versions', error);
        versionsRef.current = [];
        setVersions([]);
      setAutosaveStatus('idle');
      setLastAutosave(null);
    }

    previousContentRef.current = undefined;
  }, [versionsStorageKey]);

  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') {
      return;
    }

    try {
      const draft = window.localStorage.getItem(storageKey);
      if (!draft) {
        return;
      }

      const trimmed = draft.trim();
      if (!trimmed) {
        return;
      }

      const looksLikeJson = ['{', '[', '"'].includes(trimmed[0]);

      if (looksLikeJson) {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object' && typeof parsed.updatedAt === 'number') {
          setLastAutosave(parsed.updatedAt);
          setAutosaveStatus('saved');
          return;
        }

        if (typeof parsed === 'string') {
          setAutosaveStatus('saved');
          const latestVersion = versionsRef.current?.[0];
          if (latestVersion && typeof latestVersion.timestamp === 'number') {
            setLastAutosave(latestVersion.timestamp);
          }
          return;
        }
      }

      setAutosaveStatus('saved');
      const latestVersion = versionsRef.current?.[0];
      if (latestVersion && typeof latestVersion.timestamp === 'number') {
        setLastAutosave(latestVersion.timestamp);
      } else {
        setLastAutosave(null);
      }
    } catch (error) {
      console.warn('Failed to read autosave metadata', error);
      setAutosaveStatus('saved');
      const latestVersion = versionsRef.current?.[0];
      if (latestVersion && typeof latestVersion.timestamp === 'number') {
        setLastAutosave(latestVersion.timestamp);
      }
    }
  }, [storageKey]);

  useEffect(() => {
    previousContentRef.current = undefined;
  }, [storageKey, target]);

  useEffect(() => {
    if (!storageKey || typeof window === 'undefined' || !target) {
      return undefined;
    }

    if (content === previousContentRef.current) {
      return undefined;
    }

    previousContentRef.current = content;

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    setAutosaveStatus('saving');

    autosaveTimerRef.current = window.setTimeout(() => {
      const timestamp = Date.now();
      setLastAutosave(timestamp);
      setAutosaveStatus('saved');

      const nextEntry = {
        id: timestamp,
        timestamp,
        isoTimestamp: new Date(timestamp).toISOString(),
        content: content ?? '',
        snippet: buildSnippet(content ?? ''),
      };

      const baseList = clearingDraftsRef.current ? [] : versionsRef.current;
      const withoutDuplicate = baseList.filter(version => version.content !== nextEntry.content);
      const updated = [nextEntry, ...withoutDuplicate].slice(0, 5);
      versionsRef.current = updated;
      persistVersions(updated);
      clearingDraftsRef.current = false;
      setVersions(updated);
    }, 600);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [buildSnippet, content, persistVersions, storageKey, target]);

  useEffect(() => () => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }
  }, []);

  const autosaveMessage = useMemo(() => {
    if (autosaveStatus === 'saving') {
      return 'Autosaving...';
    }

    if (autosaveStatus === 'restored') {
      return lastAutosave
        ? `Draft restored from ${formatRelativeTime(lastAutosave)}`
        : 'Draft restored';
    }

    if (autosaveStatus === 'saved') {
      return lastAutosave
        ? `Last autosaved ${formatRelativeTime(lastAutosave)}`
        : 'Autosaved';
    }

    return 'Autosave ready';
  }, [autosaveStatus, formatRelativeTime, lastAutosave]);

  const handleRestoreVersion = useCallback((version) => {
    if (!version) {
      return;
    }

    onChangeContent(version.content ?? '');
    if (editorRef.current?.focus) {
      editorRef.current.focus();
    }

    setAutosaveStatus('restored');
    setLastAutosave(typeof version.timestamp === 'number' ? version.timestamp : Date.now());
  }, [onChangeContent]);

  const handleClearDrafts = useCallback(() => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    previousContentRef.current = content;
    clearingDraftsRef.current = true;
    versionsRef.current = [];
    setVersions([]);
    persistVersions([]);
    setAutosaveStatus('idle');
    setLastAutosave(null);

    if (typeof onClearDrafts === 'function') {
      try {
        const result = onClearDrafts();
        if (result && typeof result.then === 'function') {
          result.catch(error => console.warn('Failed to clear drafts via parent handler', error));
        }
      } catch (error) {
        console.warn('Failed to clear drafts via parent handler', error);
      }
    }
  }, [content, onClearDrafts, persistVersions]);

  const skeletonLineWidths = useMemo(
    () => ['w-full', 'w-11/12', 'w-10/12', 'w-full', 'w-9/12', 'w-full', 'w-8/12', 'w-11/12', 'w-10/12', 'w-7/12'],
    []
  );

  const handleEditorMount = useCallback((editorInstance) => {
    editorRef.current = editorInstance;
    editorInstance?.focus();
  }, []);

  const editorOptions = useMemo(
    () => ({
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      fontSize: 14,
      fontFamily:
        "'Fira Code', 'Fira Mono', 'Menlo', 'Consolas', 'Liberation Mono', 'Courier New', monospace",
      automaticLayout: true,
    }),
    []
  );

  useEffect(() => {
    if (!target || isLoading) {
      return;
    }

    if (editorRef.current) {
      editorRef.current.focus();
    }
  }, [isLoading, target]);

  if (!target) {
    return null;
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Editing {target.name}</h2>
        <div className="flex gap-2">
          <button
            onClick={onSave}
            disabled={isSaving}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 transition-colors ${
              isSaving
                ? 'cursor-not-allowed bg-gray-400 text-gray-100 dark:bg-slate-700'
                : 'bg-green-600 text-white hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-400'
            }`}
          >
            {isSaving ? (
              <>
                <div className="inline-block h-4 w-4 animate-spin rounded-full border-b-2 border-t-2 border-white"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save
              </>
            )}
          </button>
          <button
            onClick={onCancel}
            className="rounded-lg bg-gray-200 px-4 py-2 text-gray-800 transition-colors hover:bg-gray-300 dark:bg-slate-800 dark:text-gray-200 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
        </div>
      </div>

      <div
        className="sr-only"
        aria-live={saveError ? 'assertive' : 'polite'}
        aria-atomic="true"
      >
        {saveError
          ? `Error saving configuration: ${saveError}`
          : saveSucceeded
            ? `${target.name} saved successfully.`
            : ''}
      </div>

      {isLoading ? (
        <div
          className="h-96 overflow-hidden rounded-md border border-dashed border-gray-200 bg-gray-50 dark:border-slate-700 dark:bg-slate-900"
          data-testid="config-editor-skeleton"
        >
          <div className="flex h-full flex-col gap-4 p-4">
            <div className="space-y-2">
              <div className="h-4 w-1/3 animate-pulse rounded bg-gray-200 dark:bg-slate-800" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-gray-100 dark:bg-slate-700" />
            </div>
            <div className="flex-1 space-y-3 overflow-hidden rounded-md border border-gray-200 bg-white/60 p-4 dark:border-slate-700 dark:bg-slate-800/70">
              {skeletonLineWidths.map((width, index) => (
                <div
                  key={index}
                  className={`h-3 animate-pulse rounded bg-gray-100 dark:bg-slate-700 ${width}`}
                />
              ))}
            </div>
            <div className="flex gap-3">
              <div className="h-9 w-24 animate-pulse rounded bg-gray-200 dark:bg-slate-800" />
              <div className="h-9 w-24 animate-pulse rounded bg-gray-200 dark:bg-slate-800" />
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="relative h-96">
            {!content && (
              <div className="pointer-events-none absolute left-4 top-4 text-sm text-gray-400 dark:text-gray-500">
                {placeholder}
              </div>
            )}
            <Editor
              data-testid="config-editor"
              height="100%"
              value={content}
              language={language}
              onChange={(value) => onChangeContent(value ?? '')}
              onMount={handleEditorMount}
              options={editorOptions}
              theme="vs-light"
            />
          </div>

          <div
            className="mt-4 flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-600 transition-colors dark:border-slate-800 dark:bg-slate-900 dark:text-gray-300"
            data-testid="autosave-status"
          >
            <div className="flex items-center gap-2 font-medium text-gray-700 dark:text-gray-200">
              <RotateCcw className="h-4 w-4" />
              Autosave status
            </div>
            <span className="text-gray-600 dark:text-gray-300">{autosaveMessage}</span>
          </div>

          <div
            className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4 transition-colors dark:border-slate-800 dark:bg-slate-900"
            data-testid="autosave-versions"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
                <History className="h-4 w-4" />
                Autosaved drafts
              </div>
              <button
                type="button"
                onClick={handleClearDrafts}
                disabled={versions.length === 0}
                className={`flex items-center gap-2 rounded-md border px-3 py-1 text-sm font-medium transition-colors ${
                  versions.length === 0
                    ? 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-500'
                    : 'border-red-200 bg-red-50 text-red-600 hover:border-red-300 hover:bg-red-100 dark:border-red-500 dark:bg-red-500/10 dark:text-red-300 dark:hover:border-red-400 dark:hover:bg-red-500/20'
                }`}
              >
                <Trash2 className="h-4 w-4" />
                Clear drafts
              </button>
            </div>

            {versions.length === 0 ? (
              <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">No autosaved drafts yet.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {versions.map((version, index) => (
                  <li
                    key={version.id || version.timestamp || index}
                    className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3 transition-colors dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        {version.timestamp
                          ? new Date(version.timestamp).toLocaleString()
                          : version.isoTimestamp || 'Unknown time'}
                      </p>
                      <p className="mt-1 truncate text-sm text-gray-700 dark:text-gray-200">
                        {version.snippet || '(empty file)'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRestoreVersion(version)}
                      className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700 transition-colors hover:border-blue-300 hover:bg-blue-100 dark:border-blue-400 dark:bg-blue-500/10 dark:text-blue-200 dark:hover:border-blue-300 dark:hover:bg-blue-500/20"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Restore
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default React.memo(ConfigEditor);
