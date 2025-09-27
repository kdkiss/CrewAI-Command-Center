import useUserPreferences from './useUserPreferences';

const useThemePreference = () => {
  const { preferences, setTheme, toggleTheme } = useUserPreferences();

  return {
    theme: preferences.theme,
    setTheme,
    toggleTheme
  };
};

export default useThemePreference;
