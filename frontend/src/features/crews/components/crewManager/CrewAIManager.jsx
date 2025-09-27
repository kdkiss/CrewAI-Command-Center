import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useMatch, useNavigate } from 'react-router-dom';
import { RefreshCw, FolderOpen, Menu, X, PenSquare, Plus, Sun, Moon, SlidersHorizontal } from 'lucide-react';

import {
  API_BASE,
  CrewManagerStateProvider,
  useCrewActionsContext,
  useCrewFiltersContext,
  useCrewManagerState,
  useCrewToastManager,
} from './useCrewManagerState';
import CrewDetails from './CrewDetails';
import MonitorSidebar from '../MonitorSidebar';
import ConfigSidebar from '../ConfigSidebar';
import CrewSidebar from '../CrewSidebar';
import { CrewNavLinks, CrewSidebarRoutes } from '../SidebarNavigation';
import ToastContainer from '../ToastContainer';
import ActivitySidebar from '../../../activity/ActivitySidebar';
import CrewDetailPage from '../CrewDetailPage';
import AgentLibraryPanel from '../../../library/AgentLibraryPanel';
import ExecutionMonitor from './ExecutionMonitor';
import CrewEditorRoute from '../CrewEditorRoute';
import SettingsRoute from '../SettingsRoute';
import useSidebarFocusTrap from '../../hooks/useSidebarFocusTrap';
import useConfirmDialog from '../../hooks/useConfirmDialog';

import ConfirmDialog from '../../../../components/ConfirmDialog';

import useUserPreferences from '../../../../hooks/useUserPreferences';

