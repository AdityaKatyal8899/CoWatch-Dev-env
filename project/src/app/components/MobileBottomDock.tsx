"use client";

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../lib/auth';
import { toast } from 'sonner';
import { 
  User, 
  Settings, 
  Gem, 
  LogOut, 
  Sparkles, 
  ShieldCheck, 
  X,
  ChevronRight
} from 'lucide-react';

/* -------------------------------------------------------------------------- */
/*                        Rich Custom Duotone SVG Icons                       */
/* -------------------------------------------------------------------------- */

interface IconProps {
  isActive: boolean;
  className?: string;
}

// 1. Dashboard Icon (Multi-tile neon glass grid)
function DashboardIcon({ isActive }: IconProps) {
  return (
    <svg className="w-5 h-5 transition-transform duration-300" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="dashGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--primary, #8B5CF6)" />
          <stop offset="100%" stopColor="var(--primary-hover, #6D28D9)" />
        </linearGradient>
      </defs>
      <rect
        x="3"
        y="3"
        width="8"
        height="8"
        rx="2.5"
        fill={isActive ? "url(#dashGrad)" : "rgba(255,255,255,0.08)"}
        stroke={isActive ? "var(--primary, #8B5CF6)" : "rgba(255,255,255,0.3)"}
        strokeWidth="1.5"
        className="transition-colors duration-300"
      />
      <rect
        x="13"
        y="3"
        width="8"
        height="5"
        rx="2"
        fill={isActive ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.04)"}
        stroke={isActive ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.2)"}
        strokeWidth="1.5"
        className="transition-colors duration-300"
      />
      <rect
        x="13"
        y="10"
        width="8"
        height="11"
        rx="2.5"
        fill={isActive ? "url(#dashGrad)" : "rgba(255,255,255,0.08)"}
        stroke={isActive ? "var(--primary, #8B5CF6)" : "rgba(255,255,255,0.3)"}
        strokeWidth="1.5"
        className="transition-colors duration-300"
      />
      <rect
        x="3"
        y="13"
        width="8"
        height="8"
        rx="2"
        fill={isActive ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.04)"}
        stroke={isActive ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.2)"}
        strokeWidth="1.5"
        className="transition-colors duration-300"
      />
    </svg>
  );
}

