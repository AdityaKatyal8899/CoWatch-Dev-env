"use client";

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
  Sparkles, 
  Crown, 
  Rocket, 
  Zap, 
  CheckCircle2, 
  ShieldCheck, 
  ArrowRight, 
  Video, 
  Mic, 
  Palette, 
  Users, 
  HardDrive,
  Receipt,
  Download,
  Copy,
  Check
} from 'lucide-react';
import { DashboardLayout } from '../../components/DashboardLayout';
import { PageTransition } from '../../components/ui/PageTransition';
import { Badge } from '../../components/ui/badge';
import { motion } from 'motion/react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';

interface PaymentStatusData {
  session_id: string;
  status: string;
  payment_status: string;
  amount_total: number;
  currency: string;
  customer_email?: string;
  payment_intent_id?: string;
  plan_id: string;
  plan_name: string;
  billing_cycle: string;
  transaction_id?: number;
  user_plan: string;
  plan_expires_at?: string;
}

const PLAN_ICONS: Record<string, typeof Crown> = {
  vibers: Crown,
  pro_plus: Zap,
  pro: Rocket,
  free: Users,
};

const PLAN_THEMES: Record<string, {
  color: string;
  badgeBg: string;
  badgeText: string;
  glow: string;
  accentGradient: string;
}> = {
  vibers: {
    color: '#8B5CF6',
    badgeBg: 'bg-purple-500/15',
    badgeText: 'text-purple-300 border-purple-500/30',
    glow: 'radial-gradient(closest-side, rgba(139, 92, 246, 0.3), transparent 75%)',
    accentGradient: 'from-purple-500 via-indigo-500 to-purple-600',
  },
  pro_plus: {
    color: '#EC4899',
    badgeBg: 'bg-pink-500/15',
    badgeText: 'text-pink-300 border-pink-500/30',
    glow: 'radial-gradient(closest-side, rgba(236, 72, 153, 0.3), transparent 75%)',
    accentGradient: 'from-pink-500 via-purple-500 to-pink-600',
  },
  pro: {
    color: '#3B82F6',
    badgeBg: 'bg-blue-500/15',
    badgeText: 'text-blue-300 border-blue-500/30',
    glow: 'radial-gradient(closest-side, rgba(59, 130, 246, 0.3), transparent 75%)',
    accentGradient: 'from-blue-500 via-cyan-500 to-blue-600',
  },
};

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { refreshUser } = useAuth();
  const sessionId = searchParams.get('session_id');

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PaymentStatusData | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    async function verify() {
      try {
        const res = await api.getPaymentSessionStatus(sessionId!);
        if (!isMounted) return;

        const isSuccess = res.payment_status === 'paid' || res.status === 'complete';

        if (isSuccess) {
          setData(res);
          if (refreshUser) {
            await refreshUser();
          }
        } else if (res.payment_status === 'failed' || res.status === 'failed') {
          router.replace(`/payment/failure?session_id=${encodeURIComponent(sessionId || '')}&reason=${encodeURIComponent('Payment authorization failed or was rejected.')}`);
          return;
        } else {
          // Cancelled, expired, or unpaid
          router.replace(`/payment/cancel?session_id=${encodeURIComponent(sessionId || '')}`);
          return;
        }
      } catch (err: any) {
        console.error('Session verification error:', err);
        toast.error(err.message || 'Failed to verify payment session.');
        router.replace(`/payment/failure?session_id=${encodeURIComponent(sessionId || '')}&reason=${encodeURIComponent(err.message || 'Verification failed')}`);
        return;
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    verify();
    return () => {
      isMounted = false;
    };
  }, [sessionId, refreshUser, router]);

  const planKey = (data?.plan_id || 'pro').toLowerCase();
  const theme = PLAN_THEMES[planKey] || PLAN_THEMES.pro;
  const PlanIcon = PLAN_ICONS[planKey] || Rocket;

  const copyReceipt = () => {
    const textToCopy = `CoWatch Receipt\nPlan: ${data?.plan_name || 'Pro'} (${data?.billing_cycle})\nTransaction ID: ${data?.transaction_id || 'N/A'}\nSession ID: ${data?.session_id || sessionId}\nAmount: $${data?.amount_total || '0'} ${data?.currency || 'USD'}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    toast.success('Receipt details copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading || !data || (data.payment_status !== 'paid' && data.status !== 'complete')) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-6 text-center">
        <div className="relative">
          <div className="w-20 h-20 rounded-full border-2 border-purple-500/20 border-t-purple-500 animate-spin" />
          <Sparkles className="w-7 h-7 text-purple-400 absolute inset-0 m-auto animate-pulse" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-white tracking-tight">Confirming Your Subscription...</h2>
          <p className="text-sm text-white/50 max-w-sm">
            Verifying secure payment session and configuring your new streaming tier.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative max-w-5xl mx-auto py-8 md:py-12 px-4 sm:px-6 space-y-10">
      {/* Background celebration glow */}
      <div
        className="absolute top-10 left-1/2 -translate-x-1/2 w-[600px] h-[350px] rounded-full blur-3xl pointer-events-none opacity-60"
        style={{ background: theme.glow }}
      />

      {/* Hero Welcome Header */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="text-center space-y-4 relative z-10"
      >
        {/* Animated Celebration Icon */}
        <div className="inline-flex relative mb-2">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-white/10 to-white/5 border border-white/15 backdrop-blur-xl flex items-center justify-center shadow-2xl shadow-purple-500/20">
            <PlanIcon className="w-10 h-10 text-white" />
          </div>
          <div className="absolute -top-2 -right-2 bg-green-500 text-black p-1.5 rounded-full shadow-lg border-2 border-[#0B0B0F]">
            <CheckCircle2 className="w-4 h-4 text-black" strokeWidth={3} />
          </div>
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/25 text-green-400 text-xs font-bold uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5" /> Payment Successful
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            Welcome to <span className={cn('bg-gradient-to-r bg-clip-text text-transparent', theme.accentGradient)}>{data?.plan_name || 'Your New Plan'}</span>!
          </h1>
          <p className="text-sm sm:text-base text-white/60 max-w-xl mx-auto leading-relaxed">
            Your CoWatch account is now upgraded. You have unlocked high-bitrate streaming, expanded participant limits, and full creator privileges.
          </p>
        </div>
      </motion.div>

      {/* Main Grid: Features Unlocked + Receipt Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start relative z-10">
        
        {/* Left: Unlocked Capabilities Showcase */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="lg:col-span-7 space-y-5"
        >
          <div className="glass-card rounded-2xl p-6 sm:p-8 border border-white/10 bg-[#12121A]/80 backdrop-blur-2xl shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[var(--primary)]/15 border border-[var(--primary)]/30 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-[var(--primary)]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Unlocked Superpowers</h3>
                  <p className="text-xs text-white/40">Ready to use across all your rooms</p>
                </div>
              </div>
              <Badge className={cn('text-[11px] font-bold border', theme.badgeBg, theme.badgeText)}>
                {data?.plan_name || 'Active Plan'} Tier
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-2 hover:border-white/15 transition-all">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <Video className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-bold text-white">Ultra-HD Video Playback</h4>
                <p className="text-[11px] text-white/50 leading-relaxed">
                  {planKey === 'vibers' ? 'Ultra-crisp 2K (1440p Quad-HD) transcode pipeline' : 'High definition 1080p video sync streaming'}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-2 hover:border-white/15 transition-all">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                  <HardDrive className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-bold text-white">Expanded Video Cloud</h4>
                <p className="text-[11px] text-white/50 leading-relaxed">
                  {planKey === 'vibers' ? '50 GB dedicated high-speed cloud storage' : planKey === 'pro_plus' ? '20 GB high-speed cloud storage' : '10 GB high-speed cloud storage'}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-2 hover:border-white/15 transition-all">
                <div className="w-8 h-8 rounded-lg bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400">
                  <Mic className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-bold text-white">LiveKit Voice Chat</h4>
                <p className="text-[11px] text-white/50 leading-relaxed">
                  Low-latency spatial voice channels in all rooms hosted by you
                </p>
              </div>

              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-2 hover:border-white/15 transition-all">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Users className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-bold text-white">Massive Party Capacity</h4>
                <p className="text-[11px] text-white/50 leading-relaxed">
                  {planKey === 'vibers' ? 'Host strictly up to 51 concurrent guests (1 host + 50 viewers)' : planKey === 'pro_plus' ? 'Host up to 25 concurrent guests' : 'Host up to 10 concurrent guests'}
                </p>
              </div>

              {planKey === 'vibers' && (
                <div className="sm:col-span-2 p-4 rounded-xl bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-transparent border border-purple-500/20 space-y-2">
                  <div className="flex items-center gap-2 text-purple-300">
                    <Palette className="w-4 h-4" />
                    <span className="text-xs font-bold">Exclusive Custom Gradient & Theme Studio</span>
                  </div>
                  <p className="text-[11px] text-white/60">
                    Design signature ambient colors, custom CSS gradient glows, and branded room links.
                  </p>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Right: Payment Receipt & Next Steps */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.25, duration: 0.5 }}
          className="lg:col-span-5 space-y-6"
        >
          {/* Receipt Card */}
          <div className="glass-card rounded-2xl p-6 sm:p-7 border border-white/10 bg-[#12121A]/80 backdrop-blur-2xl shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div className="flex items-center gap-2 text-white">
                <Receipt className="w-4 h-4 text-white/60" />
                <span className="text-sm font-bold">Transaction Receipt</span>
              </div>
              <button
                onClick={copyReceipt}
                className="text-xs text-white/40 hover:text-white flex items-center gap-1.5 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="flex justify-between items-center text-white/60">
                <span>Plan Subscribed</span>
                <span className="font-semibold text-white">{data?.plan_name || 'Pro'}</span>
              </div>
              <div className="flex justify-between items-center text-white/60">
                <span>Billing Interval</span>
                <span className="font-semibold text-white capitalize">{data?.billing_cycle || 'Monthly'}</span>
              </div>
              <div className="flex justify-between items-center text-white/60">
                <span>Amount Paid</span>
                <span className="font-bold text-white text-sm">
                  {(() => {
                    const curr = (data?.currency || 'USD').toUpperCase();
                    const symbols: Record<string, string> = { INR: '₹', USD: '$', GBP: '£', EUR: '€', JPY: '¥', KRW: '₩' };
                    const sym = symbols[curr] || '$';
                    const isZero = curr === 'JPY' || curr === 'KRW';
                    if (!data?.amount_total) return `${sym}0.00 ${curr}`;
                    return isZero ? `${sym}${Math.round(data.amount_total).toLocaleString()} ${curr}` : `${sym}${data.amount_total.toFixed(2)} ${curr}`;
                  })()}
                </span>
              </div>
              <div className="flex justify-between items-center text-white/60">
                <span>Status</span>
                <span className="font-semibold text-green-400 inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" /> Verified & Active
                </span>
              </div>
              {data?.transaction_id && (
                <div className="flex justify-between items-center text-white/60">
                  <span>Transaction ID</span>
                  <span className="font-mono text-[11px] text-white/80">#{data.transaction_id}</span>
                </div>
              )}
              {data?.plan_expires_at && (
                <div className="flex justify-between items-center text-white/60 border-t border-white/5 pt-3">
                  <span>Valid Until</span>
                  <span className="font-medium text-white/90">
                    {new Date(data.plan_expires_at).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Action Navigation */}
          <div className="space-y-3">
            <button
              onClick={() => router.push('/dashboard')}
              className="w-full py-4 px-6 rounded-xl font-bold text-xs uppercase tracking-wider text-white btn-primary bg-gradient-to-r from-purple-500 to-indigo-600 shadow-xl shadow-purple-500/25 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <span>Jump Into Watch Parties</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => router.push('/settings')}
              className="w-full py-3.5 px-6 rounded-xl font-semibold text-xs text-white/70 hover:text-white bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 transition-all flex items-center justify-center gap-2"
            >
              <span>Customize Themes & Profile</span>
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <DashboardLayout>
      <PageTransition>
        <Suspense fallback={
          <div className="min-h-[60vh] flex items-center justify-center text-white/50 text-sm">
            Loading subscription confirmation...
          </div>
        }>
          <PaymentSuccessContent />
        </Suspense>
      </PageTransition>
    </DashboardLayout>
  );
}
