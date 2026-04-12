"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { Camera, Save } from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { useAuth } from '../lib/auth';
import { toast } from 'sonner';
import { PageTransition } from '../components/ui/PageTransition';
import { motion } from 'motion/react';

export default function Profile() {
  const router = useRouter();
  const { user, updateProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    display_name: user?.display_name || user?.name || '',
    email: user?.email || '',
  });
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        display_name: user.display_name || user.name || '',
        email: user.email || '',
      });
    }
  }, [user]);

  const handleSave = async () => {
    setIsUpdating(true);
    try {
      await updateProfile({
        display_name: formData.display_name,
      });
      setEditing(false);
      toast.success('Profile updated successfully!');
      setTimeout(() => {
        router.push('/dashboard');
      }, 1000);
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <DashboardLayout>
      <PageTransition>
        <div className="p-4 md:p-8 max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Profile</h1>
            <p className="text-[var(--muted)]">Manage your account information</p>
          </div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card rounded-xl p-5 md:p-8 border border-white/5"
          >
            {/* Avatar Section */}
            <div className="flex flex-col md:flex-row items-center md:items-start text-center md:text-left gap-6 mb-8 pb-8 border-b border-white/10">
              <div className="relative group shrink-0">
                <motion.div 
                  whileHover={{ scale: 1.05 }}
                  className="w-24 h-24 rounded-full bg-[var(--primary)] flex items-center justify-center overflow-hidden shadow-xl shadow-[var(--primary)]/10"
                >
                  {user?.profile_picture ? (
                    <img src={user.profile_picture} alt={user.display_name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-3xl font-bold text-[var(--bg)]">{(user?.display_name || user?.name || '?').charAt(0).toUpperCase()}</span>
                  )}
                </motion.div>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">{user?.display_name || user?.name}</h2>
                <p className="text-[var(--muted)]">{user?.email}</p>
              </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[var(--muted)] text-sm font-medium mb-2 uppercase tracking-widest text-[10px]">Display Name</label>
                  <motion.input
                    whileFocus={{ scale: 1.01, borderColor: 'var(--primary)' }}
                    type="text"
                    value={formData.display_name}
                    onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                    disabled={!editing}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 min-h-[44px] text-white disabled:opacity-60 focus:outline-none focus:border-[var(--primary)] transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[var(--muted)] text-sm font-medium mb-2 uppercase tracking-widest text-[10px]">Email Address</label>
                  <input
                    type="email"
                    value={formData.email}
                    disabled
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 min-h-[44px] text-white opacity-40 cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                {editing ? (
                  <>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleSave}
                      disabled={isUpdating}
                      className="btn-primary min-h-[44px] w-full sm:w-auto min-w-[160px]"
                    >
                      {isUpdating ? (
                        <>
                          <div className="w-4 h-4 border-2 border-[var(--bg)]/20 border-t-[var(--bg)] rounded-full animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-5 h-5" />
                          Save Changes
                        </>
                      )}
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setEditing(false)}
                      className="px-6 py-3 min-h-[44px] w-full sm:w-auto bg-white/5 border border-white/10 rounded-lg text-white font-medium hover:bg-white/10 transition-all"
                    >
                      Cancel
                    </motion.button>
                  </>
                ) : (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setEditing(true)}
                    className="btn-primary min-h-[44px] px-8 w-full sm:w-auto"
                  >
                    Edit Profile
                  </motion.button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </PageTransition>
    </DashboardLayout>
  );
}
