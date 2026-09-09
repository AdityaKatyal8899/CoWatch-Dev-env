"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../lib/auth';
import { useTheme } from '../components/ThemeProvider';
import { api } from '../lib/api';
import { useRouter } from 'next/navigation';
import { Check, ChevronRight, Palette, Sparkles, Loader2, Info, Lock, ArrowLeft, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

const GENRES = [
  'Anime', 'Gaming', 'Movies', 'Music', 'Tech', 
  'Sports', 'Comedy', 'Documentary', 'Horror', 'Sci-Fi'
];

const PRESETS = [
  { id: 'default-dark', name: 'Original Dark', tier: 'Default Free', bg: '#0B0B0F', accent: '#FFFFFF' },
  { id: 'neo-purple', name: 'Neo Purple', tier: 'Pro Plan', bg: '#0F0B1A', accent: '#8B5CF6' },
  { id: 'midnight-blue', name: 'Midnight Blue', tier: 'Pro+ Plan', bg: '#070B14', accent: '#3B82F6' },
  { id: 'cyber-green', name: 'Cyber Green', tier: 'Vibers Plan', bg: '#050805', accent: '#22C55E' },
  { id: 'warm-minimal', name: 'Warm Minimal', tier: 'Pro Plan', bg: '#0F0F0F', accent: '#F59E0B' },
];

export default function OnboardingPage() {
  const { user, setUserState } = useAuth();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  // Profile State
  const [displayName, setDisplayName] = useState(user?.name || '');
  const [dob, setDob] = useState<string>('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  
  // Theme Preview State (Defaults to default-dark)
  const [previewTheme, setPreviewTheme] = useState<string>('default-dark');

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

  const handleComplete = async (chosenTheme = 'default-dark') => {
    const trimmedName = displayName.trim();
    if (!trimmedName) {
      toast.error('Please enter a display name');
      if (step !== 1) setStep(1);
      return;
    }
    if (trimmedName.length < 2) {
      toast.error('Display name must be at least 2 characters');
      if (step !== 1) setStep(1);
      return;
    }

    setIsSubmitting(true);
    try {
      const isPaidUser = user?.plan && user.plan !== 'free';
      const finalTheme = (isPaidUser && chosenTheme) ? chosenTheme : 'default-dark';
      
      const payload = {
        display_name: trimmedName,
        date_of_birth: dob || undefined,
        genres: selectedGenres,
        theme: finalTheme
      };
      
      // Ensure local theme is reset to default-dark if free user
      if (!isPaidUser) {
        setTheme('default-dark');
      } else {
        setTheme(finalTheme);
      }
      
      const updatedUser = await api.onboardUser(payload);
      setUserState(updatedUser);
      setIsSuccess(true);
      
      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);
    } catch (error: any) {
      toast.error(error.message || 'Failed to complete onboarding');
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[var(--bg)] text-[var(--text)] transition-colors duration-500">
        <motion.div
           initial={{ opacity: 0, scale: 0.85 }}
           animate={{ opacity: 1, scale: 1 }}
           className="flex flex-col items-center gap-6 text-center"
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
            className="space-y-2"
          >
            <h2 className="text-2xl font-bold">Setting up your space...</h2>
            <p className="text-[var(--muted)] text-sm">Welcome to CoWatch, {displayName.trim()}!</p>
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
        {/* Header Progress Bar */}
        <div className="absolute top-0 left-0 w-full h-1 bg-[rgba(255,255,255,0.05)]">
          <motion.div 
            className="h-full bg-[var(--primary)]"
            animate={{ width: step === 1 ? '100%' : '100%' }}
            transition={{ type: "spring", stiffness: 100, damping: 20 }}
          />
        </div>

        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-6"
            >
              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--primary)]/10 border border-[var(--primary)]/20 text-[var(--primary)] text-xs font-semibold mb-1">
                  <Sparkles className="w-3.5 h-3.5" /> Quick Setup
                </div>
                <h1 className="text-3xl font-bold tracking-tight">Welcome to CoWatch</h1>
                <p className="text-[var(--muted)] text-sm">Set up your profile to start streaming and joining rooms with friends.</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">Display Name *</label>
                  <input
                    ref={inputRef}
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Enter your username (e.g. Alex)"
                    className="w-full bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.1)] rounded-xl p-3.5 outline-none focus:border-[var(--primary)] transition-colors text-white"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">Date of Birth</label>
                  <input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.1)] rounded-xl p-3.5 outline-none focus:border-[var(--primary)] transition-colors text-white"
                  />
                  <p className="text-xs text-[var(--muted)]">Required to verify age for 18+ rooms. You must be 18 or older to host or join adult content.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">Pick your vibes (Optional)</label>
                  <div className="flex flex-wrap gap-2">
                    {GENRES.map(genre => {
                      const isSelected = selectedGenres.includes(genre);
                      return (
                        <button
                          key={genre}
                          type="button"
                          onClick={() => toggleGenre(genre)}
                          className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border ${
                            isSelected
                              ? 'bg-[var(--primary)] border-[var(--primary)] text-white shadow-[0_0_12px_rgba(var(--primary-rgb),0.3)]'
                              : 'bg-transparent border-[rgba(255,255,255,0.1)] text-[var(--muted)] hover:border-[var(--primary)]'
                          }`}
                        >
                          {genre}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Primary Action: Direct One-Click Onboarding with Default Dark */}
              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleComplete('default-dark')}
                  disabled={isSubmitting}
                  className="w-full bg-[var(--primary)] hover:opacity-90 disabled:opacity-50 text-[var(--bg)] font-bold py-4 rounded-xl flex items-center justify-center gap-2 group transition-all shadow-[0_4px_20px_rgba(var(--primary-rgb),0.3)]"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      Get Started <Sparkles className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    </>
                  )}
                </button>

                {/* Optional Theme Showcase link */}
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="text-xs text-[var(--muted)] hover:text-white transition-colors inline-flex items-center gap-1.5 py-1"
                  >
                    <Palette className="w-3.5 h-3.5 text-purple-400" />
                    Preview Themes Showcase (Optional)
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="space-y-6"
            >
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-semibold">
                  <Palette className="w-3.5 h-3.5" /> Theme Showcase
                </div>
                <h1 className="text-2xl font-bold tracking-tight">Theme Showcase</h1>
                <p className="text-[var(--muted)] text-xs">
                  Free accounts use <strong className="text-white">Original Dark</strong> by default. Premium themes can be unlocked anytime via subscription plans.
                </p>
              </div>

              {/* Theme Showcase Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PRESETS.map(preset => {
                  const isDefaultFree = preset.id === 'default-dark';
                  const isSelected = previewTheme === preset.id;
                  
                  return (
                    <div
                      key={preset.id}
                      onClick={() => {
                        setPreviewTheme(preset.id);
                        if (!isDefaultFree) {
                          toast.info(`"${preset.name}" is a ${preset.tier} showcase theme. Free accounts use Original Dark on setup.`);
                        }
                      }}
                      className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all relative overflow-hidden group ${
                        isSelected 
                          ? 'border-[var(--primary)] bg-[rgba(255,255,255,0.04)] shadow-[0_0_15px_rgba(var(--primary-rgb),0.15)]'
                          : 'border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.01)] hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold flex items-center gap-1.5">
                          {preset.name}
                          {!isDefaultFree && <Lock className="w-3 h-3 text-purple-400" />}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          isDefaultFree 
                            ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                            : 'bg-purple-500/10 text-purple-300 border border-purple-500/20'
                        }`}>
                          {preset.tier}
                        </span>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex gap-1.5">
                          <div className="w-4 h-4 rounded-full border border-white/10" style={{ background: preset.bg }} />
                          <div className="w-4 h-4 rounded-full" style={{ background: preset.accent }} />
                        </div>
                        {isSelected && (
                          <div className="flex items-center gap-1 text-[11px] text-[var(--primary)] font-medium">
                            <Check className="w-3.5 h-3.5" />
                            {isDefaultFree ? 'Default Active' : 'Previewing'}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Custom Colors Showcase Banner */}
              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs">
                <div className="space-y-0.5">
                  <p className="font-semibold text-white/80 flex items-center gap-1.5">
                    Custom Hex Color Engine <Lock className="w-3 h-3 text-purple-400" />
                  </p>
                  <p className="text-white/40 text-[11px]">Full custom RGB & Hex styling unlocked with Pro+ & Vibers plans.</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="sm:w-1/3 bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)] py-3.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to Profile
                </button>

                <button
                  type="button"
                  onClick={() => handleComplete('default-dark')}
                  disabled={isSubmitting}
                  className="sm:w-2/3 bg-[var(--primary)] text-[var(--bg)] py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-all shadow-[0_4px_20px_rgba(var(--primary-rgb),0.3)]"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      Continue with Original Dark <Sparkles className="w-4 h-4" />
                    </>
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
