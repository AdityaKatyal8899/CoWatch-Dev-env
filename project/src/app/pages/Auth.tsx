"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Play, Sparkles } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { Loader } from '../components/ui/Loader';
import { toast } from 'sonner';
import { useGoogleLogin } from '@react-oauth/google';
import { PageTransition } from '../components/ui/PageTransition';
import { motion } from 'motion/react';

export default function Auth() {
  const router = useRouter();

  const { login } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      try {
        if (!tokenResponse.access_token) {
          throw new Error('No access token received');
        }
        await login("", tokenResponse.access_token);
        toast.success('Welcome to CoWatch!');
        router.push('/dashboard');
      } catch (error) {
        toast.error('Failed to sign in');
      } finally {
        setLoading(false);
      }
    },
    onError: () => {
      toast.error('Google Sign In failed');
    },
    scope: 'openid email profile https://www.googleapis.com/auth/user.birthday.read',
  });

  return (
    <PageTransition>
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-6 relative overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 -left-48 w-96 h-96 bg-[var(--primary)]/20 rounded-full blur-3xl animated-gradient" />
          <div className="absolute bottom-1/4 -right-48 w-96 h-96 bg-[var(--primary)]/20 rounded-full blur-3xl animated-gradient" style={{ animationDelay: '-5s' }} />
        </div>

        {/* Content */}
        <div className="relative z-10 w-full max-w-md">
          <div className="flex flex-col items-center mb-8">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-16 h-16 rounded-2xl bg-[var(--primary)] flex items-center justify-center mb-4 shadow-xl shadow-[var(--primary)]/20"
            >
              <Play className="w-8 h-8 text-[var(--bg)] fill-[var(--bg)] translate-x-0.5" />
            </motion.div>
            <motion.h1 
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="text-4xl font-black text-white tracking-wider flex items-center gap-1.5"
            >
              CO<span className="text-[var(--primary)]">WATCH</span>
            </motion.h1>
          </div>

          {/* Auth Card */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-card rounded-2xl p-8 shadow-2xl"
          >
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">Welcome back</h2>
              <p className="text-white/60">Sign in to continue to your dashboard</p>
            </div>

            {/* Custom Google Sign In Button */}
            <div className="flex justify-center mb-8 w-full">
              <motion.button
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleGoogleLogin()}
                className="w-full py-3.5 px-6 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all flex items-center justify-center gap-3 font-medium text-white shadow-lg"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M12 5.04c1.67 0 3.2.58 4.38 1.69l3.27-3.27C17.67 1.48 14.99 1 12 1 7.37 1 3.42 3.66 1.44 7.56l3.89 3.02c.92-2.77 3.51-4.78 6.67-4.78z"
                  />
                  <path
                    fill="#4285F4"
                    d="M23.49 12.27c0-.81-.07-1.59-.2-2.34H12v4.43h6.44c-.28 1.47-1.11 2.71-2.36 3.55l3.82 2.96c2.23-2.06 3.59-5.09 3.59-8.6z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.33 14.58a7.8 7.8 0 0 1 0-5.16L1.44 6.4a11.98 11.98 0 0 0 0 11.2l3.89-3.02z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c3.24 0 5.97-1.07 7.96-2.92l-3.82-2.96c-1.06.71-2.42 1.13-4.14 1.13-3.16 0-5.75-2.01-6.67-4.78L1.44 16.5A11.97 11.97 0 0 0 12 23z"
                  />
                </svg>
                Continue with Google
              </motion.button>
            </div>

            {/* Fullscreen Loading Overlay */}
            {loading && (
              <Loader fullscreen label="Verifying account..." size="lg" />
            )}

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-[#1a1a1a] text-white/50">
                  Secure authentication
                </span>
              </div>
            </div>


            {/* Features */}
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm text-white/70">
                <div className="w-5 h-5 rounded-full bg-[var(--primary)]/20 flex items-center justify-center">
                  <Sparkles className="w-3 h-3 text-[var(--primary)]" />
                </div>
                <span>Synchronized video streaming</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-white/70">
                <div className="w-5 h-5 rounded-full bg-[var(--primary)]/20 flex items-center justify-center">
                  <Sparkles className="w-3 h-3 text-[var(--primary)]" />
                </div>
                <span>Real-time chat with participants</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-white/70">
                <div className="w-5 h-5 rounded-full bg-[var(--primary)]/20 flex items-center justify-center">
                  <Sparkles className="w-3 h-3 text-[var(--primary)]" />
                </div>
                <span>5GB free storage for your videos</span>
              </div>
            </div>
          </motion.div>

          {/* Footer */}
          <p className="text-center text-white/40 text-sm mt-6">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </PageTransition>
  );
}
