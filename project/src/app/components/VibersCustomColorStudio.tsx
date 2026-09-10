"use client";

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Sparkles, Check, Eye, Compass, Palette, Disc, Zap } from 'lucide-react';

interface VibersCustomColorStudioProps {
  currentTheme: string;
  onSelectTheme: (themeString: string) => void;
}

const SPECTRUM_SWATCHES = [
  { name: 'Neon Violet', hex: '#8B5CF6' },
  { name: 'Electric Blue', hex: '#3B82F6' },
  { name: 'Cyber Cyan', hex: '#06B6D4' },
  { name: 'Matrix Emerald', hex: '#10B981' },
  { name: 'Toxic Lime', hex: '#84CC16' },
  { name: 'Solar Amber', hex: '#F59E0B' },
  { name: 'Crimson Red', hex: '#EF4444' },
  { name: 'Hot Pink', hex: '#EC4899' },
  { name: 'Neon Rose', hex: '#F43F5E' },
  { name: 'Deep Purple', hex: '#7C3AED' },
  { name: 'Cosmic Indigo', hex: '#6366F1' },
  { name: 'Hyper White', hex: '#FFFFFF' },
];

const CURATED_GRADIENTS = [
  { name: 'Cyber Neon', from: '#8B5CF6', to: '#EC4899', angle: '135deg', bg: '#0F0B1A' },
  { name: 'Electric Aurora', from: '#3B82F6', to: '#06B6D4', angle: '135deg', bg: '#070B14' },
  { name: 'Solar Flare', from: '#F59E0B', to: '#EF4444', angle: '135deg', bg: '#0F0B0B' },
  { name: 'Emerald Matrix', from: '#10B981', to: '#06B6D4', angle: '135deg', bg: '#050805' },
  { name: 'Synthwave Sunset', from: '#EC4899', to: '#F59E0B', angle: '90deg', bg: '#0F0B14' },
  { name: 'Midnight Dream', from: '#6366F1', to: '#A855F7', angle: '135deg', bg: '#090A1A' },
  { name: 'Hyper Platinum', from: '#FFFFFF', to: '#94A3B8', angle: '135deg', bg: '#0B0B0F' },
  { name: 'Toxic Lime', from: '#84CC16', to: '#10B981', angle: '135deg', bg: '#050805' },
  { name: 'Crimson Eclipse', from: '#EF4444', to: '#8B5CF6', angle: '135deg', bg: '#0F0B0F' },
  { name: 'Champagne Gold', from: '#FDE68A', to: '#D97706', angle: '135deg', bg: '#0F0E0B' },
  { name: 'Arctic Ice', from: '#E0F2FE', to: '#0284C7', angle: '135deg', bg: '#070B14' },
  { name: 'Deep Ultraviolet', from: '#7C3AED', to: '#3B82F6', angle: '180deg', bg: '#0B0814' },
];

const COMPASS_DIRECTIONS = [
  { label: '0° ↑', angle: '0deg' },
  { label: '45° ↗', angle: '45deg' },
  { label: '90° →', angle: '90deg' },
  { label: '135° ↘', angle: '135deg' },
  { label: '180° ↓', angle: '180deg' },
  { label: '225° ↙', angle: '225deg' },
  { label: '270° ←', angle: '270deg' },
  { label: '315° ↖', angle: '315deg' },
];

const BG_TONES = [
  { name: 'Obsidian Void', hex: '#0B0B0F' },
  { name: 'OLED Black', hex: '#000000' },
  { name: 'Midnight Slate', hex: '#070B14' },
  { name: 'Deep Violet', hex: '#0F0B1A' },
  { name: 'Matrix Abyss', hex: '#050805' },
  { name: 'Dark Charcoal', hex: '#121216' },
];

