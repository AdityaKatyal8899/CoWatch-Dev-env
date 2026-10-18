"use client";

import { useRouter } from 'next/navigation';
import { ArrowLeft, RefreshCw, Sparkles, HelpCircle } from 'lucide-react';
import { DashboardLayout } from '../../components/DashboardLayout';
import { PageTransition } from '../../components/ui/PageTransition';
import { motion } from 'motion/react';

export default function PaymentCancelPage() {
  const router = useRouter();

  return (
    <DashboardLayout>
      <PageTransition>
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
      </PageTransition>
    </DashboardLayout>
  );
}
