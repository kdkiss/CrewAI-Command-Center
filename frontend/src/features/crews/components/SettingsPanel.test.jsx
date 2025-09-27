import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createDefaultLogFilters } from '../../../components/logs/utils';
import SettingsPanel from './SettingsPanel';

describe('SettingsPanel', () => {
  const renderPanel = () => {
    const initialPreferences = {
      theme: 'light',
      logFontSize: 'medium',
      defaultLogFilters: createDefaultLogFilters(),
      crewList: { statusFilter: 'all', sortOption: 'name-asc' }
    };

    const onThemeChange = jest.fn();
    const onLogFontSizeChange = jest.fn();
    const onDefaultLogFiltersChange = jest.fn();
    const onCrewListDefaultsChange = jest.fn();

    const Wrapper = () => {
      const [preferences, setPreferences] = React.useState(initialPreferences);

      const handleThemeChange = (nextTheme) => {
        onThemeChange(nextTheme);
        setPreferences(prev => ({ ...prev, theme: nextTheme }));
      };

      const handleFontSizeChange = (size) => {
        onLogFontSizeChange(size);
        setPreferences(prev => ({ ...prev, logFontSize: size }));
      };

      const handleDefaultLogFiltersChange = (next) => {
        onDefaultLogFiltersChange(next);
        setPreferences(prev => ({ ...prev, defaultLogFilters: next }));
      };

      const handleCrewListDefaultsChange = (next) => {
        onCrewListDefaultsChange(next);
        setPreferences(prev => ({
          ...prev,
          crewList: {
            ...prev.crewList,
            ...next
          }
        }));
      };

      return (
        <SettingsPanel
          preferences={preferences}
          onThemeChange={handleThemeChange}
          onLogFontSizeChange={handleFontSizeChange}
          onDefaultLogFiltersChange={handleDefaultLogFiltersChange}
          onCrewListDefaultsChange={handleCrewListDefaultsChange}
          availableStatusFilters={['running']}
        />
      );
    };

    render(<Wrapper />);

    return {
      onThemeChange,
      onLogFontSizeChange,
      onDefaultLogFiltersChange,
      onCrewListDefaultsChange
    };
  };

  it('invokes callbacks when updating preferences', async () => {
    const props = renderPanel();

    await userEvent.click(screen.getByRole('button', { name: /dark/i }));
    expect(props.onThemeChange).toHaveBeenCalledWith('dark');

    await userEvent.selectOptions(screen.getByLabelText(/Log font size/i), 'large');
    expect(props.onLogFontSizeChange).toHaveBeenCalledWith('large');

    await userEvent.type(screen.getByLabelText(/Search term/i), 'errors');
    expect(props.onDefaultLogFiltersChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: 'errors' })
    );

    await userEvent.selectOptions(screen.getByLabelText(/Status filter/i), 'running');
    expect(props.onCrewListDefaultsChange).toHaveBeenCalledWith({ statusFilter: 'running', sortOption: 'name-asc', view: 'grid' });
  });
});
