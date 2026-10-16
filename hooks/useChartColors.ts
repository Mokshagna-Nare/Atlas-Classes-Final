import { useMemo } from 'react';
import { useTheme } from '../contexts/ThemeContext';

// Concrete colours for Recharts. Charts draw SVG, whose presentation attributes don't take CSS
// variables in every browser, so the current theme's values are resolved here and the chart
// re-renders when the theme changes.

export function useChartColors() {
  const { theme } = useTheme();
  return useMemo(() => {
    const css = getComputedStyle(document.documentElement);
    const c = (token: string, alpha = 1) => {
      const [r, g, b] = css.getPropertyValue(`--c-${token}`).trim().split(/\s+/);
      return alpha >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };
    const dark = theme === 'dark';
    // Series hues: on white each steps one shade deeper so lines and bars keep 3:1 contrast.
    const green = dark ? '#10B981' : '#059669';
    const amber = dark ? '#F59E0B' : '#D97706';
    const red = dark ? '#EF4444' : '#DC2626';
    return {
      c,
      grid: c('gray-800'),
      axis: c('gray-600'),
      axisStrong: c('gray-500'),
      label: c('gray-400'),
      /** "Skipped" slices, empty tracks, unselected bars */
      track: c('gray-700'),
      cursor: c('white', dark ? 0.03 : 0.05),
      green,
      greenSoft: dark ? '#34D399' : '#10B981',
      greenPale: dark ? '#6EE7B7' : '#34D399',
      amber,
      orange: dark ? '#F97316' : '#EA580C',
      red,
      blue: dark ? '#3B82F6' : '#2563EB',
      /** Five greens, strongest first (pie slices) */
      greenRamp: dark
        ? ['#10B981', '#34D399', '#6EE7B7', '#A7F3D0', '#D1FAE5']
        : ['#047857', '#059669', '#10B981', '#34D399', '#6EE7B7'],
      perf: (p: number) => (p >= 75 ? green : p >= 50 ? amber : red),
    };
  }, [theme]);
}

export type ChartColors = ReturnType<typeof useChartColors>;
