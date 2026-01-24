import { useTheme } from '../context/ThemeContext';

const ThemeToggle = () => {
  const { theme, cycleTheme } = useTheme();

  return (
    <button className="theme-toggle" onClick={cycleTheme} title="Switch Theme">
      <span style={{ fontSize: '1rem' }}>{theme.icon}</span>
      <span>{theme.label}</span>
    </button>
  );
};

export default ThemeToggle;
