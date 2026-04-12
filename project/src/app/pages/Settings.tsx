"use client";

import { HardDrive, User, LogOut, Check, Palette, UserCircle, Save } from 'lucide-react';
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
  const [pendingTheme, setPendingTheme] = useState(activeTheme);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    loadStats();
    if (user?.display_name) setDisplayName(user.display_name);
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
        theme: pendingTheme 
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-6">
              {/* Profile Section */}
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="glass-card rounded-xl p-6 border border-white/5"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-[var(--primary)]/20 flex items-center justify-center">
                    <UserCircle className="w-5 h-5 text-[var(--primary)]" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">Profile</h2>
                    <p className="text-[var(--muted)] text-sm">Update your public information</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-widest text-[var(--muted)] font-semibold">Display Name</label>
                    <input 
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 outline-none focus:border-[var(--primary)] transition-all text-white"
                      placeholder="Enter display name"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1">
                      <p className="text-[var(--muted)] text-xs uppercase tracking-widest font-semibold">Email</p>
                      <p className="text-white text-sm truncate">{user?.email}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[var(--muted)] text-xs uppercase tracking-widest font-semibold">OAuth Provider</p>
                      <p className="text-white text-sm capitalize">{user?.provider || 'Google'}</p>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Appearance Section */}
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="glass-card rounded-xl p-6 border border-white/5"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-[var(--primary)]/20 flex items-center justify-center">
                    <Palette className="w-5 h-5 text-[var(--primary)]" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">Appearance</h2>
                    <p className="text-[var(--muted)] text-sm">Choose your aesthetic (Previews live)</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {PRESETS.map((p) => (
                    <motion.button
                      key={p.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handlePreviewTheme(p.id)}
                      className={`p-3 rounded-lg border text-left transition-all relative group ${
                        pendingTheme === p.id 
                          ? 'border-[var(--primary)] bg-[var(--primary)]/5'
                          : 'border-white/5 hover:border-white/10 bg-white/[0.02]'
                      }`}
                    >
                      <p className={`text-xs font-semibold ${pendingTheme === p.id ? 'text-[var(--primary)]' : 'text-white/60'}`}>{p.name}</p>
                      {pendingTheme === p.id && <Check className="w-3 h-3 absolute top-2 right-2 text-[var(--primary)]" />}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            </div>

            <div className="space-y-6">
              {/* Storage Card */}
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="glass-card rounded-xl p-6 border border-white/5"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-[var(--primary)]/20 flex items-center justify-center">
                    <HardDrive className="w-5 h-5 text-[var(--primary)]" />
                  </div>
                  <h2 className="text-lg font-semibold text-white">Storage</h2>
                </div>

                <div className="space-y-4">
                  <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-[var(--primary)] transition-all duration-1000"
                      style={{ width: `${Math.min(storagePercent, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[var(--muted)]">{formatBytes(stats?.storageUsed || 0)} GB</span>
                    <span className="text-white font-medium">{formatBytes(stats?.storageLimit || 0)} GB total</span>
                  </div>
                </div>
              </motion.div>

              <motion.button
                whileHover={{ scale: 1.02, backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
                whileTap={{ scale: 0.98 }}
                onClick={logout}
                className="w-full p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-red-500 font-bold transition-all flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </motion.button>
            </div>
          </div>
        </div>
      </PageTransition>
    </DashboardLayout>
  );
}
