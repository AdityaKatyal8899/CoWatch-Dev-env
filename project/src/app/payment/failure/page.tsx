"use client";

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  XCircle, 
  ArrowLeft, 
  RefreshCw, 
  AlertTriangle, 
  Copy, 
  Check, 
  ShieldAlert,
  Headphones,
  Sparkles 
} from 'lucide-react';
import { DashboardLayout } from '../../components/DashboardLayout';
import { PageTransition } from '../../components/ui/PageTransition';
import { motion } from 'motion/react';
import { toast } from 'sonner';

function PaymentFailureContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id') || searchParams.get('order_id') || '';
  const reason = searchParams.get('reason') || '';
  const [copied, setCopied] = useState(false);

  const copySessionId = () => {
    if (!sessionId) return;
    navigator.clipboard.writeText(sessionId);
    setCopied(true);
    toast.success('Reference ID copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative max-w-xl mx-auto py-12 px-4 sm:px-6 space-y-8 text-center">
      {/* Background ambient red glow */}
      <div 
        className="absolute top-10 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full blur-3xl pointer-events-none opacity-40"
        style={{ background: 'radial-gradient(closest-side, rgba(239, 68, 68, 0.35), transparent 75%)' }}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 space-y-6"
      >
        {/* Failure Icon */}
        <div className="inline-flex relative mb-2">
          <div className="w-20 h-20 rounded-3xl bg-red-500/10 border border-red-500/20 backdrop-blur-xl flex items-center justify-center shadow-2xl shadow-red-500/20">
            <XCircle className="w-10 h-10 text-red-400" />
          </div>
          <div className="absolute -top-1.5 -right-1.5 bg-red-500 text-white p-1.5 rounded-full shadow-lg border-2 border-[#0B0B0F]">
            <AlertTriangle className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Status titles */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/25 text-red-400 text-xs font-bold uppercase tracking-wider">
            <ShieldAlert className="w-3.5 h-3.5" /> Payment Unsuccessful
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Transaction Not Completed
          </h1>
          <p className="text-sm text-white/60 max-w-md mx-auto leading-relaxed">
            {reason ? decodeURIComponent(reason) : "Your transaction was cancelled or could not be verified by the payment gateway. No money was deducted from your account."}
          </p>
        </div>

        {/* Informational card */}
        <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-xl text-left space-y-3.5 shadow-xl">
          <h4 className="text-xs font-bold text-white/80 uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> What usually causes this?
          </h4>
          <ul className="text-xs text-white/50 space-y-2 pl-4 list-disc leading-relaxed">
            <li>Payment was cancelled or dismissed in the UPI app/gateway modal.</li>
            <li>Bank server timeout or UPI mandate approval window expired.</li>
            <li>Card authorization declined by your issuing bank.</li>
          </ul>

          {sessionId && (
            <div className="pt-3 border-t border-white/5 flex items-center justify-between gap-2">
              <div className="text-[11px] text-white/40 truncate">
                <span className="font-semibold text-white/60">Reference: </span>
                <span className="font-mono text-white/70">{sessionId}</span>
              </div>
              <button
                onClick={copySessionId}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white transition-all text-xs flex items-center gap-1 shrink-0"
                title="Copy reference ID"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <button
            onClick={() => router.push('/plans')}
            className="w-full py-3.5 px-5 rounded-xl font-bold text-xs uppercase tracking-wider text-white btn-primary bg-gradient-to-r from-purple-500 via-indigo-500 to-purple-600 shadow-lg shadow-purple-500/25 flex items-center justify-center gap-2 hover:scale-[1.02] transition-all"
          >
            <Sparkles className="w-4 h-4" />
            <span>Try Again</span>
          </button>
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full py-3.5 px-5 rounded-xl font-semibold text-xs text-white/60 hover:text-white bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 transition-all flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function PaymentFailurePage() {
  return (
    <DashboardLayout>
      <PageTransition>
        <Suspense fallback={
          <div className="min-h-[60vh] flex items-center justify-center">
            <RefreshCw className="w-8 h-8 text-white/40 animate-spin" />
          </div>
        }>
          <PaymentFailureContent />
        </Suspense>
      </PageTransition>
    </DashboardLayout>
  );
}
