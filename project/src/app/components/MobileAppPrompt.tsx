"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Smartphone, Download, X, Sparkles, CheckCircle2 } from 'lucide-react';

const APP_URL = "https://katyalstore.vercel.app/app/cowatch";

export function MobileAppPrompt() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // 1. Guard against SSR
    if (typeof window === 'undefined') return;

    // 2. Check if already inside the native Android App (via JavaScript interface bridge)
    const isInsideAndroidApp = 'AndroidUploadBridge' in window;
    if (isInsideAndroidApp) {
      return; // Never show inside the Android WebView
    }

    // 3. Check if client is on a mobile device or small viewport
    const checkIsMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera || '';
      const isMobileUA = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
      const isSmallScreen = window.innerWidth < 768;
      return isMobileUA || isSmallScreen;
    };

    if (checkIsMobile()) {
      // Graceful 650ms delay for smooth initial page hydration
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 650);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismiss = () => {
    // Dismiss for the current page view; reappears on refresh/reload/login
    setIsOpen(false);
  };

  const handleOpenApp = () => {
    // Try to trigger deep link or navigate to download page
    window.open(APP_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Subtle dim backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleDismiss}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-xs lg:hidden"
          />

          {/* Bottom Sheet Modal */}
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 340 }}
            className="fixed bottom-0 inset-x-0 z-[61] lg:hidden max-w-lg mx-auto p-5 pb-[max(env(safe-area-inset-bottom,1rem),1.25rem)] rounded-t-[2rem] bg-[#0E0E14]/95 backdrop-blur-2xl border-t border-white/10 shadow-[0_-12px_48px_rgba(0,0,0,0.85)] text-white"
          >
            {/* Sheet Handle */}
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />

            {/* Header & Close */}
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                {/* App Icon Frame with Neon Glow */}
                <div className="relative shrink-0">
                  <div className="absolute -inset-1 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 opacity-60 blur-xs" />
                  <div className="relative w-12 h-12 rounded-2xl bg-neutral-900 border border-white/20 flex items-center justify-center shadow-lg overflow-hidden">
                    <img 
                      src="/icon.ico" 
                      alt="CoWatch" 
                      className="w-8 h-8 object-contain"
                      onError={(e) => {
                        // Fallback icon if /icon.ico is not directly accessible
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                    <Smartphone className="w-6 h-6 text-purple-400 absolute inset-0 m-auto -z-10" />
                  </div>
                </div>

                {/* Title & Badge */}
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-500/15 text-purple-300 border border-purple-500/25 mb-1">
                    <Sparkles className="w-3 h-3 text-purple-400" />
                    Android App Available
                  </div>
                  <h3 className="text-base font-bold text-white leading-tight">
                    Experience CoWatch on Android
                  </h3>
                </div>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={handleDismiss}
                className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                aria-label="Close app prompt"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Perks list */}
            <div className="space-y-1.5 py-1 mb-5 text-xs text-white/70">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Double-tap seek &amp; seamless gesture controls</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Uninterrupted full-screen playback with zero browser bars</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Optimized low-latency sync &amp; voice chat</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleOpenApp}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-500 hover:to-indigo-500 shadow-[0_4px_20px_rgba(124,58,237,0.4)] active:scale-[0.98] transition-all"
              >
                <Download className="w-4 h-4" />
                <span>Download / Open App</span>
              </button>

              <button
                type="button"
                onClick={handleDismiss}
                className="w-full py-2.5 px-4 rounded-xl font-medium text-xs text-white/50 hover:text-white/80 hover:bg-white/[0.04] transition-colors"
              >
                Continue in Browser
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