const CrewAIManagerContent = ({
  preferences,
  setTheme,
  toggleTheme,
  setLogFontSize,
  setDefaultLogFilters,
  setCrewListPreferences,
}) => {
  const crewListView = preferences?.crewList?.view === 'list' ? 'list' : 'grid';

  const {
    crews,
    crewsLoading,
    selectedCrew,
    setSelectedCrew,
    runningCrews,
    pendingStarts,
    pendingStops,
    crewLogs,
    activityItems,
    searchQuery,
    setSearchQuery,
    filterConfig,
    updateFilterConfig,
    sortOption,
    setSortOption,
    logFilters,
    setLogFilters,
    resetLogFilters,
    createPreferredLogFilters,
    editorTarget,
    startCrew,
    stopCrew,
    crewError,
    envFiles,
    envLoading,
    envError,
    isRefreshing,
    refreshCrews,
    refreshError,
    openEditor,
    closeEditor,
  } = useCrewManagerState();
  const {
    crewTemplates,
    crewTemplatesLoading,
    crewTemplateError,
    importingCrew,
    importStatus,
    handleImportCrew,
    createCrewDefinition,
    updateCrewDefinition,
    deleteCrew,
    fetchCrewDefinition,
    fetchCrewTemplates,
    getCrewTemplate,
  } = useCrewActionsContext();
  const {
    filteredCrews,
    availableStatusFilters,
    availableTagFilters,
  } = useCrewFiltersContext();
  const { toasts, addToast, removeToast } = useCrewToastManager();

  const location = useLocation();
  const isConfigRoute = location.pathname.startsWith('/config');
  const editMatch = location.pathname.match(/^\/crews\/([^/]+)\/edit$/);
  const isEditorRoute =
    location.pathname === '/crews/new' || Boolean(editMatch);
  const editorCrewId = editMatch ? decodeURIComponent(editMatch[1]) : undefined;

  const crewEditorRouteProps = {
    fetchCrewDefinition,
    createCrewDefinition,
    updateCrewDefinition,
    deleteCrew,
    addToast,
    setSelectedCrew,
    crewTemplates,
    crewTemplatesLoading,
    crewTemplateError,
    fetchCrewTemplates,
    getCrewTemplate
  };

  const navigate = useNavigate();
  const crewDetailMatch = useMatch('/crews/:crewId');
  const routeCrewId = useMemo(() => {
    const raw = crewDetailMatch?.params?.crewId;
    if (typeof raw !== 'string' || raw.length === 0) {
      return null;
    }

    try {
      return decodeURIComponent(raw);
    } catch (error) {
      console.warn('Failed to decode crewId route parameter', error);
      return raw;
    }
  }, [crewDetailMatch]);

  const isCrewDetailView = Boolean(routeCrewId) && !isEditorRoute;

  const theme = preferences?.theme === 'dark' ? 'dark' : 'light';
  const isDarkMode = theme === 'dark';
  const themeToggleLabel = `Switch to ${isDarkMode ? 'light' : 'dark'} theme`;
  const [showSidebar, setShowSidebar] = useState(false);
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true);
  const mobileSidebarRef = useRef(null);

  const handleOpenSidebar = useCallback(() => {
    setShowSidebar(true);
  }, []);

  const handleCloseSidebar = useCallback(() => {
    setShowSidebar(false);
  }, []);

  const handleToggleDesktopSidebar = useCallback(() => {
    setIsDesktopSidebarOpen(current => !current);
  }, []);

  const handleOpenDesktopSidebar = useCallback(() => {
    setIsDesktopSidebarOpen(true);
  }, []);

  useSidebarFocusTrap({
    isActive: showSidebar,
    containerRef: mobileSidebarRef,
    onClose: handleCloseSidebar,
  });

  const {
    state: confirmDialogState,
    body: confirmDialogBody,
    requestStopCrew: handleRequestStopCrew,
    requestDeleteCrew: handleRequestDeleteCrew,
    handleConfirm: handleConfirmDialogConfirm,
    handleCancel: handleConfirmDialogCancel,
  } = useConfirmDialog({
    crews,
    stopCrew,
    deleteCrew,
    addToast,
    setSelectedCrew,
  });

  useEffect(() => {
    if (isConfigRoute && !isDesktopSidebarOpen) {
      setIsDesktopSidebarOpen(true);
    }
  }, [isConfigRoute, isDesktopSidebarOpen]);

  useEffect(() => {
    if (isCrewDetailView) {
      setShowSidebar(false);
    }
  }, [isCrewDetailView]);

  const handleRunCrew = useCallback((crewId) => {
    if (!crewId) {
      return;
    }

    startCrew(crewId);
  }, [startCrew]);

  const handleEditCrew = useCallback((crewId) => {
    if (!crewId) {
      return;
    }

    navigate(`/crews/${encodeURIComponent(crewId)}/edit`);
  }, [navigate]);

  const handleCloneCrew = useCallback(async (crewId) => {
    if (!crewId) {
      return;
    }

    const stringCrewId = String(crewId);

    try {
      const definition = await fetchCrewDefinition(stringCrewId);

      if (!definition) {
        throw new Error('Crew definition is unavailable.');
      }

      const clonedDefinition = {
        ...definition,
        id: '',
        name: definition.name || definition.id || '',
        agents: Array.isArray(definition.agents) ? definition.agents.map(agent => ({ ...agent })) : [],
        tasks: Array.isArray(definition.tasks) ? definition.tasks.map(task => ({ ...task })) : [],
        agentOrder: Array.isArray(definition.agentOrder) ? [...definition.agentOrder] : [],
        taskOrder: Array.isArray(definition.taskOrder) ? [...definition.taskOrder] : []
      };

      navigate('/crews/new', {
        state: {
          clonedCrewDefinition: clonedDefinition
        }
      });

      setSelectedCrew(null);

      const crewName = definition.name || definition.id || stringCrewId;
      addToast({
        title: 'Crew Cloned',
        message: `Loaded ${crewName} for editing.`,
        type: 'success'
      });
    } catch (error) {
      const message = error?.response?.data?.detail || error.message || 'Failed to clone crew.';
      addToast({
        title: 'Clone Failed',
        message,
        type: 'error'
      });
    }
  }, [fetchCrewDefinition, navigate, addToast, setSelectedCrew]);

  const handleOpenCrewPage = useCallback((crewValue, options = {}) => {
    if (!crewValue) {
      return;
    }

    const { navigateToDetail = true } = options;

    let normalizedCrew = null;

    if (typeof crewValue === 'object' && crewValue !== null) {
      const crewId = crewValue?.id != null ? String(crewValue.id) : '';
      if (!crewId) {
        return;
      }
      normalizedCrew = { ...crewValue, id: crewId };
    } else {
      const crewId = crewValue != null ? String(crewValue) : '';
      if (!crewId) {
        return;
      }
      const matchingCrew = crews.find(item => String(item.id) === crewId);
      normalizedCrew = matchingCrew
        ? { ...matchingCrew, id: String(matchingCrew.id ?? crewId) }
        : { id: crewId };
    }

    if (!normalizedCrew?.id) {
      return;
    }

    setSelectedCrew(prev => {
      if (prev && String(prev.id) === normalizedCrew.id) {
        return prev;
      }
      return normalizedCrew;
    });

    if (navigateToDetail) {
      const detailPath = `/crews/${encodeURIComponent(normalizedCrew.id)}`;

      if (location.pathname !== detailPath) {
        navigate(detailPath);
      }
    }
  }, [crews, location.pathname, navigate, setSelectedCrew]);

  const handleSelectCrew = useCallback((crew) => {
    if (!crew) {
      setSelectedCrew(null);

      if (routeCrewId) {
        navigate('/crews');
      }

      return;
    }

    const stayOnConfigView = isConfigRoute;

    handleOpenCrewPage(crew, { navigateToDetail: !stayOnConfigView });

    if (stayOnConfigView && location.pathname !== '/config') {
      navigate('/config');
    }
  }, [handleOpenCrewPage, isConfigRoute, location.pathname, navigate, routeCrewId, setSelectedCrew]);

  useEffect(() => {
    setShowSidebar(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!routeCrewId) {
      return;
    }

    const matchingCrew = crews.find(item => String(item?.id ?? '') === routeCrewId);

    if (matchingCrew) {
      setSelectedCrew((previous) => {
        if (previous && String(previous.id ?? '') === routeCrewId) {
          return previous;
        }

        return { ...matchingCrew, id: String(matchingCrew.id ?? routeCrewId) };
      });
      return;
    }

    if (!crewsLoading) {
      setSelectedCrew((previous) => {
        if (previous && String(previous.id ?? '') === routeCrewId) {
          return null;
        }

        return previous;
      });
    }
  }, [crews, crewsLoading, routeCrewId, setSelectedCrew]);

  useEffect(() => {
    if (!showSidebar) {
      return undefined;
    }

    if (typeof document === 'undefined') {
      return undefined;
    }

    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = overflow;
    };
  }, [showSidebar]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const mediaQuery = window.matchMedia('(min-width: 1024px)');

    const handleChange = (event) => {
      if (event.matches) {
        setShowSidebar(false);
      }
    };

    handleChange(mediaQuery);

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
      return () => {
        mediaQuery.removeEventListener('change', handleChange);
      };
    }

    mediaQuery.addListener(handleChange);
    return () => {
      mediaQuery.removeListener(handleChange);
    };
  }, []);

  useEffect(() => {
    if (location.pathname !== '/config' && editorTarget) {
      closeEditor();
    }
  }, [location.pathname, editorTarget, closeEditor]);

  const navItems = [
    { key: 'crews', label: 'crews', path: '/crews' },
    { key: 'library', label: 'library', path: '/library' },
    { key: 'monitor', label: 'monitor', path: '/monitor' },
    { key: 'activity', label: 'activity', path: '/activity' },
    { key: 'system', label: 'system', path: '/system' },
    { key: 'config', label: 'config', path: '/config' },
    { key: 'settings', label: 'settings', path: '/settings' }
  ];

  const crewSidebarElement = (
    <CrewSidebar
      crews={crews}
      crewsLoading={crewsLoading}
      filteredCrews={filteredCrews}
      availableStatusFilters={availableStatusFilters}
      availableTagFilters={availableTagFilters}
      filterConfig={filterConfig}
      onFilterConfigChange={updateFilterConfig}
      searchQuery={searchQuery}
      onSearchChange={event => setSearchQuery(event.target.value)}
      sortOption={sortOption}
      onSortChange={event => setSortOption(event.target.value)}
      runningCrews={runningCrews}
      crewLogs={crewLogs}
      selectedCrewId={selectedCrew ? String(selectedCrew.id) : null}
      onSelectCrew={handleSelectCrew}
      onCloseEditor={closeEditor}
      onRunCrew={handleRunCrew}
      onStopCrew={handleRequestStopCrew}
      onEditCrew={handleEditCrew}
      onCloneCrew={handleCloneCrew}
      onDeleteCrew={handleRequestDeleteCrew}
    />
  );


  const monitorSidebarElement = (
    <MonitorSidebar runningCrews={runningCrews} crewLogs={crewLogs} crews={crews} />
  );

  const activitySidebarElement = (
    <ActivitySidebar activityItems={activityItems} crews={crews} />
  );

  const librarySidebarElement = (
    <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
      <p className="font-medium text-gray-900 dark:text-gray-100">Agent library</p>
      <p>
        Capture reusable agents, workshop new personas, and curate a shared bench for your crews.
        Additions made here are instantly available inside the crew editor.
      </p>
    </div>
  );

  const systemSidebarElement = (
    <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
      <p className="font-medium text-gray-900 dark:text-gray-100">System Monitor</p>
      <p>
        Track CPU and memory usage trends, uptime, and service health for your deployment. Visit the System tab to view
        the live dashboard and refresh metrics on demand.
      </p>
    </div>
  );

  const configSidebarElement = (
    <ConfigSidebar
      crews={crews}
      selectedCrew={selectedCrew}
      envFiles={envFiles}
      envLoading={envLoading}
      envError={envError}
      onOpenEditor={openEditor}
      onSelectCrew={handleSelectCrew}
      crewsLoading={crewsLoading}
    />
  );

  const settingsSidebarElement = (
    <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
      <p className="font-medium text-gray-900 dark:text-gray-100">Preferences</p>
      <p>
        Adjust the interface theme, log viewer defaults, and crew list filters to match your workflow.
      </p>
    </div>
  );

  const libraryRouteElement = (
    <div className="p-6">
      <AgentLibraryPanel />
    </div>
  );

  const settingsRouteElement = (
    <SettingsRoute
      preferences={preferences}
      onThemeChange={setTheme}
      onLogFontSizeChange={setLogFontSize}
      onDefaultLogFiltersChange={setDefaultLogFilters}
      onCrewListDefaultsChange={setCrewListPreferences}
      availableStatusFilters={availableStatusFilters}
    />
  );

  const crewDetailsBaseProps = {
    crewListView,
    setCrewListPreferences,
    onSelectCrew: handleSelectCrew,
    onStartCrew: startCrew,
    onStopCrew: handleRequestStopCrew,
    onEditCrew: handleEditCrew,
    onCloneCrew: handleCloneCrew,
    onDeleteCrew: handleRequestDeleteCrew,
  };

  const executionMonitorBaseProps = {
    onStopCrew: handleRequestStopCrew,
    onSelectCrew: handleSelectCrew,
    onCloseEditor: closeEditor,
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 transition-colors dark:bg-slate-950 dark:text-gray-100">
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
      <ConfirmDialog
        open={Boolean(confirmDialogState)}
        title={confirmDialogState?.title || ''}
        body={confirmDialogBody}
        confirmLabel={confirmDialogState?.confirmLabel}
        cancelLabel={confirmDialogState?.cancelLabel}
        onConfirm={handleConfirmDialogConfirm}
        onCancel={handleConfirmDialogCancel}
        confirmButtonProps={{ disabled: Boolean(confirmDialogState?.isProcessing) }}
        cancelButtonProps={{ disabled: Boolean(confirmDialogState?.isProcessing) }}
      />
      <header className="border-b bg-white shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
        <div className="space-y-4 px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {!isCrewDetailView && (
                <button
                  type="button"
                  onClick={handleOpenSidebar}
                  aria-controls="mobile-sidebar"
                  aria-expanded={showSidebar}
                  className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white p-2 text-gray-600 transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-300 dark:hover:bg-slate-800 dark:focus:ring-offset-slate-900 lg:hidden"
                >
                  <span className="sr-only">Open navigation menu</span>
                  <Menu className="h-5 w-5" />
                </button>
              )}
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                <Link
                  to="/"
                  className="transition-colors hover:text-blue-600 focus-visible:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900"
                >
                  CrewAI Command Center
                </Link>
              </h1>
            </div>
            <div className="relative flex items-center gap-3">
              {!isCrewDetailView && !isConfigRoute && (
                <button
                  type="button"
                  onClick={handleToggleDesktopSidebar}
                  aria-pressed={isDesktopSidebarOpen}
                  aria-controls="desktop-sidebar"
                  className="hidden items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-200 dark:hover:bg-slate-800 dark:focus-visible:ring-offset-slate-900 lg:inline-flex"
                >
                  <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                  {isDesktopSidebarOpen ? 'Hide filters' : 'Show filters'}
                </button>
              )}
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={themeToggleLabel}
                title={themeToggleLabel}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-300 dark:hover:bg-slate-800 dark:focus:ring-offset-slate-900"
              >
                {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>
              <button
                onClick={refreshCrews}
                disabled={isRefreshing}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                  isRefreshing
                    ? 'cursor-not-allowed bg-gray-200 text-gray-600 dark:bg-slate-800 dark:text-gray-500'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-800 dark:text-gray-200 dark:hover:bg-slate-700'
                }`}
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Refreshing...' : 'Refresh Crews'}
              </button>
              {refreshError && (
                <div className="absolute right-0 top-full mt-2 rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700 shadow-lg dark:border-red-500 dark:bg-red-900/40 dark:text-red-200" role="alert">
                  <span className="block sm:inline">{refreshError}</span>
                </div>
              )}
              {!isEditorRoute && (
                <>
                  <button
                    className="flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm text-white transition-colors hover:bg-green-700"
                    onClick={() => navigate('/crews/new')}
                  >
                    <Plus className="h-4 w-4" />
                    New Crew
                  </button>
                  <button
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                      selectedCrew
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                        : 'cursor-not-allowed bg-gray-200 text-gray-500'
                    }`}
                    onClick={() => navigate(`/crews/${selectedCrew?.id}/edit`)}
                    disabled={!selectedCrew}
                  >
                    <PenSquare className="h-4 w-4" />
                    Edit Crew
                  </button>
                  <button
                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white transition-colors hover:bg-blue-700"
                    onClick={handleImportCrew}
                    disabled={importingCrew}
                  >
                    <FolderOpen className="h-4 w-4" />
                    {importingCrew ? 'Importing...' : 'Import Crew'}
                  </button>
                </>
              )}
              <div
                className="sr-only"
                aria-live={importStatus?.type === 'error' ? 'assertive' : 'polite'}
                aria-atomic="true"
              >
                {importStatus?.message || ''}
              </div>
            </div>
          </div>
          <CrewNavLinks
            navItems={navItems}
            className="overflow-x-auto rounded-lg bg-gray-100/60 p-1 text-sm dark:bg-slate-900/60"
          />
        </div>
      </header>

      <div className="relative flex h-[calc(100vh-80px)]">
        {!isCrewDetailView && (
          <aside
            id="desktop-sidebar"
            aria-hidden={!isDesktopSidebarOpen}
            className={`hidden h-full flex-col overflow-y-auto border-r bg-white transition-all duration-300 dark:border-slate-800 dark:bg-slate-950 ${
              isDesktopSidebarOpen ? 'lg:flex lg:w-80' : 'lg:hidden lg:w-0'
            }`}
          >
            <CrewNavLinks
              navItems={navItems}
              layout="vertical"
              className="sr-only"
            />
            <div className="flex-1 overflow-y-auto">
              <div className="p-4 text-gray-900 dark:text-gray-100">
                <CrewSidebarRoutes
                  crewSidebar={crewSidebarElement}
                  monitorSidebar={monitorSidebarElement}
                  activitySidebar={activitySidebarElement}
                  librarySidebar={librarySidebarElement}
                  systemSidebar={systemSidebarElement}
                  configSidebar={configSidebarElement}
                  settingsSidebar={settingsSidebarElement}
                />
              </div>
            </div>
          </aside>
        )}

        {!isCrewDetailView && !isConfigRoute && !isDesktopSidebarOpen && (
          <div className="hidden h-full items-start justify-center border-r border-gray-200 bg-white px-2 py-4 dark:border-slate-800 dark:bg-slate-950 lg:flex lg:w-12">
            <button
              type="button"
              onClick={handleOpenDesktopSidebar}
              aria-pressed={false}
              aria-controls="desktop-sidebar"
              className="inline-flex items-center justify-center rounded-md border border-gray-200 bg-white px-2 py-2 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-200 dark:hover:bg-slate-800 dark:focus-visible:ring-offset-slate-900"
            >
              Show filters
            </button>
          </div>
        )}

        {!isCrewDetailView && (
          <div
            className={`fixed inset-0 z-40 flex transition-opacity duration-300 lg:hidden ${
              showSidebar ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
            }`}
          >
            <div
              className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${
                showSidebar ? 'opacity-100' : 'opacity-0'
              }`}
              aria-hidden="true"
              onClick={handleCloseSidebar}
            />
            <div
              ref={mobileSidebarRef}
              id="mobile-sidebar"
              role="dialog"
              aria-modal="true"
              aria-labelledby="mobile-sidebar-title"
              tabIndex={-1}
              className={`relative flex h-full w-80 max-w-full flex-col bg-white shadow-xl transition-transform duration-300 focus:outline-none dark:bg-slate-900 dark:shadow-2xl ${
                showSidebar ? 'translate-x-0' : '-translate-x-full'
              }`}
            >
              <div className="flex items-center justify-between border-b px-4 py-3 transition-colors dark:border-slate-800">
                <h2 id="mobile-sidebar-title" className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  Navigation
                </h2>
                <button
                  type="button"
                  onClick={handleCloseSidebar}
                  className="inline-flex items-center justify-center rounded-md border border-transparent p-2 text-gray-600 transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:text-gray-300 dark:hover:bg-slate-800 dark:focus:ring-offset-slate-900"
                  aria-label="Close navigation menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <div className="space-y-4 p-4 text-gray-900 dark:text-gray-100">
                  <CrewNavLinks
                    navItems={navItems}
                    onNavigate={handleCloseSidebar}
                    layout="vertical"
                    className="gap-2"
                  />
                  <CrewSidebarRoutes
                    crewSidebar={crewSidebarElement}
                    monitorSidebar={monitorSidebarElement}
                    activitySidebar={activitySidebarElement}
                    librarySidebar={librarySidebarElement}
                    systemSidebar={systemSidebarElement}
                    configSidebar={configSidebarElement}
                    settingsSidebar={settingsSidebarElement}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        <main className="flex-1 overflow-y-auto" role="main">
          <Routes>
              <Route path="/" element={<Navigate to="/crews" replace />} />
              <Route
                path="/crews"
                element={(
                  <CrewDetails
                    view="crews"
                    {...crewDetailsBaseProps}
                  />
                )}
              />
              <Route path="/library" element={libraryRouteElement} />
              <Route
                path="/crews/new"
                element={(
                  <CrewEditorRoute
                    mode="create"
                    {...crewEditorRouteProps}
                  />
                )}
              />
              <Route
                path="/crews/:crewId"
                element={(
                  <CrewDetailPage
                    crew={selectedCrew}
                    crewsLoading={crewsLoading}
                    runningCrews={runningCrews}
                    pendingStarts={pendingStarts}
                    pendingStops={pendingStops}
                    crewLogs={crewLogs}
                    logFilters={logFilters}
                    onChangeLogFilters={setLogFilters}
                    onResetLogFilters={resetLogFilters}
                    createPreferredLogFilters={createPreferredLogFilters}
                    logFontSize={preferences?.logFontSize || 'medium'}
                    onStartCrew={startCrew}
                    onStopCrew={handleRequestStopCrew}
                    onEditCrew={handleEditCrew}
                    crewError={crewError}
                  />
                )}
              />
              <Route
                path="/crews/:crewId/edit"
                element={(
                  <CrewEditorRoute
                    mode="edit"
                    crewIdOverride={editorCrewId}
                    {...crewEditorRouteProps}
                  />
                )}
              />
              <Route
                path="/monitor"
                element={(
                  <ExecutionMonitor
                    view="monitor"
                    {...executionMonitorBaseProps}
                  />
                )}
              />
              <Route
                path="/activity"
                element={(
                  <ExecutionMonitor
                    view="activity"
                    {...executionMonitorBaseProps}
                  />
                )}
              />
              <Route
                path="/system"
                element={(
                  <ExecutionMonitor
                    view="system"
                    {...executionMonitorBaseProps}
                  />
                )}
              />
              <Route
                path="/config"
                element={(
                  <CrewDetails
                    view="config"
                    {...crewDetailsBaseProps}
                  />
                )}
              />
              <Route path="/settings" element={settingsRouteElement} />
              <Route path="*" element={<Navigate to="/crews" replace />} />
          </Routes>

        </main>
      </div>
    </div>
  );
};

const CrewAIManager = () => {
  const {
    preferences,
    setTheme,
    toggleTheme,
    setLogFontSize,
    setDefaultLogFilters,
    setCrewListPreferences,
  } = useUserPreferences();

  const preferredLogFilters = preferences?.defaultLogFilters;
  const preferredStatusFilter = preferences?.crewList?.statusFilter;
  const preferredSortOption = preferences?.crewList?.sortOption;

  const getPreferredLogFilters = useCallback(
    () => (preferredLogFilters ? { ...preferredLogFilters } : preferredLogFilters),
    [preferredLogFilters],
  );

  return (
    <CrewManagerStateProvider
      defaultStatusFilter={preferredStatusFilter}
      defaultSortOption={preferredSortOption}
      getPreferredLogFilters={getPreferredLogFilters}
    >
      <CrewAIManagerContent
        preferences={preferences}
        setTheme={setTheme}
        toggleTheme={toggleTheme}
        setLogFontSize={setLogFontSize}
        setDefaultLogFilters={setDefaultLogFilters}
        setCrewListPreferences={setCrewListPreferences}
      />
    </CrewManagerStateProvider>
  );
};

export { API_BASE };
export default CrewAIManager;
