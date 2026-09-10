"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from '../lib/auth';

type ThemeName = string; 

interface ThemeColors {
  bg: string;
  card: string;
  primary: string;
  primaryForeground: string;
  text: string;
  muted: string;
  accent: string;
  accentForeground: string;
  gradient: string;
}

const PRESET_THEMES: Record<string, ThemeColors> = {
  'default-dark': {
    bg: '#0B0B0F',
    card: '#15151A',
    primary: '#FFFFFF',
    primaryForeground: '#000000',
    text: '#FFFFFF',
    muted: '#9CA3AF',
    accent: '#E5E7EB',
    accentForeground: '#000000',
    gradient: 'linear-gradient(135deg, #FFFFFF, #9CA3AF)'
  },
  'neo-purple': {
    bg: '#0F0B1A',
    card: '#1A1429',
    primary: '#8B5CF6',
    primaryForeground: '#FFFFFF',
    text: '#F3F4F6',
    muted: '#A78BFA',
    accent: '#EC4899',
    accentForeground: '#FFFFFF',
    gradient: 'linear-gradient(135deg, #8B5CF6, #EC4899)'
  },
  'midnight-blue': {
    bg: '#070B14',
    card: '#0E1629',
    primary: '#3B82F6',
    primaryForeground: '#FFFFFF',
    text: '#E2E8F0',
    muted: '#94A3B8',
    accent: '#06B6D4',
    accentForeground: '#FFFFFF',
    gradient: 'linear-gradient(135deg, #3B82F6, #06B6D4)'
  },
  'cyber-green': {
    bg: '#050805',
    card: '#0A120A',
    primary: '#22C55E',
    primaryForeground: '#FFFFFF',
    text: '#ECFDF5',
    muted: '#10B981',
    accent: '#F59E0B',
    accentForeground: '#FFFFFF',
    gradient: 'linear-gradient(135deg, #22C55E, #10B981)'
  },
  'warm-minimal': {
    bg: '#0F0F0F',
    card: '#1A1A1A',
    primary: '#F59E0B',
    primaryForeground: '#FFFFFF',
    text: '#FAFAF9',
    muted: '#A8A29E',
    accent: '#EF4444',
    accentForeground: '#FFFFFF',
    gradient: 'linear-gradient(135deg, #F59E0B, #EF4444)'
  }
};

function getContrastColor(hexColor: string): string {
  if (!hexColor || !hexColor.startsWith('#')) return '#FFFFFF';
  const clean = hexColor.replace('#', '');
  let r = 255, g = 255, b = 255;
  if (clean.length === 3) {
    r = parseInt(clean[0] + clean[0], 16);
    g = parseInt(clean[1] + clean[1], 16);
    b = parseInt(clean[2] + clean[2], 16);
  } else if (clean.length >= 6) {
    r = parseInt(clean.substring(0, 2), 16);
    g = parseInt(clean.substring(2, 4), 16);
    b = parseInt(clean.substring(4, 6), 16);
  }
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.65 ? '#000000' : '#FFFFFF';
}

interface ThemeContextType {
  theme: ThemeName;
  colors: ThemeColors;
  setTheme: (theme: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [themeName, setThemeName] = useState<ThemeName>('default-dark');

  // Load theme from user profile; free users are strictly enforced to default-dark
  useEffect(() => {
    if (user) {
      const isPaid = user.plan && user.plan !== 'free';
      const effectiveTheme = isPaid ? (user.theme || 'default-dark') : 'default-dark';
      setThemeName(effectiveTheme);
    }
  }, [user]);

  const parseTheme = (name: string): ThemeColors => {
    // Custom gradient format: gradient:angle:fromColor:toColor:bg:text
    if (name.startsWith('gradient:')) {
      const parts = name.split(':');
      const angle = parts[1] || '135deg';
      const fromColor = parts[2] || '#8B5CF6';
      const toColor = parts[3] || '#EC4899';
      const bg = parts[4] || '#0B0B0F';
      const text = parts[5] || '#FFFFFF';

      const gradientCSS = angle === 'radial'
        ? `radial-gradient(circle at center, ${fromColor}, ${toColor})`
        : `linear-gradient(${angle}, ${fromColor}, ${toColor})`;

      return {
        bg: bg,
        card: 'rgba(255, 255, 255, 0.03)',
        primary: fromColor,
        primaryForeground: getContrastColor(fromColor),
        accent: toColor,
        accentForeground: getContrastColor(toColor),
        text: text,
        muted: 'rgba(255, 255, 255, 0.6)',
        gradient: gradientCSS
      };
    }

    // Custom solid color format: custom:bg:primary:text
    if (name.startsWith('custom:')) {
      const [, bg, primary, text] = name.split(':');
      const pColor = primary || '#8B5CF6';
      const pFg = getContrastColor(pColor);
      return {
        bg: bg || '#0B0B0F',
        primary: pColor,
        primaryForeground: pFg,
        text: text || '#FFFFFF',
        card: 'rgba(255, 255, 255, 0.03)',
        muted: 'rgba(255, 255, 255, 0.6)',
        accent: pColor,
        accentForeground: pFg,
        gradient: `linear-gradient(135deg, ${pColor}, ${pColor})`
      };
    }
    return PRESET_THEMES[name] || PRESET_THEMES['default-dark'];
  };

  const currentColors = parseTheme(themeName);

  useEffect(() => {
    const root = document.documentElement;
    
    // Core theme variables
    root.style.setProperty('--bg', currentColors.bg);
    root.style.setProperty('--card', currentColors.card);
    root.style.setProperty('--primary', currentColors.primary);
    root.style.setProperty('--primary-foreground', currentColors.primaryForeground);
    root.style.setProperty('--accent', currentColors.accent);
    root.style.setProperty('--accent-foreground', currentColors.accentForeground);
    root.style.setProperty('--primary-gradient', currentColors.gradient);
    root.style.setProperty('--gradient', currentColors.gradient);
    root.style.setProperty('--text', currentColors.text);
    root.style.setProperty('--muted', currentColors.muted);
    
    // Derived variables for shadcn / tailwind consistency
    root.style.setProperty('--background', currentColors.bg);
    root.style.setProperty('--foreground', currentColors.text);
    root.style.setProperty('--muted-foreground', currentColors.muted);
    root.style.setProperty('--ring', currentColors.primary);
    root.style.setProperty('--sidebar', currentColors.bg);
    root.style.setProperty('--sidebar-primary', currentColors.primary);
    root.style.setProperty('--sidebar-primary-foreground', currentColors.primaryForeground);
    
    // RGB components for opacity utilities
    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '139, 92, 246';
    };
    root.style.setProperty('--primary-rgb', hexToRgb(currentColors.primary));
    root.style.setProperty('--accent-rgb', hexToRgb(currentColors.accent));
    
    // Force smooth transition
    root.style.transition = 'background-color 0.25s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.25s cubic-bezier(0.4, 0, 0.2, 1), color 0.15s ease';
  }, [themeName, currentColors]);

  return (
    <ThemeContext.Provider value={{ theme: themeName, colors: currentColors, setTheme: setThemeName }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