// 2. Upload Icon (Cloud with kinetic upward energy beam)
function UploadIcon({ isActive }: IconProps) {
  return (
    <svg className="w-5 h-5 transition-transform duration-300" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="upGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--primary, #8B5CF6)" />
          <stop offset="100%" stopColor="var(--primary-hover, #A78BFA)" />
        </linearGradient>
      </defs>
      <path
        d="M4 16.2424C2.79642 15.436 2 14.0628 2 12.5C2 10.1564 3.79151 8.23129 6.07974 8.01958C6.56781 5.17206 9.03065 3 12 3C14.9694 3 17.4322 5.17206 17.9203 8.01958C20.2085 8.23129 22 10.1564 22 12.5C22 14.0628 21.2036 15.436 20 16.2424"
        stroke={isActive ? "var(--primary, #8B5CF6)" : "rgba(255,255,255,0.4)"}
        strokeWidth="1.75"
        strokeLinecap="round"
        fill={isActive ? "rgba(139, 92, 246, 0.15)" : "none"}
      />
      <path
        d="M12 11V21M12 11L8.5 14.5M12 11L15.5 14.5"
        stroke={isActive ? "#FFFFFF" : "rgba(255,255,255,0.6)"}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// 3. Center Watch Party Hero Icon (Glowing broadcast orb)
function WatchPartyOrb({ isActive }: IconProps) {
  return (
    <div className="relative flex items-center justify-center">
      {/* Subtle ambient glow */}
      <div 
        className="absolute -inset-0.5 rounded-full blur-xs opacity-60 animate-pulse"
        style={{ background: 'var(--primary-gradient, radial-gradient(circle, #8B5CF6 0%, #6D28D9 100%))' }}
      />
      
      {/* Radiant Orb Surface - fits cleanly inside the slim dock */}
      <div 
        className="relative w-7 h-7 rounded-full flex items-center justify-center shadow-md border border-white/20 overflow-hidden"
        style={{ background: 'var(--primary-gradient, linear-gradient(135deg, #A78BFA 0%, #7C3AED 50%, #4C1D95 100%))' }}
      >
        <div className="absolute inset-0 bg-gradient-to-tr from-white/25 via-transparent to-transparent opacity-80" />
        <svg className="w-3 h-3 text-white translate-x-0.5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M5.25 4.5v15a.75.75 0 001.16.63l12-7.5a.75.75 0 000-1.26l-12-7.5a.75.75 0 00-1.16.63z" />
        </svg>
      </div>
    </div>
  );
}

// 4. Collections / Library Icon (Layered glass folder / film reel)
function CollectionsIcon({ isActive }: IconProps) {
  return (
    <svg className="w-4 h-4 transition-transform duration-300" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="folderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--primary, #8B5CF6)" />
          <stop offset="100%" stopColor="var(--primary-hover, #6D28D9)" />
        </linearGradient>
      </defs>
      <path
        d="M2 7C2 5.89543 2.89543 5 4 5H8.58579C9.11622 5 9.62493 5.21071 10 5.58579L11.4142 7H20C21.1046 7 22 7.89543 22 9V17C22 18.1046 21.1046 19 20 19H4C2.89543 19 2 18.1046 2 17V7Z"
        fill={isActive ? "url(#folderGrad)" : "rgba(255,255,255,0.06)"}
        stroke={isActive ? "var(--primary, #8B5CF6)" : "rgba(255,255,255,0.3)"}
        strokeWidth="1.5"
      />
      <circle 
        cx="12" 
        cy="13" 
        r="2" 
        fill={isActive ? "#FFFFFF" : "rgba(255,255,255,0.4)"} 
      />
    </svg>
  );
}

// 5. More / Account Icon (Interactive triple-dot badge)
function MoreIcon({ isActive }: IconProps) {
  return (
    <svg className="w-4 h-4 transition-transform duration-300" viewBox="0 0 24 24" fill="none">
      <circle 
        cx="12" 
        cy="12" 
        r="10" 
        stroke={isActive ? "var(--primary, #8B5CF6)" : "rgba(255,255,255,0.25)"} 
        strokeWidth="1.5" 
        fill={isActive ? "rgba(139, 92, 246, 0.12)" : "rgba(255,255,255,0.02)"}
      />
      <circle cx="7.5" cy="12" r="1.5" fill={isActive ? "#FFFFFF" : "rgba(255,255,255,0.5)"} />
      <circle cx="12" cy="12" r="1.5" fill={isActive ? "#FFFFFF" : "rgba(255,255,255,0.5)"} />
      <circle cx="16.5" cy="12" r="1.5" fill={isActive ? "#FFFFFF" : "rgba(255,255,255,0.5)"} />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*                         Mobile Bottom Dock Component                       */
/* -------------------------------------------------------------------------- */

export function MobileBottomDock() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [showMoreSheet, setShowMoreSheet] = useState(false);

  const handleLogout = async () => {
    setShowMoreSheet(false);
    await logout();
    router.push('/auth');
  };

  const navTabs = [
    { id: 'dashboard', label: 'Home', path: '/dashboard', Icon: DashboardIcon },
    { id: 'upload', label: 'Upload', path: '/upload', Icon: UploadIcon },
    { id: 'create-stream', label: 'Party', path: '/create-stream', Icon: WatchPartyOrb, isHero: true },
    { 
      id: 'collections', 
      label: 'Library', 
      path: '/collections', 
      Icon: CollectionsIcon,
      isLocked: !user?.plan || user.plan === 'free'
    },
    { id: 'more', label: 'More', isCustom: true, Icon: MoreIcon },
  ];

  return (
    <>
      {/* -------------------------------------------------------------------- */}
      {/*               Floating Glassmorphic Bottom Dock Container            */}
      {/* -------------------------------------------------------------------- */}
      <div className="fixed bottom-0 inset-x-0 z-50 lg:hidden pointer-events-none flex justify-center px-3 pb-[max(env(safe-area-inset-bottom,0.5rem),0.625rem)]">
        <nav 
          className="pointer-events-auto flex items-center justify-between w-[94%] max-w-[420px] px-2 py-1 rounded-2xl bg-[#0E0E14]/90 backdrop-blur-2xl border border-white/10 shadow-[0_10px_32px_rgba(0,0,0,0.8)]"
        >
          {navTabs.map((tab) => {
            const isHero = tab.isHero;
            const isMoreTab = tab.isCustom;
            const isActive = isMoreTab 
              ? showMoreSheet 
              : pathname === tab.path || (tab.path === '/dashboard' && pathname === '/');

            // 1. Center Hero Button (Watch Party - fitted neatly in the dock)
            if (isHero) {
              return (
                <div key={tab.id} className="relative flex-1 flex flex-col items-center justify-center">
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => {
                      setShowMoreSheet(false);
                      router.push(tab.path!);
                    }}
                    className={`relative w-full flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-colors focus:outline-none ${
                      isActive ? 'text-white' : 'text-white/60 hover:text-white'
                    }`}
                    aria-label="Start Watch Party"
                  >
                    {/* Active Fluid Spring Background Capsule */}
                    {isActive && (
                      <motion.div
                        layoutId="mobile-dock-active-pill"
                        className="absolute inset-0 rounded-xl bg-white/10 border border-white/15 shadow-inner"
                        transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                      />
                    )}

                    <div className="relative z-10 flex flex-col items-center">
                      <WatchPartyOrb isActive={isActive} />
                      <span className={`text-[9px] tracking-tight mt-0.5 ${
                        isActive ? 'font-bold text-white' : 'font-medium text-white/50'
                      }`}>
                        {tab.label}
                      </span>
                    </div>
                  </motion.button>
                </div>
              );
            }

            // 2. Custom "More" Trigger
            if (isMoreTab) {
              return (
                <div key={tab.id} className="relative flex-1 flex flex-col items-center justify-center">
                  <motion.button
                    whileTap={{ scale: 0.88 }}
                    onClick={() => setShowMoreSheet(!showMoreSheet)}
                    className={`relative w-full flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-colors focus:outline-none ${
                      isActive ? 'text-white' : 'text-white/40 hover:text-white/70'
                    }`}
                  >
                    {/* Active Fluid Spring Background Capsule */}
                    {isActive && (
                      <motion.div
                        layoutId="mobile-dock-active-pill"
                        className="absolute inset-0 rounded-xl bg-white/10 border border-white/15 shadow-inner"
                        transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                      />
                    )}

                    <div className="relative z-10 flex flex-col items-center">
                      <tab.Icon isActive={isActive} />
                      <span className={`text-[9px] tracking-tight mt-0.5 ${
                        isActive ? 'font-bold text-white' : 'font-medium text-white/40'
                      }`}>
                        {tab.label}
                      </span>
                    </div>
                  </motion.button>
                </div>
              );
            }

            // 3. Standard Navigation Links
            return (
              <div key={tab.id} className="relative flex-1 flex flex-col items-center justify-center">
                <Link
                  href={tab.isLocked ? '/plans' : tab.path!}
                  onClick={(e) => {
                    setShowMoreSheet(false);
                    if (tab.isLocked) {
                      e.preventDefault();
                      toast.error('Collections is available on paid plans. Redirecting to plans...');
                      router.push('/plans');
                    }
                  }}
                  className={`relative w-full flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-colors focus:outline-none ${
                    isActive ? 'text-white' : 'text-white/40 hover:text-white/70'
                  }`}
                >
                  {/* Active Fluid Spring Background Capsule */}
                  {isActive && (
                    <motion.div
                      layoutId="mobile-dock-active-pill"
                      className="absolute inset-0 rounded-xl bg-white/10 border border-white/15 shadow-inner"
                      transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                    />
                  )}

                  <motion.div 
                    animate={isActive ? { y: -1 } : { y: 0 }}
                    transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                    className="relative z-10 flex flex-col items-center"
                  >
                    <tab.Icon isActive={isActive} />
                    <span className={`text-[9px] tracking-tight mt-0.5 flex items-center gap-0.5 ${
                      isActive ? 'font-bold text-white' : 'font-medium text-white/40'
                    }`}>
                      {tab.label}
                      {tab.isLocked && <span className="text-[7.5px] opacity-70">🔒</span>}
                    </span>
                    
                    {/* Glowing Micro-Dot on Active Tab */}
                    {isActive && (
                      <motion.div 
                        layoutId="active-dot"
                        className="w-1 h-1 rounded-full bg-[var(--primary,#8B5CF6)] shadow-[0_0_8px_var(--primary,#8B5CF6)] mt-0.5"
                      />
                    )}
                  </motion.div>
                </Link>
              </div>
            );
          })}
        </nav>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/*               Glassmorphic Action Sheet ("More" Capsule)             */}
      {/* -------------------------------------------------------------------- */}
      <AnimatePresence>
        {showMoreSheet && (
          <>
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMoreSheet(false)}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden"
            />

            {/* Slide-up Sheet */}
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              className="fixed bottom-0 inset-x-0 z-50 lg:hidden p-4 pb-[max(env(safe-area-inset-bottom,1rem),1.25rem)] rounded-t-[2.5rem] bg-[#101016]/95 backdrop-blur-2xl border-t border-white/10 shadow-2xl space-y-4"
            >
              {/* Sheet Drag Handle / Header */}
              <div className="flex items-center justify-between px-2 pt-1">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
                    {user?.profile_picture ? (
                      <img src={user.profile_picture} alt={user.name} className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-4 h-4 text-white/40" />
                    )}
                  </div>
                  <div>
                    <p className="text-white text-xs font-bold truncate">{user?.display_name || user?.name || 'Account'}</p>
                    <p className="text-white/40 text-[10px] uppercase font-semibold tracking-wider">
                      {user?.plan || 'Free'} Member
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowMoreSheet(false)}
                  className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Menu Grid / List */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <Link
                  href="/profile"
                  onClick={() => setShowMoreSheet(false)}
                  className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 transition-all group"
                >
                  <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                    <User className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-semibold text-white/80 group-hover:text-white">Profile</span>
                </Link>

                <Link
                  href="/settings"
                  onClick={() => setShowMoreSheet(false)}
                  className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 transition-all group"
                >
                  <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                    <Settings className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-semibold text-white/80 group-hover:text-white">Settings</span>
                </Link>

                <Link
                  href="/plans"
                  onClick={() => setShowMoreSheet(false)}
                  className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 transition-all group"
                >
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                    <Gem className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-semibold text-white/80 group-hover:text-white">Plans</span>
                </Link>

                <Link
                  href="/vibers"
                  onClick={() => setShowMoreSheet(false)}
                  className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 transition-all group"
                >
                  <div className="w-8 h-8 rounded-xl bg-pink-500/10 text-pink-400 flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-semibold text-white/80 group-hover:text-white">Vibers Studio</span>
                </Link>
              </div>

              {/* Guidelines & Logout */}
              <div className="pt-2 border-t border-white/5 flex items-center gap-2">
                <Link
                  href="/guidelines"
                  onClick={() => setShowMoreSheet(false)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/[0.02] border border-white/5 text-white/50 text-xs font-medium"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Guidelines
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Logout
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
