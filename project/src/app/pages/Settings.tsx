"use client";

import { HardDrive, User, LogOut, Check, Palette, UserCircle, Save, Gift } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '../components/DashboardLayout';
import { useAuth } from '../lib/auth';
import { useTheme } from '../components/ThemeProvider';
import { api } from '../lib/api';
import { useState, useEffect } from 'react';
import type { UserStats } from '../lib/types';
import { toast } from 'sonner';
import { PageTransition } from '../components/ui/PageTransition';
import { motion } from 'motion/react';
import { formatBytes } from '../lib/utils';
import { VibersCustomColorStudio } from '../components/VibersCustomColorStudio';

const PRESETS = [
  { id: 'default-dark', name: 'Original Dark' },
  { id: 'neo-purple', name: 'Neo Purple' },
  { id: 'midnight-blue', name: 'Midnight Blue' },
  { id: 'cyber-green', name: 'Cyber Green' },
  { id: 'warm-minimal', name: 'Warm Minimal' },
];

export default function Settings() {
  const router = useRouter();
  const { user, logout, updateProfile } = useAuth();
  const { theme: activeTheme, setTheme } = useTheme();
  
  const [stats, setStats] = useState<UserStats | null>(null);
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [dob, setDob] = useState(user?.date_of_birth || '');
  const [pendingTheme, setPendingTheme] = useState(activeTheme);
  const [isUpdating, setIsUpdating] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);

  useEffect(() => {
    loadStats();
    if (user?.display_name) setDisplayName(user.display_name);
    if (user?.date_of_birth) setDob(user.date_of_birth);
    if (activeTheme) setPendingTheme(activeTheme);
  }, [user, activeTheme]);

  const loadStats = async () => {
    try {
      const data = await api.getUserStats();
      setStats(data);
    } catch (e) {

    }
  };

  const handleSaveSettings = async () => {
    setIsUpdating(true);
    try {
      await updateProfile({ 
        display_name: displayName,
        theme: pendingTheme,
        date_of_birth: dob || undefined
      });
      setTheme(pendingTheme);
      
      toast.success('Saved Theme Updates');
      
      setTimeout(() => {
        router.push('/dashboard');
      }, 1000);
      
    } catch (error: any) {
      toast.error(error.message || 'Update failed');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRedeemCoupon = async () => {
    if (!couponCode.trim()) {
      toast.error('Please enter a coupon code');
      return;
    }
    setIsRedeeming(true);
    try {
      const res = await api.redeemCoupon(couponCode.trim());
      toast.success(res.message || 'Coupon applied successfully!');
      setCouponCode('');
      
      // Reload stats and trigger a page refresh to sync authentication state
      loadStats();
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error: any) {
      toast.error(error.message || 'Failed to redeem coupon');
    } finally {
      setIsRedeeming(false);
    }
  };

  const handlePreviewTheme = (newTheme: string) => {
    setPendingTheme(newTheme);
    setTheme(newTheme);
  };

  const storagePercent = stats ? (stats.storageUsed / stats.storageLimit) * 100 : 0;
  const hasChanges = displayName !== user?.display_name || pendingTheme !== user?.theme;

  return (
    <DashboardLayout>
      <PageTransition>
        <div className="p-8 max-w-4xl mx-auto space-y-8">
          {(!user?.plan || user.plan === 'free') && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl bg-gradient-to-r from-[var(--primary)]/10 to-transparent border border-[var(--primary)]/20 flex flex-col sm:flex-row items-center justify-between gap-4"
            >
              <div>
                <p className="text-white font-semibold text-sm">You are currently on the Free plan</p>
                <p className="text-white/60 text-xs mt-0.5">Upgrade to Pro to unlock custom themes, voice chat, and 10GB+ storage.</p>
              </div>
              <button 
                onClick={() => router.push('/plans')}
                className="btn-primary py-2.5 px-5 text-xs font-bold shrink-0 rounded-lg"
              >
                Upgrade to Pro
              </button>
            </motion.div>
          )}
          <div className="flex items-center justify-between border-b border-white/5 pb-8 mb-4">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
              <p className="text-[var(--muted)]">Manage your account and app preferences</p>
            </div>
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleSaveSettings}
              disabled={isUpdating || !displayName}
              className={`btn-primary px-8 py-3 min-w-[140px] shadow-2xl transition-all flex items-center gap-2 ${
                hasChanges ? 'ring-2 ring-[var(--primary)]/20 shadow-[var(--primary)]/20' : 'opacity-50'
              }`}
            >
              {isUpdating ? (
                <>
                  <div className="w-4 h-4 border-2 border-[var(--bg)]/20 border-t-[var(--bg)] rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Settings
                </>
              )}
            </motion.button>
          </div>

          <div className="space-y-8">
            {/* Top Row: Profile (2 cols) & Account/Storage (1 col) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Profile Section */}
              <motion.div 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="lg:col-span-2 glass-card rounded-2xl p-6 sm:p-7 border border-white/5 space-y-6"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/20 flex items-center justify-center">
                    <UserCircle className="w-5 h-5 text-[var(--primary)]" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">Profile Details</h2>
                    <p className="text-[var(--muted)] text-xs">Update your public account information</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-widest text-[var(--muted)] font-semibold">Display Name</label>
                    <input 
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 outline-none focus:border-[var(--primary)] transition-all text-white text-sm"
                      placeholder="Enter display name"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-widest text-[var(--muted)] font-semibold">Date of Birth</label>
                    <input 
                      type="date"
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 outline-none focus:border-[var(--primary)] transition-all text-white text-sm [color-scheme:dark]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1">
                      <p className="text-[var(--muted)] text-xs uppercase tracking-widest font-semibold">Email</p>
                      <p className="text-white text-sm truncate font-medium">{user?.email}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[var(--muted)] text-xs uppercase tracking-widest font-semibold">OAuth Provider</p>
                      <p className="text-white text-sm capitalize font-medium">{user?.provider || 'Google'}</p>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Account, Storage & Actions Column */}
              <div className="space-y-6">
                {/* Storage Card */}
                <motion.div 
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  className="glass-card rounded-2xl p-6 border border-white/5 space-y-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/20 flex items-center justify-center">
                      <HardDrive className="w-5 h-5 text-[var(--primary)]" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-white">Storage Capacity</h2>
                      <p className="text-[var(--muted)] text-xs">
                        Based on {user?.plan ? (user.plan === 'pro_plus' ? 'Pro+' : user.plan === 'vibers' ? 'Vibers' : user.plan === 'pro' ? 'Pro' : 'Free') : 'Free'} plan
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className="h-full transition-all duration-1000"
                        style={{ width: `${Math.min(storagePercent, 100)}%`, background: 'var(--primary-gradient, var(--primary))' }}
                      />
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-[var(--muted)]">{formatBytes(stats?.storageUsed || 0)}</span>
                      <span className="text-white font-medium">{formatBytes(stats?.storageLimit || 0)} total</span>
                    </div>
                  </div>
                </motion.div>
                
                {/* Redeem Coupon Card */}
                <motion.div 
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="glass-card rounded-2xl p-6 border border-white/5 space-y-4 overflow-hidden"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/20 flex items-center justify-center shrink-0">
                      <Gift className="w-5 h-5 text-[var(--primary)]" />
                    </div>
                    <h2 className="text-base font-semibold text-white">Redeem Coupon</h2>
                  </div>

                  <div className="relative flex items-center w-full">
                    <input 
                      type="text"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      placeholder="ENTER CODE"
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-3.5 pr-20 py-2.5 outline-none focus:border-[var(--primary)] focus:bg-white/[0.07] transition-all text-white text-xs font-mono tracking-wider placeholder:font-sans placeholder:tracking-normal placeholder:text-white/20"
                    />
                    <button
                      type="button"
                      onClick={handleRedeemCoupon}
                      disabled={isRedeeming || !couponCode.trim()}
                      className={`absolute right-1.5 top-1.5 bottom-1.5 px-3.5 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center ${
                        couponCode.trim() && !isRedeeming
                          ? 'btn-primary shadow-md shadow-[var(--primary)]/20'
                          : 'bg-white/5 text-white/30 cursor-not-allowed border border-white/5'
                      }`}
                    >
                      {isRedeeming ? (
                        <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      ) : (
                        'Apply'
                      )}
                    </button>
                  </div>
                </motion.div>

                <motion.button
                  whileHover={{ scale: 1.02, backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
                  whileTap={{ scale: 0.98 }}
                  onClick={logout}
                  className="w-full p-3.5 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 font-bold text-xs transition-all flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out of Account
                </motion.button>
              </div>
            </div>

            {/* Bottom Row: Full Width Appearance & Vibers Custom Color Studio */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="glass-card rounded-2xl p-6 sm:p-8 border border-white/5 space-y-7"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-[var(--primary)]/20 flex items-center justify-center">
                    <Palette className="w-6 h-6 text-[var(--primary)]" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white tracking-tight">Theme & Appearance</h2>
                    <p className="text-[var(--muted)] text-xs mt-0.5">Customize your visual interface across the entire CoWatch platform in real-time</p>
                  </div>
                </div>
              </div>

              {/* Preset Themes for Paid Users */}
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-wider text-white/50 font-bold">Standard Theme Presets</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {PRESETS.map((p) => {
                    const isLocked = p.id !== 'default-dark' && (!user?.plan || user.plan === 'free');
                    return (
                      <motion.button
                        key={p.id}
                        whileHover={isLocked ? {} : { scale: 1.02 }}
                        whileTap={isLocked ? {} : { scale: 0.98 }}
                        onClick={() => {
                          if (isLocked) {
                            toast.error('This theme is only available on paid plans. Please upgrade!');
                            return;
                          }
                          handlePreviewTheme(p.id);
                        }}
                        className={`p-3.5 rounded-xl border text-left transition-all relative group ${
                          isLocked 
                            ? 'border-white/5 bg-white/[0.01] opacity-40 cursor-not-allowed'
                            : pendingTheme === p.id 
                              ? 'border-[var(--primary)] bg-[var(--primary)]/10 shadow-md shadow-[var(--primary)]/10'
                              : 'border-white/5 hover:border-white/10 bg-white/[0.02]'
                        }`}
                      >
                        <p className={`text-xs font-semibold ${pendingTheme === p.id ? 'text-[var(--primary)]' : 'text-white/70'}`}>{p.name}</p>
                        {isLocked && <span className="absolute top-2.5 right-2.5 text-white/40 text-[10px]">🔒</span>}
                        {!isLocked && pendingTheme === p.id && <Check className="w-3.5 h-3.5 absolute top-2.5 right-2.5 text-[var(--primary)]" />}
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Vibers Exclusive Custom Color & Gradient Studio */}
              <div className="pt-6 border-t border-white/5 space-y-4">
                {user?.plan !== 'vibers' ? (
                  <div className="p-6 rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="text-base font-bold text-white">Unlock Bespoke Custom Colors & Gradients</p>
                        <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full font-bold">
                          VIBERS ONLY
                        </span>
                      </div>
                      <p className="text-xs text-white/60 max-w-xl">
                        Design your own bespoke dual-tone gradient or vivid color palette with complete 360° angle controls, dark base tones, and live reactive platform illumination.
                      </p>
                    </div>
                    <button
                      onClick={() => router.push('/plans')}
                      className="btn-primary bg-gradient-to-r from-purple-500 to-indigo-600 text-white py-3 px-6 text-xs font-bold shrink-0 rounded-xl shadow-lg shadow-purple-500/25"
                    >
                      Upgrade to Vibers
                    </button>
                  </div>
                ) : (
                  <VibersCustomColorStudio
                    currentTheme={pendingTheme}
                    onSelectTheme={(themeString) => {
                      handlePreviewTheme(themeString);
                    }}
                  />
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </PageTransition>
    </DashboardLayout>
  );
}
