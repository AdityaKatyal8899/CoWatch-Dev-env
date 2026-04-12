"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Play, Sparkles } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { Loader } from '../components/ui/Loader';
import { toast } from 'sonner';
import { GoogleLogin } from '@react-oauth/google';
import { PageTransition } from '../components/ui/PageTransition';
import { motion } from 'motion/react';

export default function Auth() {
  const router = useRouter();

  const { login } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleSuccess = async (credentialResponse: any) => {
    setLoading(true);
    try {
      if (!credentialResponse.credential) {
        throw new Error('No credential received');
      }
      await login(credentialResponse.credential);
      toast.success('Welcome to CoWatch!');
      router.push('/dashboard');
    } catch (error) {
      toast.error('Failed to sign in');

    } finally {
      setLoading(false);
    }
  };

  const handleError = () => {
    toast.error('Google Sign In failed');
  };

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
          {/* Logo and Branding */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center justify-center mb-6">
              <div className="w-20 h-20 rounded-2xl bg-[var(--primary)] flex items-center justify-center shadow-2xl">
                <Play className="w-10 h-10 text-[var(--bg)]" fill="currentColor" />
              </div>
            </div>
            
            <h1 className="text-5xl font-bold text-white mb-3">
              Co<span className="gradient-text">Watch</span>
            </h1>
            <p className="text-white/60 text-lg">
              Watch together. In sync.
            </p>
          </motion.div>

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

            {/* Real Google Sign In Button */}
            <div className="flex justify-center mb-8">
              <GoogleLogin
                onSuccess={handleSuccess}
                onError={handleError}
                useOneTap
                theme="filled_blue"
                shape="pill"
                text="continue_with"
              />
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