export function VibersCustomColorStudio({ currentTheme, onSelectTheme }: VibersCustomColorStudioProps) {
  const isGradientInitial = currentTheme.startsWith('gradient:');
  const isCustomSolidInitial = currentTheme.startsWith('custom:');

  const [mode, setMode] = useState<'gradient' | 'radial' | 'solid'>(
    isGradientInitial && currentTheme.includes(':radial:')
      ? 'radial'
      : isGradientInitial
      ? 'gradient'
      : isCustomSolidInitial
      ? 'solid'
      : 'gradient'
  );

  const [fromColor, setFromColor] = useState('#8B5CF6');
  const [toColor, setToColor] = useState('#EC4899');
  const [angleDeg, setAngleDeg] = useState(135);
  const [bgTone, setBgTone] = useState('#0B0B0F');
  const [activeColorTarget, setActiveColorTarget] = useState<'from' | 'to'>('from');

  useEffect(() => {
    if (currentTheme.startsWith('gradient:')) {
      const parts = currentTheme.split(':');
      if (parts[1] === 'radial') {
        setMode('radial');
      } else {
        setMode('gradient');
        const num = parseInt(parts[1] || '135', 10);
        if (!isNaN(num)) setAngleDeg(num);
      }
      if (parts[2]) setFromColor(parts[2]);
      if (parts[3]) setToColor(parts[3]);
      if (parts[4]) setBgTone(parts[4]);
    } else if (currentTheme.startsWith('custom:')) {
      const parts = currentTheme.split(':');
      setMode('solid');
      if (parts[1]) setBgTone(parts[1]);
      if (parts[2]) setFromColor(parts[2]);
    }
  }, [currentTheme]);

  const emitTheme = (
    newMode: 'gradient' | 'radial' | 'solid',
    pFrom: string,
    pTo: string,
    pAngle: number,
    pBg: string
  ) => {
    if (newMode === 'solid') {
      const themeStr = `custom:${pBg}:${pFrom}:#FFFFFF`;
      onSelectTheme(themeStr);
    } else if (newMode === 'radial') {
      const themeStr = `gradient:radial:${pFrom}:${pTo}:${pBg}:#FFFFFF`;
      onSelectTheme(themeStr);
    } else {
      const themeStr = `gradient:${pAngle}deg:${pFrom}:${pTo}:${pBg}:#FFFFFF`;
      onSelectTheme(themeStr);
    }
  };

  const handleFromChange = (val: string) => {
    setFromColor(val);
    emitTheme(mode, val, toColor, angleDeg, bgTone);
  };

  const handleToChange = (val: string) => {
    setToColor(val);
    emitTheme(mode, fromColor, val, angleDeg, bgTone);
  };

  const handleAngleChange = (val: number) => {
    setAngleDeg(val);
    emitTheme(mode, fromColor, toColor, val, bgTone);
  };

  const handleBgChange = (val: string) => {
    setBgTone(val);
    emitTheme(mode, fromColor, toColor, angleDeg, val);
  };

  const handleModeChange = (newMode: 'gradient' | 'radial' | 'solid') => {
    setMode(newMode);
    emitTheme(newMode, fromColor, toColor, angleDeg, bgTone);
  };

  const handleSwatchClick = (hex: string) => {
    if (activeColorTarget === 'from' || mode === 'solid') {
      handleFromChange(hex);
    } else {
      handleToChange(hex);
    }
  };

  const applyCurated = (c: (typeof CURATED_GRADIENTS)[0]) => {
    const angleNum = parseInt(c.angle, 10) || 135;
    setMode('gradient');
    setFromColor(c.from);
    setToColor(c.to);
    setAngleDeg(angleNum);
    setBgTone(c.bg);
    emitTheme('gradient', c.from, c.to, angleNum, c.bg);
  };

  const activeGradientCSS =
    mode === 'radial'
      ? `radial-gradient(circle at center, ${fromColor}, ${toColor})`
      : mode === 'gradient'
      ? `linear-gradient(${angleDeg}deg, ${fromColor}, ${toColor})`
      : `linear-gradient(135deg, ${fromColor}, ${fromColor})`;

  return (
    <div className="space-y-7">
      {/* Studio Header & Segmented Mode Switcher */}
      <div className="space-y-4 pb-5 border-b border-white/10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20 shrink-0">
              <Palette className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                Bespoke Color Palette & Gradient Studio
              </h3>
              <p className="text-xs text-white/50">
                Design your signature look. Gradients & colors reflect live across all buttons, rooms, and glowing cards.
              </p>
            </div>
          </div>
          <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
            Vibers Exclusive
          </span>
        </div>

        {/* Full-width Segmented Mode Switcher */}
        <div className="grid grid-cols-3 p-1.5 bg-white/5 border border-white/10 rounded-xl w-full">
          <button
            type="button"
            onClick={() => handleModeChange('gradient')}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              mode === 'gradient'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/20'
                : 'text-white/50 hover:text-white'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Linear Gradient</span>
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('radial')}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              mode === 'radial'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/20'
                : 'text-white/50 hover:text-white'
            }`}
          >
            <Disc className="w-3.5 h-3.5" />
            <span>Radial Glow</span>
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('solid')}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              mode === 'solid'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/20'
                : 'text-white/50 hover:text-white'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Solid Accent</span>
          </button>
        </div>
      </div>

      {/* Color Stop Pickers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Primary Color Card */}
        <div
          onClick={() => setActiveColorTarget('from')}
          className={`p-4 rounded-xl border transition-all cursor-pointer space-y-3 ${
            activeColorTarget === 'from'
              ? 'border-purple-500 bg-purple-500/10 shadow-md shadow-purple-500/10'
              : 'border-white/10 bg-white/[0.02] hover:border-white/20'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-2">
              <span className="w-3 h-3 rounded-full border border-white/20" style={{ background: fromColor }} />
              Primary Stop {mode === 'solid' ? '(Accent Color)' : '(Start Color)'}
            </span>
            <span className="text-[11px] font-mono font-bold text-purple-300 bg-white/5 px-2 py-0.5 rounded border border-white/10">
              {fromColor.toUpperCase()}
            </span>
          </div>

          <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-2 focus-within:border-purple-500 transition-colors">
            <div className="relative w-9 h-9 rounded-lg overflow-hidden shrink-0 border border-white/20 shadow-sm cursor-pointer">
              <input
                type="color"
                value={fromColor}
                onChange={(e) => handleFromChange(e.target.value)}
                className="absolute -inset-2 w-[150%] h-[150%] cursor-pointer bg-transparent border-0 p-0"
              />
            </div>
            <input
              type="text"
              value={fromColor}
              onChange={(e) => handleFromChange(e.target.value)}
              className="w-full bg-transparent text-sm text-white font-mono uppercase font-bold outline-none"
              placeholder="#8B5CF6"
              maxLength={7}
            />
          </div>
        </div>

        {/* Secondary Color Card */}
        {mode !== 'solid' ? (
          <div
            onClick={() => setActiveColorTarget('to')}
            className={`p-4 rounded-xl border transition-all cursor-pointer space-y-3 ${
              activeColorTarget === 'to'
                ? 'border-pink-500 bg-pink-500/10 shadow-md shadow-pink-500/10'
                : 'border-white/10 bg-white/[0.02] hover:border-white/20'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-2">
                <span className="w-3 h-3 rounded-full border border-white/20" style={{ background: toColor }} />
                Secondary Stop {mode === 'radial' ? '(Outer Glow)' : '(End Color)'}
              </span>
              <span className="text-[11px] font-mono font-bold text-pink-300 bg-white/5 px-2 py-0.5 rounded border border-white/10">
                {toColor.toUpperCase()}
              </span>
            </div>

            <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-2 focus-within:border-pink-500 transition-colors">
              <div className="relative w-9 h-9 rounded-lg overflow-hidden shrink-0 border border-white/20 shadow-sm cursor-pointer">
                <input
                  type="color"
                  value={toColor}
                  onChange={(e) => handleToChange(e.target.value)}
                  className="absolute -inset-2 w-[150%] h-[150%] cursor-pointer bg-transparent border-0 p-0"
                />
              </div>
              <input
                type="text"
                value={toColor}
                onChange={(e) => handleToChange(e.target.value)}
                className="w-full bg-transparent text-sm text-white font-mono uppercase font-bold outline-none"
                placeholder="#EC4899"
                maxLength={7}
              />
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl border border-dashed border-white/10 bg-white/[0.01] flex items-center justify-center text-center">
            <p className="text-xs text-white/40">
              Switch to <strong className="text-white/70">Linear</strong> or <strong className="text-white/70">Radial</strong> to blend two custom gradient stops.
            </p>
          </div>
        )}
      </div>

      {/* Quick Color Swatches */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold text-white/70 uppercase tracking-wider">
            Quick Palette Spectrum
          </span>
          <span className="text-[11px] text-purple-300 font-semibold bg-purple-500/10 px-2.5 py-0.5 rounded-full border border-purple-500/20">
            Applying to: <strong className="text-white">{activeColorTarget === 'from' || mode === 'solid' ? 'Primary Stop' : 'Secondary Stop'}</strong>
          </span>
        </div>
        <div className="grid grid-cols-6 sm:grid-cols-12 gap-2">
          {SPECTRUM_SWATCHES.map((swatch) => {
            const isSelected =
              activeColorTarget === 'from'
                ? fromColor.toLowerCase() === swatch.hex.toLowerCase()
                : toColor.toLowerCase() === swatch.hex.toLowerCase();
            return (
              <button
                key={swatch.name}
                type="button"
                onClick={() => handleSwatchClick(swatch.hex)}
                title={`${swatch.name} (${swatch.hex})`}
                className={`h-10 rounded-xl border transition-all relative flex items-center justify-center group ${
                  isSelected
                    ? 'border-white scale-110 shadow-lg shadow-purple-500/40 ring-2 ring-purple-500/50'
                    : 'border-white/20 hover:scale-105'
                }`}
                style={{ background: swatch.hex }}
              >
                {isSelected && <Check className={`w-4 h-4 ${swatch.hex === '#FFFFFF' ? 'text-black' : 'text-white'}`} strokeWidth={3} />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Gradient Angle & Compass (Linear Mode only) */}
      {mode === 'gradient' && (
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-2">
              <Compass className="w-4 h-4 text-purple-400" />
              Gradient Angle & Flow Direction
            </span>
            <span className="text-xs font-mono font-bold text-purple-300 bg-white/5 px-2.5 py-0.5 rounded-lg border border-white/10">
              {angleDeg}°
            </span>
          </div>

          {/* 360° Smooth Range Slider */}
          <div className="space-y-1.5">
            <input
              type="range"
              min={0}
              max={360}
              step={5}
              value={angleDeg}
              onChange={(e) => handleAngleChange(Number(e.target.value))}
              className="w-full accent-purple-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-white/30 font-mono">
              <span>0° (Top)</span>
              <span>90° (Right)</span>
              <span>180° (Bottom)</span>
              <span>270° (Left)</span>
              <span>360°</span>
            </div>
          </div>

          {/* 8 Compass Direction Buttons */}
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 pt-1">
            {COMPASS_DIRECTIONS.map((dir) => {
              const dirNum = parseInt(dir.angle, 10);
              const isCurrent = angleDeg === dirNum;
              return (
                <button
                  key={dir.angle}
                  type="button"
                  onClick={() => handleAngleChange(dirNum)}
                  className={`py-2 px-2 rounded-xl text-xs font-mono font-bold border transition-all ${
                    isCurrent
                      ? 'border-purple-500 bg-purple-500/25 text-purple-200 shadow-md shadow-purple-500/20'
                      : 'border-white/5 hover:border-white/15 bg-white/[0.02] text-white/60 hover:text-white'
                  }`}
                >
                  {dir.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Dark Base Canvas Tone Selector */}
      <div className="space-y-2.5">
        <label className="text-xs font-bold text-white/70 uppercase tracking-wider">
          Deep Canvas Background Tone
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {BG_TONES.map((b) => (
            <button
              key={b.name}
              type="button"
              onClick={() => handleBgChange(b.hex)}
              className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                bgTone.toLowerCase() === b.hex.toLowerCase()
                  ? 'border-purple-500 bg-purple-500/15 shadow-md shadow-purple-500/10'
                  : 'border-white/5 hover:border-white/10 bg-white/[0.02]'
              }`}
            >
              <span className="w-4 h-4 rounded-full border border-white/20 shrink-0 shadow-sm" style={{ background: b.hex }} />
              <span className="text-xs font-medium text-white/80 truncate">{b.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 1-Click Curated Presets */}
      <div className="space-y-2.5 pt-1">
        <p className="text-xs uppercase tracking-wider text-white/50 font-bold">1-Click Curated Inspiration Presets</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {CURATED_GRADIENTS.map((c) => (
            <button
              key={c.name}
              type="button"
              onClick={() => applyCurated(c)}
              className="p-3 rounded-xl border border-white/10 hover:border-purple-500/40 bg-white/[0.02] hover:bg-white/[0.05] transition-all text-left flex items-center gap-3 group"
            >
              <span
                className="w-6 h-6 rounded-full shrink-0 shadow-sm border border-white/20 group-hover:scale-110 transition-transform"
                style={{ background: `linear-gradient(${c.angle}, ${c.from}, ${c.to})` }}
              />
              <span className="text-xs font-semibold text-white/80 group-hover:text-white truncate">{c.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Immersive Live Platform Simulation Deck */}
      <div className="pt-5 border-t border-white/10 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wider text-purple-300 font-bold flex items-center gap-1.5">
            <Eye className="w-4 h-4 text-purple-400" />
            Live Platform Simulation
          </p>
          <span className="text-[10px] text-white/40">Real-time theme rendering</span>
        </div>

        <div
          className="p-6 rounded-2xl border transition-all space-y-5"
          style={{
            background: bgTone,
            borderColor: 'rgba(255, 255, 255, 0.1)',
            boxShadow: `0 20px 50px -15px ${fromColor}33, 0 0 30px -10px ${toColor}22`,
          }}
        >
          {/* Header Preview Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <span className="w-3.5 h-3.5 rounded-full animate-pulse shadow-md" style={{ background: activeGradientCSS }} />
              <span className="text-sm font-extrabold bg-clip-text text-transparent tracking-tight" style={{ backgroundImage: activeGradientCSS }}>
                CoWatch • Vibers Custom Aesthetic
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="text-[10px] font-bold px-2.5 py-1 rounded-full border shadow-sm"
                style={{
                  borderColor: `${fromColor}66`,
                  color: fromColor,
                  backgroundColor: `${fromColor}15`,
                }}
              >
                ● LIVE SYNCED
              </span>
            </div>
          </div>

          {/* Interactive UI Elements Demonstration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Primary Action Button Showcase */}
            <div className="space-y-2 p-4 rounded-xl bg-white/[0.02] border border-white/5">
              <p className="text-[10px] text-white/40 uppercase tracking-wider font-bold">Interactive Action Button</p>
              <button
                type="button"
                className="w-full py-3 px-5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg flex items-center justify-center gap-2"
                style={{
                  background: activeGradientCSS,
                  color: '#FFFFFF',
                  boxShadow: `0 6px 24px ${fromColor}55`,
                }}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Join Watch Party
              </button>
            </div>

            {/* Room Card Showcase with Live Visualizer */}
            <div
              className="p-4 rounded-xl border space-y-2.5 transition-all"
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                borderColor: `${fromColor}40`,
                boxShadow: `0 0 20px ${fromColor}15`,
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">Movie Night Lounge</span>
                {/* Dancing Equalizer Bars */}
                <div className="flex items-end gap-1 h-3.5">
                  {[0.4, 0.9, 0.6, 1.0, 0.5, 0.8].map((h, i) => (
                    <span
                      key={i}
                      className="w-1 rounded-full animate-pulse"
                      style={{
                        height: `${h * 100}%`,
                        background: activeGradientCSS,
                        animationDelay: `${i * 150}ms`,
                      }}
                    />
                  ))}
                </div>
              </div>
              <p className="text-[11px] text-white/60">Synchronized 4K Stream • 12 Vibers in session</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
