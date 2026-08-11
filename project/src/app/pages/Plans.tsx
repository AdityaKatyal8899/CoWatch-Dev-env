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
    monthly: 4.99,
    annual: 49,
    icon: Rocket,
    features: [
      { text: '10 GB storage', included: true },
      { text: '1080p upload quality', included: true },
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
    monthly: 8.99,
    annual: 89,
    icon: Zap,
    features: [
      { text: '20 GB storage', included: true },
      { text: '1080p upload quality', included: true },
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
    monthly: 12.99,
    annual: 129,
    flagship: true,
    icon: Crown,
    features: [
      { text: '50 GB storage', included: true },
      { text: '4K upload quality', included: true },
      { text: 'Unlimited room capacity', included: true },
      { text: 'Unlimited YouTube rooms', included: true },
      { text: 'Everything in Pro+', included: true },
      { text: 'Custom branding & moderation', included: true },
      { text: 'Analytics + API access', included: true },
    ],
  },
];

const currentPlanId = (plan?: string): PlanId => {
  if (plan && PLANS.some((p) => p.id === plan)) return plan as PlanId;
  return 'free';
};

/**
 * Lightweight count-up for the price so it animates smoothly
 * when the billing cycle or plan changes.
 */
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
  const price = billing === 'monthly' ? plan.monthly : plan.annual / 12;
  const displayPrice = useCountUp(price);
  const Icon = plan.icon;
  const showAnnualNote = billing === 'annual' && plan.monthly > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -8 }}
      className="relative h-full"
    >
      {/* Soft glow that bleeds behind the card (flagship only) */}
      {plan.flagship && (
        <div
          className="absolute -inset-5 rounded-3xl blur-2xl pointer-events-none"
          style={{
            background: 'radial-gradient(closest-side, rgba(147, 51, 234, 0.35), transparent 70%)',
            animation: 'co-pulse 4s ease-in-out infinite',
          }}
        />
      )}

      {/* Animated gradient border wrapper */}
      <div className={cn('relative rounded-2xl p-px h-full', plan.flagship && 'overflow-hidden')}>
        {plan.flagship && (
          <div
            className="absolute -inset-[200%]"
            style={{
              background:
                'conic-gradient(from 0deg, transparent 0deg, var(--primary) 80deg, var(--secondary) 160deg, transparent 240deg, transparent 360deg)',
              animation: 'co-spin 5s linear infinite',
            }}
          />
        )}

        {/* Card body */}
        <div
          className={cn(
            'relative glass-card rounded-2xl p-6 lg:p-7 h-full flex flex-col',
            plan.flagship
              ? 'bg-[#15151D] border-transparent shadow-[0_20px_60px_-30px_rgba(147,51,234,0.4)]'
              : 'border border-white/5 bg-white/[0.02] hover:border-white/15 transition-colors'
          )}
        >
          {/* Plan header */}
          <div className="flex items-center justify-between mb-4">
            <div
              className={cn(
                'w-11 h-11 rounded-xl flex items-center justify-center border',
                plan.flagship
                  ? 'bg-gradient-to-br from-[var(--primary)]/30 to-[var(--secondary)]/20 border-[var(--primary)]/30'
                  : 'bg-[var(--primary)]/10 border-[var(--primary)]/20'
              )}
            >
              <Icon className={cn('w-5 h-5', plan.flagship ? 'text-[var(--primary)]' : 'text-[var(--primary)]/80')} />
            </div>
            <div className="flex items-center gap-1.5">
              {isCurrent && (
                <Badge variant="outline" className="text-[10px] text-white/50 border-white/15">
                  Current
                </Badge>
              )}
              {plan.flagship && !isCurrent && (
                <Badge className="text-[10px]">
                  <Sparkles className="w-3 h-3" />
                  Most Popular
                </Badge>
              )}
            </div>
          </div>

          <h2 className="text-lg font-bold text-white tracking-tight">{plan.name}</h2>
          <p className="text-sm text-white/40 mt-1 mb-6">{plan.tagline}</p>

          {/* Price */}
          <div className="mb-6">
            <span
              className={cn(
                'text-4xl lg:text-5xl font-extrabold tracking-tight',
                plan.flagship
                  ? 'bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] bg-clip-text text-transparent'
                  : 'text-white'
              )}
            >
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

          {/* Features */}
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

          {/* CTA */}
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              if (isCurrent) return;
              toast.info(`${plan.name} checkout is coming soon`);
            }}
            disabled={isCurrent}
            className={cn(
              'w-full py-3 text-[13px]',
              isCurrent
                ? 'rounded-xl bg-white/[0.03] border border-white/10 text-white/40 font-bold uppercase tracking-widest cursor-default'
                : plan.flagship
                  ? 'btn-primary w-full'
                  : 'btn-secondary w-full'
            )}
          >
            {isCurrent ? 'Current Plan' : plan.monthly === 0 ? 'Your Current Plan' : `Upgrade to ${plan.name}`}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

export default function Plans() {
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
              <p className="text-body">Pick the plan that fits your watch parties. Upgrade or downgrade anytime.</p>
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
