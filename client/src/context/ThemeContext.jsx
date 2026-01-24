import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

// 每个主题的图表配色方案
const themeConfigs = {
  modern: {
    id: 'modern',
    label: 'Modern',
    icon: '◈',
    colors: [
      '#8b5cf6', // Violet
      '#3b82f6', // Blue
      '#06b6d4', // Cyan
      '#10b981', // Emerald
      '#f59e0b', // Amber
      '#ec4899', // Pink
      '#6366f1', // Indigo
      '#14b8a6', // Teal
      '#f97316', // Orange
      '#d946ef', // Fuchsia
      '#84cc16', // Lime
      '#e11d48', // Rose
      '#0ea5e9', // Sky
      '#a855f7', // Purple
      '#22c55e', // Green
    ],
    othersColor: '#475569',
    gridColor: '#444',
    tooltipBg: 'rgba(15, 23, 42, 0.9)',
    tooltipBorder: 'rgba(255, 255, 255, 0.1)',
    textPrimary: '#fff',
    textSecondary: '#ccc',
    selectedGlow: 'rgba(139, 92, 246, 0.15)',
    selectedBorder: '#8b5cf6',
  },
  industrial: {
    id: 'industrial',
    label: 'Industrial',
    icon: '⚙',
    colors: [
      '#e8b839', // Bright Amber
      '#d95030', // Signal Red
      '#4a9f6e', // Industrial Green
      '#3d8eb9', // Steel Blue
      '#c45c30', // Rust Orange
      '#8e6bbf', // Gauge Purple
      '#2eaaaa', // Teal
      '#cc7a29', // Copper
      '#7cb342', // Olive Green
      '#e07050', // Coral
      '#5c8dba', // Slate Blue
      '#9c6b30', // Bronze
      '#d4a020', // Gold
      '#6a8a82', // Patina
      '#b85450', // Brick Red
    ],
    othersColor: '#5c5c52',
    gridColor: '#3d3d35',
    tooltipBg: 'linear-gradient(145deg, #2e2e2a 0%, #222220 100%)',
    tooltipBorder: '#4a4a42',
    textPrimary: '#e8e4d9',
    textSecondary: '#a09a88',
    selectedGlow: 'rgba(212, 160, 32, 0.2)',
    selectedBorder: '#d4a020',
  },
  terminal: {
    id: 'terminal',
    label: 'Terminal',
    icon: '▸',
    colors: [
      '#00ff00', // Bright Green
      '#00ccff', // Cyan
      '#ff6600', // Orange
      '#ffff00', // Yellow
      '#ff00ff', // Magenta
      '#00ffaa', // Mint
      '#ff3366', // Pink
      '#66ff33', // Lime
      '#3399ff', // Blue
      '#ffcc00', // Gold
      '#cc66ff', // Purple
      '#00ffff', // Aqua
      '#ff9933', // Amber
      '#99ff66', // Light Green
      '#ff66cc', // Hot Pink
    ],
    othersColor: '#666666',
    gridColor: '#0a3a0a',
    tooltipBg: 'rgba(0, 15, 0, 0.95)',
    tooltipBorder: '#0f3f0f',
    textPrimary: '#00ff00',
    textSecondary: '#00aa00',
    selectedGlow: 'rgba(0, 255, 0, 0.15)',
    selectedBorder: '#00ff00',
  },
};

export const ThemeProvider = ({ children }) => {
  const [themeId, setThemeId] = useState(() => {
    return localStorage.getItem('dm-theme') || 'modern';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeId);
    localStorage.setItem('dm-theme', themeId);
  }, [themeId]);

  const cycleTheme = () => {
    const themeIds = Object.keys(themeConfigs);
    const currentIndex = themeIds.indexOf(themeId);
    const nextIndex = (currentIndex + 1) % themeIds.length;
    setThemeId(themeIds[nextIndex]);
  };

  const theme = themeConfigs[themeId] || themeConfigs.modern;

  return (
    <ThemeContext.Provider value={{ theme, themeId, setThemeId, cycleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export default ThemeContext;
