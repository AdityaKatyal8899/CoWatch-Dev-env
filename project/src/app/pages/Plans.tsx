"use client";

import { useState, useEffect, useRef } from 'react';
import { Check, X, Sparkles, Users, Rocket, Zap, Crown, ArrowRight, HelpCircle } from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { useAuth } from '../lib/auth';
import { PageTransition } from '../components/ui/PageTransition';
import { Badge } from '../components/ui/badge';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { useRouter } from 'next/navigation';
import { api } from '../lib/api';

const loadRazorpayScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && (window as any).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

type BillingCycle = 'monthly' | 'annual';

type PlanId = 'free' | 'pro' | 'pro_plus' | 'vibers';

interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  monthly: number;
  annual: number; // billed once per year
  annualEffectiveMonthly: number;
  annualSavingsPercent: number;
  flagship?: boolean;
  icon: typeof Users;
  features: { text: string; included: boolean }[];
}

const PLAN_RANKS: Record<PlanId, number> = {
  free: 0,
  pro: 1,
  pro_plus: 2,
  vibers: 3,
};

const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    tagline: 'Casual movie nights',
    monthly: 0,
    annual: 0,
    annualEffectiveMonthly: 0,
    annualSavingsPercent: 0,
    icon: Users,
    features: [
      { text: '2 GB storage', included: true },
      { text: 'Up to 720p video', included: true },
      { text: '3 video uploads included', included: true },
      { text: 'Rooms up to 6 people', included: true },
      { text: '20 YouTube rooms / month', included: true },
      { text: 'Collections', included: false },
      { text: 'Voice chat', included: false },
      { text: 'Theme customization', included: false },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'The dedicated host',
    monthly: 2.99,
    annual: 29.99,
    annualEffectiveMonthly: 2.50,
    annualSavingsPercent: 16,
    icon: Rocket,
    features: [
      { text: '10 GB storage', included: true },
      { text: 'Up to 1080p video', included: true },
      { text: '5 video uploads / month', included: true },
      { text: '10 processing hours / month', included: true },
      { text: 'Rooms up to 16 people', included: true },
      { text: 'Unlimited YouTube rooms', included: true },
      { text: 'Collections', included: true },
      { text: 'Voice chat', included: true },
      { text: 'Theme customization', included: true },
      { text: 'Priority transcoding', included: true },
    ],
  },
  {
    id: 'pro_plus',
    name: 'Pro+',
    tagline: 'Serious watch parties',
    monthly: 6.99,
    annual: 69.99,
    annualEffectiveMonthly: 5.83,
    annualSavingsPercent: 17,
    icon: Zap,
    features: [
      { text: '20 GB storage', included: true },
      { text: 'Up to 1080p video', included: true },
      { text: 'Up to 100 video uploads / month', included: true },
      { text: '50 processing hours / month', included: true },
      { text: 'Rooms up to 31 people', included: true },
      { text: 'Unlimited YouTube rooms', included: true },
      { text: 'Everything in Pro', included: true },
      { text: 'Extra voice chat seats', included: true },
      { text: 'Scheduled rooms', included: true },
    ],
  },
  {
    id: 'vibers',
    name: 'Vibers',
    tagline: 'The full experience',
    monthly: 9.99,
    annual: 99.99,
    annualEffectiveMonthly: 8.33,
    annualSavingsPercent: 17,
    flagship: true,
    icon: Crown,
    features: [
      { text: '50 GB storage', included: true },
      { text: 'Up to 4K video', included: true },
      { text: 'Up to 200 video uploads / month', included: true },
      { text: '50 processing hours / month', included: true },
      { text: 'Custom color & gradient mode studio', included: true },
      { text: 'Large rooms (high capacity)', included: true },
      { text: 'Unlimited YouTube rooms', included: true },
      { text: 'Everything in Pro+', included: true },
      { text: 'Custom branding & moderation', included: true },
      { text: 'Analytics', included: true },
      { text: 'API access', included: true },
    ],
  },
];

