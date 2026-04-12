"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../lib/auth';
import { useTheme } from '../components/ThemeProvider';
import { api } from '../lib/api';
import { useRouter } from 'next/navigation';
import { Check, ChevronRight, User, Palette, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const GENRES = [
  'Anime', 'Gaming', 'Movies', 'Music', 'Tech', 
  'Sports', 'Comedy', 'Documentary', 'Horror', 'Sci-Fi'
];

const PRESETS = [
  { id: 'default-dark', name: 'Original Dark' },
  { id: 'neo-purple', name: 'Neo Purple' },
  { id: 'midnight-blue', name: 'Midnight Blue' },
  { id: 'cyber-green', name: 'Cyber Green' },
  { id: 'warm-minimal', name: 'Warm Minimal' },
];

const COLORS = {
  bg: ['#0B0B0F', '#0F172A', '#111827', '#1A1A2E', '#0A0F1F', '#18181B'],
  primary: ['#8B5CF6', '#3B82F6', '#22C55E', '#F59E0B', '#EF4444', '#06B6D4'],
  text: ['#FFFFFF', '#E5E7EB', '#D1D5DB'],
};

export default function OnboardingPage() {
  const { user, updateProfile } = useAuth();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Step 1 State
  const [displayName, setDisplayName] = useState('');
  const [age, setAge] = useState<string>('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  
  // Step 2 State
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customBg, setCustomBg] = useState(COLORS.bg[0]);
  const [customPrimary, setCustomPrimary] = useState(COLORS.primary[0]);
  const [customText, setCustomText] = useState(COLORS.text[0]);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user?.display_name) {
      router.push('/dashboard');
    }
  }, [user, router]);

  useEffect(() => {
    if (step === 1 && inputRef.current) {
      inputRef.current.focus();
    }
  }, [step]);

  const toggleGenre = (genre: string) => {
    setSelectedGenres(prev => 
      prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre]
    );
  };

  const handleNext = () => {
    if (!displayName.trim()) {
      toast.error('Please enter a display name');
      return;
    }
    setStep(2);
  };

  const currentThemeString = isCustomMode 
    ? `custom:${customBg}:${customPrimary}:${customText}`
    : theme;

  useEffect(() => {
    if (isCustomMode) {
      setTheme(`custom:${customBg}:${customPrimary}:${customText}`);
    }
  }, [isCustomMode, customBg, customPrimary, customText, setTheme]);

  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const payload = {
        display_name: displayName,
        age: age ? parseInt(age) : undefined,
        genres: selectedGenres,
        theme: currentThemeString
      };
      
      const updatedUser = await api.onboardUser(payload);
      await updateProfile(updatedUser);
      setIsSuccess(true);
      
      // Delay redirect to allow theme and state to hydrate
      setTimeout(() => {
        router.push('/dashboard');
      }, 2500);
    } catch (error: any) {
      toast.error(error.message || 'Failed to complete onboarding');
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[var(--bg)] text-[var(--text)] transition-colors duration-1000">
        <motion.div
           initial={{ opacity: 0, scale: 0.8 }}
           animate={{ opacity: 1, scale: 1 }}
           className="flex flex-col items-center gap-6"
        >
          <div className="relative">
            <motion.div 
              className="w-16 h-16 border-4 border-[var(--primary)] border-t-transparent rounded-full"
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            />
            <Sparkles className="w-6 h-6 text-[var(--primary)] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center"
          >
            <h2 className="text-2xl font-bold mb-2">Setting up your space...</h2>
            <p className="text-[var(--muted)] text-sm">Applying your preferences</p>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--bg)] text-[var(--text)] transition-colors duration-200">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-xl w-full glass-card p-8 rounded-2xl border border-[rgba(255,255,255,0.05)] shadow-2xl relative overflow-hidden"
      >
        {/* Progress Bar */}
        <div className="absolute top-0 left-0 w-full h-1 bg-[rgba(255,255,255,0.05)]">
          <motion.div 
            className="h-full bg-[var(--primary)]"
            animate={{ width: `${(step / 2) * 100}%` }}
            transition={{ type: "spring", stiffness: 100, damping: 20 }}
          />
        </div>

        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">Welcome to CoWatch</h1>
                <p className="text-[var(--muted)]">Let's set up your profile.</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[var(--muted)] uppercase tracking-wider">Display Name</label>
                  <input
                    ref={inputRef}
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Alex"
                    className="w-full bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.1)] rounded-lg p-3 outline-none focus:border-[var(--primary)] transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-[var(--muted)] uppercase tracking-wider">Age (Optional)</label>
                  <input
                    type="number"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="21"
                    className="w-full bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.1)] rounded-lg p-3 outline-none focus:border-[var(--primary)] transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-[var(--muted)] uppercase tracking-wider">Pick your vibes</label>
                  <div className="flex flex-wrap gap-2">
                    {GENRES.map(genre => (
                      <button
                        key={genre}
                        onClick={() => toggleGenre(genre)}
                        className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 border ${
                          selectedGenres.includes(genre)
                            ? 'bg-[var(--primary)] border-[var(--primary)] text-white'
                            : 'bg-transparent border-[rgba(255,255,255,0.1)] text-[var(--muted)] hover:border-[var(--primary)]'
                        }`}
                      >
                        {genre}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button
                onClick={handleNext}
                className="w-full bg-[var(--primary)] hover:opacity-90 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 group transition-all"
              >
                Next <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-end">
                <div className="space-y-2">
                  <h1 className="text-3xl font-bold tracking-tight">Personalize</h1>
                  <p className="text-[var(--muted)]">Choose a style that fits you.</p>
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs uppercase tracking-widest text-[var(--muted)]">Customize</span>
                  <button 
                    onClick={() => setIsCustomMode(!isCustomMode)}
                    className={`w-10 h-5 rounded-full transition-colors relative ${isCustomMode ? 'bg-[var(--primary)]' : 'bg-[rgba(255,255,255,0.1)]'}`}
                  >
                    <motion.div 
                      className="absolute top-1 left-1 w-3 h-3 bg-white rounded-full"
                      animate={{ x: isCustomMode ? 20 : 0 }}
                    />
                  </button>
                </div>
              </div>

              {!isCustomMode ? (
                <div className="grid grid-cols-2 gap-4">
                  {PRESETS.map(preset => (
                    <button
                      key={preset.id}
                      onClick={() => setTheme(preset.id)}
                      className={`p-4 rounded-xl border text-left transition-all relative overflow-hidden group ${
                        theme === preset.id 
                          ? 'border-[var(--primary)] shadow-[0_0_20px_rgba(var(--primary-rgb),0.2)]'
                          : 'border-[rgba(255,255,255,0.1)] hover:border-[var(--primary)]'
                      }`}
                    >
                      <span className="text-sm font-semibold">{preset.name}</span>
                      <div className="mt-2 flex gap-1">
                        <div className="w-4 h-4 rounded-full border border-[rgba(255,255,255,0.1)]" style={{ background: preset.id === 'default-dark' ? '#0B0B0F' : preset.id === 'neo-purple' ? '#0F0B1A' : preset.id === 'midnight-blue' ? '#070B14' : preset.id === 'cyber-green' ? '#050805' : '#0F0F0F' }} />
                        <div className="w-4 h-4 rounded-full" style={{ background: preset.id === 'default-dark' ? '#FFFFFF' : preset.id === 'neo-purple' ? '#8B5CF6' : preset.id === 'midnight-blue' ? '#3B82F6' : preset.id === 'cyber-green' ? '#22C55E' : '#F59E0B' }} />
                      </div>
                      {theme === preset.id && (
                        <div className="absolute top-2 right-2">
                          <Check className="w-4 h-4 text-[var(--primary)]" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="space-y-3">
                    <label className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">Background</label>
                    <div className="flex flex-wrap gap-3">
                      {COLORS.bg.map(c => (
                        <button 
                          key={c}
                          onClick={() => setCustomBg(c)}
                          className={`w-10 h-10 rounded-lg border-2 transition-all ${customBg === c ? 'border-[var(--primary)] scale-110' : 'border-transparent'}`}
                          style={{ background: c }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">Primary Color</label>
                    <div className="flex flex-wrap gap-3">
                      {COLORS.primary.map(c => (
                        <button 
                          key={c}
                          onClick={() => setCustomPrimary(c)}
                          className={`w-10 h-10 rounded-full border-2 transition-all ${customPrimary === c ? 'border-white scale-110' : 'border-transparent'}`}
                          style={{ background: c }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">Text Color</label>
                    <div className="flex flex-wrap gap-3">
                      {COLORS.text.map(c => (
                        <button 
                          key={c}
                          onClick={() => setCustomText(c)}
                          className={`w-10 h-10 rounded-lg border-2 transition-all ${customText === c ? 'border-[var(--primary)] scale-110' : 'border-transparent'}`}
                          style={{ background: c }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)] py-4 rounded-xl font-bold transition-all"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="flex-[2] bg-[var(--primary)] text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-all shadow-[0_4px_20px_rgba(var(--primary-rgb),0.3)]"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>Get Started <Sparkles className="w-5 h-5" /></>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
