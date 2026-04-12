"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from '../lib/auth';

type ThemeName = string; 

interface ThemeColors {
  bg: string;
  card: string;
  primary: string;
  text: string;
  muted: string;
  accent: string;
}

const PRESET_THEMES: Record<string, ThemeColors> = {
  'default-dark': {
    bg: '#0B0B0F',
    card: '#15151A',
    primary: '#FFFFFF', // This caused the text visibility issue
    text: '#E5E7EB',
    muted: '#9CA3AF',
    accent: '#22C55E'
  },
  'neo-purple': {
    bg: '#0F0B1A',
    card: '#1A1429',
    primary: '#8B5CF6',
    text: '#F3F4F6',
    muted: '#A78BFA',
    accent: '#F59E0B'
  },
  'midnight-blue': {
    bg: '#070B14',
    card: '#0E1629',
    primary: '#3B82F6',
    text: '#E2E8F0',
    muted: '#94A3B8',
    accent: '#06B6D4'
  },
  'cyber-green': {
    bg: '#050805',
    card: '#0A120A',
    primary: '#22C55E',
    text: '#ECFDF5',
    muted: '#10B981',
    accent: '#F59E0B'
  },
  'warm-minimal': {
    bg: '#0F0F0F',
    card: '#1A1A1A',
    primary: '#F59E0B',
    text: '#FAFAF9',
    muted: '#A8A29E',
    accent: '#EF4444'
  }
};

interface ThemeContextType {
  theme: ThemeName;
  colors: ThemeColors;
  setTheme: (theme: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [themeName, setThemeName] = useState<ThemeName>('default-dark');

  // Load theme from user profile immediately
  useEffect(() => {
    if (user?.theme) {
      setThemeName(user.theme);
    }
  }, [user?.theme]);

  const parseTheme = (name: string): ThemeColors => {
    if (name.startsWith('custom:')) {
      const [, bg, primary, text] = name.split(':');
      return {
        bg: bg || '#0B0B0F',
        primary: primary || '#8B5CF6',
        text: text || '#FFFFFF',
        card: 'rgba(255, 255, 255, 0.03)',
        muted: 'rgba(255, 255, 255, 0.5)',
        accent: primary || '#8B5CF6'
      };
    }
    return PRESET_THEMES[name] || PRESET_THEMES['default-dark'];
  };

  const currentColors = parseTheme(themeName);

  useEffect(() => {
    const root = document.documentElement;
    
    // Core requested variables
    root.style.setProperty('--bg', currentColors.bg);
    root.style.setProperty('--card', currentColors.card);
    root.style.setProperty('--primary', currentColors.primary);
    root.style.setProperty('--text', currentColors.text);
    root.style.setProperty('--muted', currentColors.muted);
    
    // Derived variables
    root.style.setProperty('--background', currentColors.bg);
    root.style.setProperty('--foreground', currentColors.text);
    root.style.setProperty('--muted-foreground', currentColors.muted);
    root.style.setProperty('--accent', currentColors.accent);
    root.style.setProperty('--ring', currentColors.primary);
    
    // RGB components for opacity utilities
    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '255, 255, 255';
    };
    root.style.setProperty('--primary-rgb', hexToRgb(currentColors.primary));
    
    // Force transition
    root.style.transition = 'background-color 0.2s ease, border-color 0.2s ease, color 0.1s ease';
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