const PLAN_THEMES = {
  free: {
    glow: 'rgba(255, 255, 255, 0.01)',
    border: 'transparent',
    priceClass: 'text-white',
    badge: null,
    showBorder: false
  },
  pro: {
    glow: 'radial-gradient(closest-side, rgba(59, 130, 246, 0.2), transparent 70%)',
    border: 'conic-gradient(from 0deg, transparent 0deg, #3B82F6 80deg, #60A5FA 160deg, transparent 240deg, transparent 360deg)',
    priceClass: 'bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent',
    badge: 'Popular Choice',
    showBorder: true
  },
  pro_plus: {
    glow: 'radial-gradient(closest-side, rgba(236, 72, 153, 0.2), transparent 70%)',
    border: 'conic-gradient(from 0deg, transparent 0deg, #EC4899 80deg, #F472B6 160deg, transparent 240deg, transparent 360deg)',
    priceClass: 'bg-gradient-to-r from-pink-500 to-purple-400 bg-clip-text text-transparent',
    badge: 'Best Value',
    showBorder: true
  },
  vibers: {
    glow: 'radial-gradient(closest-side, rgba(139, 92, 246, 0.25), transparent 70%)',
    border: 'conic-gradient(from 0deg, transparent 0deg, #8B5CF6 80deg, #7C3AED 160deg, transparent 240deg, transparent 360deg)',
    priceClass: 'bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent',
    badge: 'Flagship',
    showBorder: true
  }
};

const currentPlanId = (plan?: string): PlanId => {
  if (plan && PLANS.some((p) => p.id === plan)) return plan as PlanId;
  return 'free';
};

