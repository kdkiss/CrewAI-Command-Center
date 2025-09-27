import React from 'react';

import SettingsPanel from './SettingsPanel';

const SettingsRoute = ({
  preferences,
  onThemeChange,
  onLogFontSizeChange,
  onDefaultLogFiltersChange,
  onCrewListDefaultsChange,
  availableStatusFilters,
}) => (
  <div className="p-6">
    <SettingsPanel
      preferences={preferences}
      onThemeChange={onThemeChange}
      onLogFontSizeChange={onLogFontSizeChange}
      onDefaultLogFiltersChange={onDefaultLogFiltersChange}
      onCrewListDefaultsChange={onCrewListDefaultsChange}
      availableStatusFilters={availableStatusFilters}
    />
  </div>
);

export default SettingsRoute;
