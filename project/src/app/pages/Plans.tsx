"use client";

import { useState, useEffect, useRef } from 'react';
import { Check, X, Sparkles, Users, Rocket, Zap, Crown } from 'lucide-react';
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
  flagship?: boolean;
  icon: typeof Users;
  features: { text: string; included: boolean }[];
}

const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    tagline: 'Casual movie nights',
    monthly: 0,
    annual: 0,
    icon: Users,
    features: [
      { text: '2 GB storage', included: true },
      { text: '720p upload quality', included: true },
      { text: 'Max 3 uploads of 720p', included: true },
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
    monthly: 1.99,
    annual: 19,
    icon: Rocket,
    features: [
      { text: '10 GB storage', included: true },
      { text: '1080p upload quality', included: true },
      { text: 'Max 5 uploads of 1080p', included: true },
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
    monthly: 5.99,
    annual: 59,
    icon: Zap,
    features: [
      { text: '20 GB storage', included: true },
      { text: '1080p upload quality', included: true },
      { text: 'Unlimited 1080p uploads', included: true },
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
    monthly: 8.99,
    annual: 89,
    flagship: true,
    icon: Crown,
    features: [
      { text: '50 GB storage', included: true },
      { text: '4K upload quality', included: true },
      { text: 'Unlimited 4K uploads', included: true },
      { text: 'Unlimited room capacity', included: true },
      { text: 'Unlimited YouTube rooms', included: true },
      { text: 'Everything in Pro+', included: true },
      { text: 'Custom branding & moderation', included: true },
      { text: 'Analytics + API access', included: true },
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
    badge: 'Ultimate Party',
    showBorder: true
  }
};

const currentPlanId = (plan?: string): PlanId => {
  if (plan && PLANS.some((p) => p.id === plan)) return plan as PlanId;
  return 'free';
};

function useCountUp(target: number, duration = 550) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);

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
  isCurrent,
  index,
}: {
  plan: Plan;
  billing: BillingCycle;
  isCurrent: boolean;
  index: number;
}) {
  const router = useRouter();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const price = billing === 'monthly' ? plan.monthly : plan.annual / 12;
  const displayPrice = useCountUp(price);
  const Icon = plan.icon;
  const showAnnualNote = billing === 'annual' && plan.monthly > 0;
  const theme = PLAN_THEMES[plan.id];

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -8 }}
      className="relative h-full"
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

      <div className={cn('relative rounded-2xl p-px h-full', theme.showBorder && 'overflow-hidden')}>
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
            'relative glass-card rounded-2xl p-6 lg:p-7 h-full flex flex-col',
            theme.showBorder
              ? 'bg-[#15151D] border-transparent shadow-[0_20px_60px_-30px_rgba(255,255,255,0.05)]'
              : 'border border-white/5 bg-white/[0.02] hover:border-white/15 transition-colors'
          )}
        >
          <div className="flex items-center justify-between mb-4">
            <div
              className={cn(
                'w-11 h-11 rounded-xl flex items-center justify-center border',
                theme.showBorder
                  ? 'bg-gradient-to-br from-[var(--primary)]/30 to-[var(--secondary)]/20 border-[var(--primary)]/30'
                  : 'bg-[var(--primary)]/10 border-[var(--primary)]/20'
              )}
            >
              <Icon className={cn('w-5 h-5', theme.showBorder ? 'text-[var(--primary)]' : 'text-[var(--primary)]/80')} />
            </div>
            <div className="flex items-center gap-1.5">
              {isCurrent && (
                <Badge variant="outline" className="text-[10px] text-white/50 border-white/15">
                  Current
                </Badge>
              )}
              {theme.badge && !isCurrent && (
                <Badge className="text-[10px] bg-white/10 hover:bg-white/15 text-white/80 border border-white/5">
                  <Sparkles className="w-3 h-3 text-[var(--primary)] mr-1" />
                  {theme.badge}
                </Badge>
              )}
            </div>
          </div>

          <h2 className="text-lg font-bold text-white tracking-tight">{plan.name}</h2>
          <p className="text-sm text-white/40 mt-1 mb-6">{plan.tagline}</p>

          <div className="mb-6">
            <span className={cn('text-4xl lg:text-5xl font-extrabold tracking-tight', theme.priceClass)}>
              {plan.monthly === 0 ? '$0' : `$${displayPrice.toFixed(2)}`}
            </span>
            <span className="text-sm text-white/35 font-medium ml-1.5">
              {plan.monthly === 0 ? 'forever' : '/ month'}
            </span>
            {showAnnualNote && (
              <p className="text-xs text-white/30 font-medium uppercase tracking-wider mt-1.5">
                ${plan.annual} billed once a year
              </p>
            )}
          </div>

          <ul className="space-y-3 flex-1 mb-7">
            {plan.features.map((feature, idx) => (
              <motion.li
                key={feature.text}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.18 + index * 0.06 + idx * 0.03, duration: 0.35 }}
                className="flex items-start gap-2.5"
              >
                {feature.included ? (
                  <span className="mt-0.5 w-5 h-5 rounded-full bg-[var(--primary)]/10 border border-[var(--primary)]/20 flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 text-[var(--primary)]" strokeWidth={3} />
                  </span>
                ) : (
                  <span className="mt-0.5 w-5 h-5 rounded-full bg-white/[0.03] border border-white/5 flex items-center justify-center shrink-0">
                    <X className="w-3 h-3 text-white/20" strokeWidth={2.5} />
                  </span>
                )}
                <span className={cn('text-sm leading-snug', feature.included ? 'text-white/85' : 'text-white/30 line-through')}>
                  {feature.text}
                </span>
              </motion.li>
            ))}
          </ul>

          <motion.button
            whileHover={isCurrent || checkoutLoading ? {} : { scale: 1.03 }}
            whileTap={isCurrent || checkoutLoading ? {} : { scale: 0.97 }}
            onClick={async () => {
              if (isCurrent) return;
              if (plan.id === 'vibers') {
                toast.info('Vibers plan is coming soon!');
                return;
              }
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
                      toast.success(res.message || 'Payment verified! Upgraded successfully!');
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
                toast.error(err.message || 'Checkout failed');
              } finally {
                setCheckoutLoading(false);
              }
            }}
            disabled={isCurrent || checkoutLoading}
            className={cn(
              'w-full py-3 text-[13px] font-bold flex items-center justify-center gap-2',
              isCurrent
                ? 'rounded-xl bg-white/[0.03] border border-white/10 text-white/40 font-bold uppercase tracking-widest cursor-default'
                : plan.flagship
                  ? 'btn-primary w-full'
                  : 'btn-secondary w-full'
            )}
          >
            {checkoutLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                Processing...
              </>
            ) : isCurrent ? (
              'Current Plan'
            ) : plan.id === 'vibers' ? (
              'Coming Soon'
            ) : (
              `Upgrade to ${plan.name}`
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

  return (
    <DashboardLayout>
      <PageTransition>
        <div className="p-8 max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/5 pb-10">
            <div>
              <h1 className="heading-page mb-1">Plans</h1>
              <p className="text-body flex flex-wrap items-center gap-x-2">
                <span>Pick the plan that fits your watch parties. Upgrade or downgrade anytime.</span>
                <button 
                  onClick={() => router.push('/settings')}
                  className="text-[var(--primary)] hover:underline text-xs font-semibold inline-flex items-center gap-1 mt-1 md:mt-0 transition-all hover:translate-x-0.5"
                >
                  Have a coupon? Redeem here →
                </button>
              </p>
            </div>

            {/* Billing Toggle */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 p-1 bg-white/[0.02] border border-white/5 rounded-xl">
                {(['monthly', 'annual'] as const).map((cycle) => (
                  <button
                    key={cycle}
                    onClick={() => setBilling(cycle)}
                    className={cn(
                      'px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-widest transition-all',
                      billing === cycle
                        ? 'bg-[var(--primary)] text-white shadow-lg shadow-[var(--primary)]/20'
                        : 'text-white/40 hover:text-white/70'
                    )}
                  >
                    {cycle}
                  </button>
                ))}
              </div>
              {billing === 'annual' && (
                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--primary)]">
                  2 months free
                </span>
              )}
            </div>
          </div>

          {/* Plan Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {PLANS.map((plan, idx) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                billing={billing}
                isCurrent={current === plan.id}
                index={idx}
              />
            ))}
          </div>
        </div>
      </PageTransition>
    </DashboardLayout>
  );
}
