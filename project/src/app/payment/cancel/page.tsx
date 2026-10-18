"use client";

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, RefreshCw, Sparkles, Copy, Check } from 'lucide-react';
import { DashboardLayout } from '../../components/DashboardLayout';
import { PageTransition } from '../../components/ui/PageTransition';
import { motion } from 'motion/react';
import { toast } from 'sonner';

function PaymentCancelContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id') || searchParams.get('order_id') || '';
  const [copied, setCopied] = useState(false);

  const copySessionId = () => {
    if (!sessionId) return;
    navigator.clipboard.writeText(sessionId);
    setCopied(true);
    toast.success('Reference copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center max-w-xl mx-auto space-y-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-white/50 shadow-xl"
      >
        <RefreshCw className="w-7 h-7 text-white/60" />
      </motion.div>

      <div className="space-y-3">
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Checkout Was Cancelled</h1>
        <p className="text-sm text-white/50 leading-relaxed max-w-md mx-auto">
          No charges were made to your account. You can review our plans or return anytime to upgrade your watch parties.
        </p>
      </div>

      {sessionId && (
        <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 text-xs text-white/40 flex items-center justify-between gap-3 w-full max-w-md">
          <span className="truncate">Reference: <span className="font-mono text-white/60">{sessionId}</span></span>
          <button
            onClick={copySessionId}
            className="p-1 rounded bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all shrink-0"
            title="Copy ID"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-center gap-3.5 w-full max-w-sm">
        <button
          onClick={() => router.push('/plans')}
          className="w-full py-3.5 px-5 rounded-xl font-bold text-xs uppercase tracking-wider text-white btn-primary bg-gradient-to-r from-purple-500 to-indigo-600 shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2 hover:scale-[1.02] transition-all"
        >
          <Sparkles className="w-4 h-4" />
          <span>Explore Plans</span>
        </button>
        <button
          onClick={() => router.push('/dashboard')}
          className="w-full py-3.5 px-5 rounded-xl font-semibold text-xs text-white/60 hover:text-white bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 transition-all flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </button>
      </div>
    </div>
  );
}

export default function PaymentCancelPage() {
  return (
    <DashboardLayout>
      <PageTransition>
        <Suspense fallback={
          <div className="min-h-[60vh] flex items-center justify-center">
            <RefreshCw className="w-8 h-8 text-white/40 animate-spin" />
          </div>
        }>
          <PaymentCancelContent />
        </Suspense>
      </PageTransition>
    </DashboardLayout>
  );
}