function useCountUp(target: number, duration = 500) {
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);

  useEffect(() => {
    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      const val = from + (target - from) * eased;
      setDisplay(val);
      fromRef.current = val;
      if (p < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return display;
}

function PlanCard({
  plan,
  billing,
  userPlanId,
  isLoggedIn,
  index,
}: {
  plan: Plan;
  billing: BillingCycle;
  userPlanId: PlanId;
  isLoggedIn: boolean;
  index: number;
}) {
  const router = useRouter();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  
  const isCurrent = isLoggedIn && userPlanId === plan.id;
  const isUpgrade = isLoggedIn && PLAN_RANKS[plan.id] > PLAN_RANKS[userPlanId];
  const isDowngrade = isLoggedIn && PLAN_RANKS[plan.id] < PLAN_RANKS[userPlanId];

  const price = billing === 'monthly' ? plan.monthly : plan.annualEffectiveMonthly;
  const displayPrice = useCountUp(price);
  const Icon = plan.icon;
  const showAnnualNote = billing === 'annual' && plan.monthly > 0;
  const theme = PLAN_THEMES[plan.id];

  // Determine CTA label contextually
  let ctaLabel = 'Get Started';
  if (!isLoggedIn) {
    ctaLabel = plan.id === 'free' ? 'Get Started' : `Upgrade to ${plan.name}`;
  } else if (isCurrent) {
    ctaLabel = 'Current Plan';
  } else if (isUpgrade) {
    ctaLabel = `Upgrade to ${plan.name}`;
  } else if (isDowngrade) {
    ctaLabel = `Downgrade to ${plan.name}`;
  }

  const handleAction = async () => {
    if (!isLoggedIn) {
      router.push('/auth');
      return;
    }

    if (isCurrent) return;

    if (isDowngrade) {
      toast.info(
        `Your active ${userPlanId.toUpperCase()} subscription remains valid until its expiry date. Contact support or let your billing cycle conclude to switch to ${plan.name}.`
      );
      return;
    }

    if (plan.id === 'free') {
      return;
    }

    // Process Razorpay Checkout for Upgrades
    setCheckoutLoading(true);
    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        throw new Error('Failed to load Razorpay SDK. Please check your network connection.');
      }
      const order = await api.createPaymentOrder(plan.id, billing);
      
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_yourkeyhere',
        amount: order.amount,
        currency: order.currency,
        name: 'CoWatch',
        description: `Subscribe to ${plan.name} (${billing})`,
        order_id: order.order_id,
        handler: async (response: any) => {
          setCheckoutLoading(true);
          try {
            const res = await api.verifyPayment({
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
              plan_id: plan.id,
              billing: billing
            });
            toast.success(res.message || `Payment verified! Welcome to ${plan.name}!`);
            setTimeout(() => {
              window.location.reload();
            }, 1500);
          } catch (err: any) {
            toast.error(err.message || 'Payment verification failed');
          } finally {
            setCheckoutLoading(false);
          }
        },
        theme: {
          color: '#8B5CF6'
        }
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err: any) {
      toast.error(err.message || 'Checkout initialization failed');
    } finally {
      setCheckoutLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -8 }}
      className="relative h-full flex flex-col"
    >
      {theme.showBorder && (
        <div
          className="absolute -inset-5 rounded-3xl blur-2xl pointer-events-none"
          style={{
            background: theme.glow,
            animation: 'co-pulse 4s ease-in-out infinite',
          }}
        />
      )}

      <div className={cn('relative rounded-2xl p-px h-full flex flex-col flex-1', theme.showBorder && 'overflow-hidden')}>
        {theme.showBorder && (
          <div
            className="absolute -inset-[200%]"
            style={{
              background: theme.border,
              animation: 'co-spin 5s linear infinite',
            }}
          />
        )}

        <div
          className={cn(
            'relative glass-card rounded-2xl p-6 lg:p-7 h-full flex flex-col flex-1',
            theme.showBorder
              ? 'bg-[#12121A] border-transparent shadow-[0_20px_60px_-30px_rgba(255,255,255,0.05)]'
              : 'border border-white/5 bg-white/[0.02] hover:border-white/15 transition-colors'
          )}
        >
          {/* Header Row: Icon & Badges */}
          <div className="flex items-center justify-between mb-4">
            <div
              className={cn(
                'w-11 h-11 rounded-xl flex items-center justify-center border transition-all',
                theme.showBorder
                  ? 'bg-gradient-to-br from-[var(--primary)]/30 to-[var(--secondary)]/20 border-[var(--primary)]/30 shadow-lg shadow-[var(--primary)]/10'
                  : 'bg-[var(--primary)]/10 border-[var(--primary)]/20'
              )}
            >
              <Icon className={cn('w-5 h-5', theme.showBorder ? 'text-[var(--primary)]' : 'text-[var(--primary)]/80')} />
            </div>
            
            <div className="flex items-center gap-1.5">
              {isCurrent && (
                <Badge variant="outline" className="text-[10px] font-bold text-white/70 border-white/20 bg-white/5">
                  Current
                </Badge>
              )}
              {theme.badge && !isCurrent && (
                <Badge className={cn(
                  'text-[10px] font-semibold border',
                  plan.id === 'pro' 
                    ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                    : plan.id === 'pro_plus'
                      ? 'bg-pink-500/15 text-pink-300 border-pink-500/30'
                      : 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                )}>
                  <Sparkles className="w-3 h-3 mr-1" />
                  {theme.badge}
                </Badge>
              )}
            </div>
          </div>

          {/* Title & Tagline */}
          <h2 className="text-xl font-bold text-white tracking-tight">{plan.name}</h2>
          <p className="text-xs text-white/50 mt-1 mb-6 min-h-[32px] leading-relaxed">{plan.tagline}</p>

          {/* Pricing Block */}
          <div className="mb-6">
            <div className="flex items-baseline gap-1.5">
              <span className={cn('text-4xl lg:text-5xl font-black tracking-tight', theme.priceClass)}>
                {plan.monthly === 0 ? '$0' : `$${displayPrice.toFixed(2)}`}
              </span>
              <span className="text-sm text-white/40 font-medium">
                {plan.monthly === 0 ? 'forever' : '/ month'}
              </span>
            </div>

            {showAnnualNote ? (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[11px] text-white/40 font-medium">
                  ${plan.annual} billed annually
                </span>
                <span className="text-[10px] font-bold text-green-400 bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded">
                  Save {plan.annualSavingsPercent}%
                </span>
              </div>
            ) : (
              <div className="mt-2 text-[11px] text-white/25 font-medium min-h-[18px]">
                {plan.monthly === 0 ? 'Free tier access' : 'Standard monthly billing'}
              </div>
            )}
          </div>

          {/* Feature List */}
          <ul className="space-y-3 flex-1 mb-7 border-t border-white/5 pt-6">
            {plan.features.map((feature, idx) => (
              <motion.li
                key={feature.text}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.18 + index * 0.06 + idx * 0.03, duration: 0.35 }}
                className="flex items-start gap-2.5"
              >
                {feature.included ? (
                  <span className="mt-0.5 w-4 h-4 rounded-full bg-[var(--primary)]/15 border border-[var(--primary)]/30 flex items-center justify-center shrink-0">
                    <Check className="w-2.5 h-2.5 text-[var(--primary)]" strokeWidth={3} />
                  </span>
                ) : (
                  <span className="mt-0.5 w-4 h-4 rounded-full bg-white/[0.02] border border-white/5 flex items-center justify-center shrink-0">
                    <X className="w-2.5 h-2.5 text-white/20" strokeWidth={2.5} />
                  </span>
                )}
                <span className={cn('text-xs leading-snug', feature.included ? 'text-white/85 font-medium' : 'text-white/30 line-through')}>
                  {feature.text}
                </span>
              </motion.li>
            ))}
          </ul>

          {/* CTA Action Button */}
          <motion.button
            whileHover={isCurrent || checkoutLoading ? {} : { scale: 1.02 }}
            whileTap={isCurrent || checkoutLoading ? {} : { scale: 0.98 }}
            onClick={handleAction}
            disabled={isCurrent || checkoutLoading}
            className={cn(
              'w-full py-3.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg',
              isCurrent
                ? 'bg-white/[0.04] border border-white/10 text-white/40 cursor-default shadow-none'
                : isDowngrade
                  ? 'bg-white/5 hover:bg-white/10 text-white/60 border border-white/10'
                  : plan.flagship
                    ? 'btn-primary bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-purple-500/20'
                    : plan.id === 'pro'
                      ? 'btn-primary bg-blue-600 text-white shadow-blue-600/20'
                      : plan.id === 'pro_plus'
                        ? 'btn-primary bg-pink-600 text-white shadow-pink-600/20'
                        : 'btn-secondary'
            )}
          >
            {checkoutLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <span>{ctaLabel}</span>
            )}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

