import React from 'react';

import ActivityFeed from '../../../activity/ActivityFeed';
import ActiveCrewMonitor from '../ActiveCrewMonitor';
import SystemStatsPanel from '../SystemStatsPanel';
import { useCrewManagerState } from './useCrewManagerState';

const MonitorLayout = ({ title, description, children }) => (
  <div className="p-6">
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-heading font-bold text-gray-900 dark:text-gray-100">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>
        ) : null}
      </div>
      {children}
    </div>
  </div>
);

const ExecutionMonitor = ({
  view = 'monitor',
  onStopCrew,
  onSelectCrew,
  onCloseEditor,
}) => {
  const {
    crews = [],
    runningCrews,
    crewLogs = {},
    pendingStarts,
    pendingStops,
    closeEditor,
    systemStats,
    systemStatsLoading,
    systemStatsError,
    refreshSystemStats,
    systemStatsUpdatedAt,
    activityItems = [],
  } = useCrewManagerState();

  const handleCloseEditor = onCloseEditor ?? closeEditor;

  if (view === 'monitor') {
    return (
      <ActiveCrewMonitor
        crews={crews}
        runningCrews={runningCrews}
        crewLogs={crewLogs}
        pendingStarts={pendingStarts}
        pendingStops={pendingStops}
        onStopCrew={onStopCrew}
        onSelectCrew={onSelectCrew}
        onCloseEditor={handleCloseEditor}
      />
    );
  }

  if (view === 'system') {
    return (
      <MonitorLayout
        title="System"
        description="System Monitor provides real-time CPU, memory, uptime, and service health metrics for your CrewAI deployment."
      >
        <SystemStatsPanel
          stats={systemStats}
          isLoading={systemStatsLoading}
          error={systemStatsError}
          onRefresh={refreshSystemStats}
          lastUpdated={systemStatsUpdatedAt}
        />
      </MonitorLayout>
    );
  }

  if (view === 'activity') {
    return (
      <MonitorLayout
        title="Activity"
        description="Review real-time crew lifecycle updates and streaming log highlights. Filter the timeline to focus on the crews and event types that matter most."
      >
        <ActivityFeed items={activityItems} crews={crews} />
      </MonitorLayout>
    );
  }

  return null;
};

export default ExecutionMonitor;