export default function Plans() {
  const router = useRouter();
  const { user } = useAuth();
  const [billing, setBilling] = useState<BillingCycle>('monthly');

  const current = currentPlanId(user?.plan);
  const isLoggedIn = !!user;

  return (
    <DashboardLayout>
      <PageTransition>
        <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-12">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/5 pb-8">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--primary)]/10 border border-[var(--primary)]/20 text-[var(--primary)] text-xs font-semibold mb-3">
                <Sparkles className="w-3.5 h-3.5" /> Flexible Streaming Tiers
              </div>
              <h1 className="heading-page mb-2">Subscription Plans</h1>
              <p className="text-body flex flex-wrap items-center gap-x-2 text-sm">
                <span>Pick the plan that fits your watch parties. Upgrade or downgrade anytime.</span>
                <button 
                  onClick={() => router.push('/settings')}
                  className="text-[var(--primary)] hover:underline font-semibold inline-flex items-center gap-1 mt-1 md:mt-0 transition-all hover:translate-x-0.5"
                >
                  Have a coupon? Redeem here →
                </button>
              </p>
            </div>

            {/* Billing Cycle Toggle */}
            <div className="flex items-center gap-3 self-start md:self-auto">
              <div className="flex items-center gap-1 p-1 bg-white/[0.03] border border-white/10 rounded-2xl shadow-inner">
                <button
                  onClick={() => setBilling('monthly')}
                  className={cn(
                    'px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all',
                    billing === 'monthly'
                      ? 'bg-white/15 text-white shadow-md'
                      : 'text-white/40 hover:text-white/70'
                  )}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBilling('annual')}
                  className={cn(
                    'px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2',
                    billing === 'annual'
                      ? 'bg-[var(--primary)] text-white shadow-lg shadow-[var(--primary)]/25'
                      : 'text-white/40 hover:text-white/70'
                  )}
                >
                  Annual
                  <span className={cn(
                    'text-[9px] px-1.5 py-0.5 rounded-full font-extrabold uppercase',
                    billing === 'annual' ? 'bg-black/20 text-white' : 'bg-green-500/20 text-green-400'
                  )}>
                    Save ~17%
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Pricing Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 items-stretch">
            {PLANS.map((plan, idx) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                billing={billing}
                userPlanId={current}
                isLoggedIn={isLoggedIn}
                index={idx}
              />
            ))}
          </div>

          {/* Enterprise / Custom Plan Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.5 }}
            className="rounded-3xl p-8 lg:p-10 border border-white/10 bg-gradient-to-r from-white/[0.03] via-white/[0.01] to-white/[0.03] backdrop-blur-xl flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-[var(--primary)]/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex items-center gap-5 relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-[var(--primary)]/10 border border-[var(--primary)]/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-lg shadow-[var(--primary)]/10">
                <Sparkles className="w-7 h-7 text-[var(--primary)]" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <h3 className="text-xl font-bold text-white tracking-tight">Need more?</h3>
                  <Badge variant="outline" className="text-[10px] text-[var(--primary)] border-[var(--primary)]/30 bg-[var(--primary)]/5 font-semibold">
                    Custom & Enterprise
                  </Badge>
                </div>
                <p className="text-xs md:text-sm text-white/50 max-w-xl leading-relaxed">
                  Need higher storage, custom processing capacity, large-scale concurrent watch parties, or tailored SLA requirements?
                </p>
              </div>
            </div>

            <div className="relative z-10 shrink-0 w-full md:w-auto">
              <a
                href="mailto:support@cowatch.app?subject=CoWatch%20Enterprise%20%2F%20Custom%20Plan%20Inquiry"
                className="w-full md:w-auto px-7 py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider text-white bg-white/5 hover:bg-white/10 border border-white/15 hover:border-[var(--primary)]/40 transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                <span>Talk to us</span>
                <ArrowRight className="w-4 h-4 text-[var(--primary)]" />
              </a>
            </div>
          </motion.div>
        </div>
      </PageTransition>
    </DashboardLayout>
  );
}
