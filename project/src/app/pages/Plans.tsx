"use client";

import { useState, useEffect, useRef } from 'react';
import { Check, X, Sparkles, Users, Rocket, Zap, Crown, ArrowRight, HelpCircle, Tag } from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { useAuth } from '../lib/auth';
import { PageTransition } from '../components/ui/PageTransition';
import { Badge } from '../components/ui/badge';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { useRouter } from 'next/navigation';
import { api } from '../lib/api';


export type BillingCycle = 'monthly' | 'annual';

export type PlanId = 'free' | 'pro' | 'pro_plus' | 'vibers';

export type CurrencyCode = 'inr' | 'usd' | 'gbp' | 'eur' | 'jpy' | 'krw';

export interface CurrencyConfig {
  code: CurrencyCode;
  symbol: string;
  name: string;
  country: string;
  flag: string;
  isZeroDecimal: boolean;
}

export const REGIONAL_CURRENCIES: Record<CurrencyCode, CurrencyConfig> = {
  inr: { code: 'inr', symbol: '₹', name: 'INR', country: 'India', flag: '🇮🇳', isZeroDecimal: false },
  usd: { code: 'usd', symbol: '$', name: 'USD', country: 'United States', flag: '🇺🇸', isZeroDecimal: false },
  gbp: { code: 'gbp', symbol: '£', name: 'GBP', country: 'United Kingdom', flag: '🇬🇧', isZeroDecimal: false },
  eur: { code: 'eur', symbol: '€', name: 'EUR', country: 'Europe', flag: '🇪🇺', isZeroDecimal: false },
  jpy: { code: 'jpy', symbol: '¥', name: 'JPY', country: 'Japan', flag: '🇯🇵', isZeroDecimal: true },
  krw: { code: 'krw', symbol: '₩', name: 'KRW', country: 'Korea', flag: '🇰🇷', isZeroDecimal: true },
};

export const REGIONAL_PRICES: Record<PlanId, Record<CurrencyCode, { monthly: number; annual: number; annualEffectiveMonthly: number; savingsPercent: number }>> = {
  free: {
    inr: { monthly: 0, annual: 0, annualEffectiveMonthly: 0, savingsPercent: 0 },
    usd: { monthly: 0, annual: 0, annualEffectiveMonthly: 0, savingsPercent: 0 },
    gbp: { monthly: 0, annual: 0, annualEffectiveMonthly: 0, savingsPercent: 0 },
    eur: { monthly: 0, annual: 0, annualEffectiveMonthly: 0, savingsPercent: 0 },
    jpy: { monthly: 0, annual: 0, annualEffectiveMonthly: 0, savingsPercent: 0 },
    krw: { monthly: 0, annual: 0, annualEffectiveMonthly: 0, savingsPercent: 0 },
  },
  pro: {
    inr: { monthly: 149, annual: 1499, annualEffectiveMonthly: 124.91, savingsPercent: 16 },
    usd: { monthly: 2.99, annual: 29.99, annualEffectiveMonthly: 2.50, savingsPercent: 16 },
    gbp: { monthly: 2.49, annual: 24.99, annualEffectiveMonthly: 2.08, savingsPercent: 16 },
    eur: { monthly: 2.99, annual: 29.99, annualEffectiveMonthly: 2.50, savingsPercent: 16 },
    jpy: { monthly: 450, annual: 4500, annualEffectiveMonthly: 375, savingsPercent: 17 },
    krw: { monthly: 4000, annual: 40000, annualEffectiveMonthly: 3333, savingsPercent: 17 },
  },
  pro_plus: {
    inr: { monthly: 299, annual: 2999, annualEffectiveMonthly: 249.91, savingsPercent: 16 },
    usd: { monthly: 6.99, annual: 69.99, annualEffectiveMonthly: 5.83, savingsPercent: 17 },
    gbp: { monthly: 5.49, annual: 54.99, annualEffectiveMonthly: 4.58, savingsPercent: 17 },
    eur: { monthly: 6.49, annual: 64.99, annualEffectiveMonthly: 5.41, savingsPercent: 17 },
    jpy: { monthly: 1050, annual: 10500, annualEffectiveMonthly: 875, savingsPercent: 17 },
    krw: { monthly: 9500, annual: 95000, annualEffectiveMonthly: 7916, savingsPercent: 17 },
  },
  vibers: {
    inr: { monthly: 499, annual: 4999, annualEffectiveMonthly: 416.58, savingsPercent: 17 },
    usd: { monthly: 9.99, annual: 99.99, annualEffectiveMonthly: 8.33, savingsPercent: 17 },
    gbp: { monthly: 7.99, annual: 79.99, annualEffectiveMonthly: 6.66, savingsPercent: 17 },
    eur: { monthly: 9.49, annual: 94.99, annualEffectiveMonthly: 7.91, savingsPercent: 17 },
    jpy: { monthly: 1500, annual: 15000, annualEffectiveMonthly: 1250, savingsPercent: 17 },
    krw: { monthly: 13500, annual: 135000, annualEffectiveMonthly: 11250, savingsPercent: 17 },
  },
};

export function getAutoDetectedCurrency(): CurrencyCode {
  try {
    const tz = (Intl.DateTimeFormat().resolvedOptions().timeZone || '').toLowerCase();
    if (tz.includes('calcutta') || tz.includes('kolkata') || tz.includes('india')) {
      return 'inr';
    }
    if (tz.includes('tokyo') || tz.includes('japan')) {
      return 'jpy';
    }
    if (tz.includes('seoul') || tz.includes('korea')) {
      return 'krw';
    }
    if (tz.includes('london')) {
      return 'gbp';
    }
    if (
      tz.includes('europe') || tz.includes('berlin') || tz.includes('paris') ||
      tz.includes('madrid') || tz.includes('rome') || tz.includes('amsterdam') ||
      tz.includes('brussels') || tz.includes('vienna') || tz.includes('dublin')
    ) {
      return 'eur';
    }
    if (
      tz.includes('america') || tz.includes('new_york') || tz.includes('los_angeles') ||
      tz.includes('chicago') || tz.includes('denver') || tz.includes('phoenix') ||
      tz.includes('toronto') || tz.includes('vancouver') || tz.includes('pacific') ||
      tz.includes('central') || tz.includes('mountain') || tz.includes('eastern')
    ) {
      return 'usd';
    }
  } catch (e) {
    // fallback
  }
  // Default to INR if detected in Indian context, else USD for international
  try {
    const tz = (Intl.DateTimeFormat().resolvedOptions().timeZone || '').toLowerCase();
    if (tz.includes('asia/kolkata') || tz.includes('asia/calcutta')) return 'inr';
  } catch (_) {}
  return 'usd';
}

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
      { text: 'Up to 480p SD video', included: true },
      { text: '3 video uploads (lifetime)', included: true },
      { text: 'Up to 1 hr per video', included: true },
      { text: 'Rooms up to 4 people', included: true },
      { text: '15 YouTube rooms / month', included: true },
      { text: '1 audio track per video', included: true },
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
      { text: 'Up to 720p HD video', included: true },
      { text: '8 video uploads / month', included: true },
      { text: '10 processing hours / month', included: true },
      { text: 'Up to 2.5 hrs per video', included: true },
      { text: 'Rooms up to 10 people', included: true },
      { text: 'Unlimited YouTube rooms', included: true },
      { text: 'Up to 2 audio tracks', included: true },
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
      { text: 'Up to 1080p Full HD video', included: true },
      { text: '20 video uploads / month', included: true },
      { text: '25 processing hours / month', included: true },
      { text: 'Up to 4.0 hrs per video', included: true },
      { text: 'Rooms up to 25 people', included: true },
      { text: 'Unlimited YouTube rooms', included: true },
      { text: 'Up to 3 audio tracks', included: true },
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
      { text: 'Up to 1080p Full HD video', included: true },
      { text: '40 video uploads / month', included: true },
      { text: '45 processing hours / month', included: true },
      { text: 'Up to 4.0 hrs per video', included: true },
      { text: 'Strictly 51 people (1 host + 50 viewers)', included: true },
      { text: 'Unlimited YouTube rooms', included: true },
      { text: 'Up to 3 audio tracks', included: true },
      { text: 'Custom color & gradient mode studio', included: true },
      { text: 'Everything in Pro+', included: true },
      { text: 'Custom branding & moderation', included: true },
      { text: 'Analytics & API access', included: true },
    ],
  },
];

const PLAN_THEMES = {
  free: {
    priceClass: 'text-white',
    badge: null,
    badgeStyle: '',
    hasWaves: false,
    cardBorder: 'border-white/5 hover:border-white/15',
    topBorderGlow: 'from-white/10 to-transparent',
    waveGradients: null,
  },
  pro: {
    priceClass: 'bg-gradient-to-r from-blue-400 via-cyan-300 to-sky-400 bg-clip-text text-transparent',
    badge: 'Popular Choice',
    badgeStyle: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    hasWaves: true,
    cardBorder: 'border-blue-500/30 hover:border-blue-400/50 shadow-[0_0_35px_-10px_rgba(59,130,246,0.25)]',
    topBorderGlow: 'from-blue-500 via-cyan-400 to-blue-600',
    waveGradients: {
      radialGlow: 'rgba(6, 182, 212, 0.40)',
      deep: {
        from: '#06b6d4',
        via: '#2563eb',
        to: '#1e1b4b',
        fromOpacity: 0.65,
        viaOpacity: 0.40,
        toOpacity: 0.05,
      },
      mid: {
        from: '#38bdf8',
        via: '#3b82f6',
        to: '#0f172a',
        fromOpacity: 0.55,
        viaOpacity: 0.35,
        toOpacity: 0.02,
      },
      crest: {
        from: '#67e8f9',
        via: '#1d4ed8',
        to: '#0284c7',
        fromOpacity: 0.80,
        viaOpacity: 0.25,
        toOpacity: 0.0,
      },
    },
  },
  pro_plus: {
    priceClass: 'bg-gradient-to-r from-pink-400 via-rose-300 to-purple-400 bg-clip-text text-transparent',
    badge: 'Best Value',
    badgeStyle: 'bg-pink-500/15 text-pink-300 border-pink-500/30',
    hasWaves: true,
    cardBorder: 'border-pink-500/30 hover:border-pink-400/50 shadow-[0_0_35px_-10px_rgba(236,72,153,0.25)]',
    topBorderGlow: 'from-pink-500 via-rose-400 to-purple-600',
    waveGradients: {
      radialGlow: 'rgba(236, 72, 153, 0.40)',
      deep: {
        from: '#f43f5e',
        via: '#c026d3',
        to: '#3b0764',
        fromOpacity: 0.65,
        viaOpacity: 0.40,
        toOpacity: 0.05,
      },
      mid: {
        from: '#fb7185',
        via: '#ec4899',
        to: '#2e1065',
        fromOpacity: 0.55,
        viaOpacity: 0.35,
        toOpacity: 0.02,
      },
      crest: {
        from: '#fda4af',
        via: '#d946ef',
        to: '#e11d48',
        fromOpacity: 0.80,
        viaOpacity: 0.25,
        toOpacity: 0.0,
      },
    },
  },
  vibers: {
    priceClass: 'bg-gradient-to-r from-purple-400 via-fuchsia-300 to-indigo-300 bg-clip-text text-transparent',
    badge: 'Flagship',
    badgeStyle: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    hasWaves: true,
    cardBorder: 'border-purple-500/35 hover:border-purple-400/55 shadow-[0_0_40px_-10px_rgba(139,92,246,0.3)]',
    topBorderGlow: 'from-purple-500 via-indigo-400 to-fuchsia-500',
    waveGradients: {
      radialGlow: 'rgba(147, 51, 234, 0.45)',
      deep: {
        from: '#8b5cf6',
        via: '#4f46e5',
        to: '#180b33',
        fromOpacity: 0.68,
        viaOpacity: 0.42,
        toOpacity: 0.05,
      },
      mid: {
        from: '#a855f7',
        via: '#c026d3',
        to: '#240a4b',
        fromOpacity: 0.58,
        viaOpacity: 0.35,
        toOpacity: 0.02,
      },
      crest: {
        from: '#e9d5ff',
        via: '#c084fc',
        to: '#6366f1',
        fromOpacity: 0.85,
        viaOpacity: 0.25,
        toOpacity: 0.0,
      },
    },
  },
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
  currencyCode,
  userPlanId,
  isLoggedIn,
  index,
  couponCode,
}: {
  plan: Plan;
  billing: BillingCycle;
  currencyCode: CurrencyCode;
  userPlanId: PlanId;
  isLoggedIn: boolean;
  index: number;
  couponCode?: string;
}) {
  const router = useRouter();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  
  const isCurrent = isLoggedIn && userPlanId === plan.id;
  const isUpgrade = isLoggedIn && PLAN_RANKS[plan.id] > PLAN_RANKS[userPlanId];
  const isDowngrade = isLoggedIn && PLAN_RANKS[plan.id] < PLAN_RANKS[userPlanId];

  const isCouponApplied = (couponCode === 'PRO5' || couponCode === 'TEST5' || couponCode === 'COWATCH5') && plan.id === 'pro';

  const currConfig = REGIONAL_CURRENCIES[currencyCode] || REGIONAL_CURRENCIES.inr;
  const currentPricing = REGIONAL_PRICES[plan.id][currencyCode] || REGIONAL_PRICES[plan.id].usd;
  const price = billing === 'monthly' ? currentPricing.monthly : currentPricing.annualEffectiveMonthly;
  const displayPrice = useCountUp(isCouponApplied ? 5 : price);
  const Icon = plan.icon;
  const showAnnualNote = billing === 'annual' && currentPricing.monthly > 0;
  const theme = PLAN_THEMES[plan.id];

  const formatPrice = (val: number) => {
    if (val === 0) return `${currConfig.symbol}0`;
    if (val % 1 === 0 || currConfig.isZeroDecimal) {
      return `${currConfig.symbol}${Math.round(val).toLocaleString()}`;
    }
    return `${currConfig.symbol}${val.toFixed(2)}`;
  };

  // Determine CTA label contextually
  let ctaLabel = 'Get Started';
  if (!isLoggedIn) {
    ctaLabel = plan.id === 'free' ? 'Get Started' : `Upgrade to ${plan.name}`;
  } else if (isCurrent) {
    ctaLabel = 'Current Plan';
  } else if (isUpgrade) {
    ctaLabel = isCouponApplied ? `Upgrade for ${currConfig.symbol}5` : `Upgrade to ${plan.name}`;
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

    // Process Hosted Checkout (Cashfree UPI/Cards or Stripe)
    setCheckoutLoading(true);
    try {
      const session = await api.createCheckoutSession(
        plan.id, 
        billing, 
        currencyCode, 
        isCouponApplied ? couponCode : undefined
      );
      if (!session) {
        throw new Error('No checkout session returned from server.');
      }

      // 1. If Cashfree payment session exists and Cashfree JS SDK is loaded, launch seamless modal checkout
      if (session.payment_gateway === 'cashfree' && session.payment_session_id && typeof window !== 'undefined' && (window as any).Cashfree) {
        const isTestKey = session.payment_session_id.toLowerCase().includes('test') || session.session_id.toLowerCase().includes('test');
        const cfMode = isTestKey ? 'sandbox' : 'production';
        const cashfree = (window as any).Cashfree({ mode: cfMode });
        const checkoutOptions = {
          paymentSessionId: session.payment_session_id,
          redirectTarget: '_self',
        };
        cashfree.checkout(checkoutOptions);
        setCheckoutLoading(false);
        return;
      }

      // 2. Fallback to direct redirect
      if (session.url) {
        toast.loading(`Redirecting to secure checkout (${currConfig.symbol}${billing === 'monthly' ? currentPricing.monthly : currentPricing.annual} ${currConfig.name})...`);
        window.location.href = session.url;
      } else {
        throw new Error('No checkout URL returned from payment server.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Checkout initialization failed');
      setCheckoutLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -6 }}
      className="relative h-full flex flex-col"
    >
      <div
        className={cn(
          'relative glass-card rounded-2xl p-6 lg:p-7 h-full flex flex-col flex-1 overflow-hidden bg-[#101018] border transition-all duration-300',
          theme.cardBorder
        )}
      >
        {/* Subtle Top Border Glow Line */}
        {theme.hasWaves && (
          <div
            className={cn('absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r opacity-90 z-10', theme.topBorderGlow)}
          />
        )}

        {/* Wavy Water Ambient Animation (Top 50% of Card Only) */}
        {theme.hasWaves && theme.waveGradients && (
          <div
            className="absolute top-0 inset-x-0 h-[50%] overflow-hidden rounded-t-2xl pointer-events-none select-none z-0"
            style={{
              maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.85) 60%, rgba(0,0,0,0) 100%)',
              WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.85) 60%, rgba(0,0,0,0) 100%)',
            }}
          >
            {/* Top Radial Glow */}
            <div
              className="absolute -top-14 inset-x-0 h-44 blur-3xl opacity-80 pointer-events-none"
              style={{
                background: `radial-gradient(ellipse at 50% 0%, ${theme.waveGradients.radialGlow}, transparent 75%)`,
              }}
            />

            {/* SVG Gradients Definition */}
            <svg className="absolute w-0 h-0 pointer-events-none" aria-hidden="true">
              <defs>
                <linearGradient id={`${plan.id}-grad-deep`} x1="0%" y1="0%" x2="80%" y2="100%">
                  <stop offset="0%" stopColor={theme.waveGradients.deep.from} stopOpacity={theme.waveGradients.deep.fromOpacity} />
                  <stop offset="50%" stopColor={theme.waveGradients.deep.via} stopOpacity={theme.waveGradients.deep.viaOpacity} />
                  <stop offset="100%" stopColor={theme.waveGradients.deep.to} stopOpacity={theme.waveGradients.deep.toOpacity} />
                </linearGradient>
                <linearGradient id={`${plan.id}-grad-mid`} x1="100%" y1="0%" x2="10%" y2="100%">
                  <stop offset="0%" stopColor={theme.waveGradients.mid.from} stopOpacity={theme.waveGradients.mid.fromOpacity} />
                  <stop offset="55%" stopColor={theme.waveGradients.mid.via} stopOpacity={theme.waveGradients.mid.viaOpacity} />
                  <stop offset="100%" stopColor={theme.waveGradients.mid.to} stopOpacity={theme.waveGradients.mid.toOpacity} />
                </linearGradient>
                <linearGradient id={`${plan.id}-grad-crest`} x1="20%" y1="0%" x2="85%" y2="100%">
                  <stop offset="0%" stopColor={theme.waveGradients.crest.from} stopOpacity={theme.waveGradients.crest.fromOpacity} />
                  <stop offset="50%" stopColor={theme.waveGradients.crest.via} stopOpacity={theme.waveGradients.crest.viaOpacity} />
                  <stop offset="100%" stopColor={theme.waveGradients.crest.to} stopOpacity={theme.waveGradients.crest.toOpacity} />
                </linearGradient>
              </defs>
            </svg>

            {/* Wave Layer 1: Slow Deep Current with Multi-Stop Gradient */}
            <div className="absolute inset-0 pointer-events-none animate-wave-slow">
              <svg
                viewBox="0 0 1200 400"
                preserveAspectRatio="none"
                className="w-[250%] h-full"
              >
                <path
                  d="M0,80 C150,140 350,20 500,80 C650,140 850,20 1000,80 C1150,140 1350,20 1500,80 L1500,400 L0,400 Z"
                  fill={`url(#${plan.id}-grad-deep)`}
                />
              </svg>
            </div>

            {/* Wave Layer 2: Fast Surface Swell with Vibrant Gradient */}
            <div className="absolute inset-0 pointer-events-none animate-wave-fast mix-blend-screen">
              <svg
                viewBox="0 0 1200 400"
                preserveAspectRatio="none"
                className="w-[250%] h-full"
              >
                <path
                  d="M0,120 C200,60 400,160 600,100 C800,40 1000,150 1200,100 C1400,50 1600,160 1800,110 L1800,400 L0,400 Z"
                  fill={`url(#${plan.id}-grad-mid)`}
                />
              </svg>
            </div>

            {/* Wave Layer 3: Surface Drift & Crest Highlights */}
            <div className="absolute inset-0 pointer-events-none animate-wave-drift mix-blend-screen">
              <svg
                viewBox="0 0 1200 400"
                preserveAspectRatio="none"
                className="w-[250%] h-full"
              >
                <path
                  d="M0,150 C180,100 360,180 540,130 C720,80 900,170 1080,120 C1260,70 1440,160 1620,110 L1620,400 L0,400 Z"
                  fill={`url(#${plan.id}-grad-crest)`}
                />
              </svg>
            </div>

            {/* Luminous Shimmer Overlay */}
            <div
              className="absolute inset-0 pointer-events-none opacity-30 mix-blend-overlay"
              style={{
                background: `radial-gradient(ellipse at 50% 25%, ${theme.waveGradients.radialGlow}, transparent 70%)`,
              }}
            />
          </div>
        )}

        {/* Header Row: Icon & Badges */}
        <div className="flex items-center justify-between mb-4 relative z-10">
          <div
            className={cn(
              'w-11 h-11 rounded-xl flex items-center justify-center border transition-all',
              theme.hasWaves
                ? 'bg-white/10 border-white/20 shadow-md backdrop-blur-md'
                : 'bg-white/[0.04] border-white/10'
            )}
          >
            <Icon
              className={cn(
                'w-5 h-5',
                plan.id === 'pro'
                  ? 'text-blue-400'
                  : plan.id === 'pro_plus'
                  ? 'text-pink-400'
                  : plan.id === 'vibers'
                  ? 'text-purple-300'
                  : 'text-white/80'
              )}
            />
          </div>

          <div className="flex items-center gap-1.5">
            {isCurrent && (
              <Badge variant="outline" className="text-[10px] font-bold text-white/70 border-white/20 bg-white/5">
                Current
              </Badge>
            )}
            {theme.badge && !isCurrent && (
              <Badge className={cn('text-[10px] font-semibold border backdrop-blur-md', theme.badgeStyle)}>
                <Sparkles className="w-3 h-3 mr-1" />
                {theme.badge}
              </Badge>
            )}
          </div>
        </div>

        {/* Title & Tagline */}
        <div className="relative z-10">
          <h2 className="text-xl font-bold text-white tracking-tight">{plan.name}</h2>
          <p className="text-xs text-white/60 mt-1 mb-5 min-h-[32px] leading-relaxed">{plan.tagline}</p>
        </div>

        {/* Pricing Block */}
        <div className="mb-6 relative z-10">
          <div className="flex items-baseline gap-1.5 flex-nowrap whitespace-nowrap">
            {isCouponApplied && (
              <span className="text-xl text-white/40 line-through mr-1 font-semibold">
                {formatPrice(price)}
              </span>
            )}
            <span className={cn('text-3xl lg:text-[32px] font-black tracking-tight leading-none', isCouponApplied ? 'text-green-400' : theme.priceClass)}>
              {isCouponApplied ? `${currConfig.symbol}5` : formatPrice(displayPrice)}
            </span>
            <span className="text-xs sm:text-sm text-white/50 font-medium shrink-0 whitespace-nowrap">
              {plan.id === 'free' ? 'forever' : '/ month'}
            </span>
          </div>

          {isCouponApplied ? (
            <div className="mt-2.5 flex items-center gap-2">
              <span className="text-[11.5px] font-bold text-green-400 bg-green-500/15 border border-green-500/25 px-2 py-0.5 rounded-md flex items-center gap-1">
                <Tag className="w-3 h-3" /> Special Promo Applied: {currConfig.symbol}5
              </span>
            </div>
          ) : showAnnualNote ? (
            <div className="mt-2.5 flex items-center gap-2 flex-wrap">
              <span className="text-[12.5px] text-white/60 font-semibold tracking-wide">
                {currConfig.symbol}{currentPricing.annual.toLocaleString()} billed annually
              </span>
              <span className="text-[11.5px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/25 px-2 py-0.5 rounded-md">
                Save {currentPricing.savingsPercent}%
              </span>
            </div>
          ) : (
            <div className="mt-2 text-[12px] text-white/35 font-medium min-h-[20px]">
              {plan.id === 'free' ? 'Free tier access' : 'Standard monthly billing'}
            </div>
          )}
        </div>

        {/* Feature List */}
        <ul className="space-y-3 flex-1 mb-7 border-t border-white/10 pt-6 relative z-10">
          {plan.features.map((feature, idx) => (
            <motion.li
              key={feature.text}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.18 + index * 0.06 + idx * 0.03, duration: 0.35 }}
              className="flex items-start gap-2.5"
            >
              {feature.included ? (
                <span className="mt-0.5 w-4 h-4 rounded-full bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
                  <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
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
        <div className="relative z-10 mt-auto">
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
  const [currency, setCurrency] = useState<CurrencyCode>('inr');
  const [detectedCountry, setDetectedCountry] = useState<string>('');

  useEffect(() => {
    // 1. Client-side timezone auto-detect
    const autoCurr = getAutoDetectedCurrency();
    setCurrency(autoCurr);

    // 2. Query server-side region detection endpoint for IP geolocation fallback
    api.detectRegion()
      .then((res) => {
        if (res && res.currency && REGIONAL_CURRENCIES[res.currency as CurrencyCode]) {
          setCurrency(res.currency as CurrencyCode);
          if (res.country) {
            setDetectedCountry(res.country);
          }
        }
      })
      .catch(() => {});
  }, []);

  const current = currentPlanId(user?.plan);
  const isLoggedIn = !!user;

  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState('');

  const handleApplyCoupon = () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    if (code === 'PRO5' || code === 'TEST5' || code === 'COWATCH5') {
      setAppliedCoupon(code);
      toast.success(`Promo code "${code}" applied successfully!`);
    } else {
      toast.error(`Invalid or expired promo code: "${code}".`);
    }
  };

  const [activeMobilePlan, setActiveMobilePlan] = useState<PlanId>(() => {
    if (user?.plan && PLANS.some((p) => p.id === user.plan)) {
      return user.plan as PlanId;
    }
    return 'pro';
  });

  return (
    <DashboardLayout>
      <PageTransition>
        <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
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
            <div className="flex items-center gap-1 p-1 bg-white/[0.03] border border-white/10 rounded-2xl shadow-inner self-start md:self-auto">
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

          {/* Interactive Promo / Discount Coupon Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 px-4 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md">
            <div className="flex items-center gap-2 text-xs text-white/70">
              <Tag className="w-4 h-4 text-[var(--primary)] shrink-0" />
              <span>Have a promo or discount code?</span>
            </div>
            <div className="flex items-center gap-2">
              {appliedCoupon ? (
                <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/25 px-3 py-1.5 rounded-xl">
                  <span className="text-xs font-bold text-green-400 font-mono">🏷️ {appliedCoupon} APPLIED</span>
                  <button
                    type="button"
                    onClick={() => { setAppliedCoupon(''); setCouponInput(''); toast.info('Coupon removed'); }}
                    className="text-white/40 hover:text-white text-xs ml-1 font-bold p-0.5"
                    title="Remove coupon"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Enter promo code"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleApplyCoupon(); }}
                    className="bg-black/40 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white placeholder-white/30 uppercase tracking-wider focus:outline-none focus:border-[var(--primary)] transition-all w-44"
                  />
                  <button
                    type="button"
                    onClick={handleApplyCoupon}
                    className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white border border-white/15 text-xs font-semibold transition-all hover:scale-[1.02]"
                  >
                    Apply
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Mobile Plan Quick Switcher (< md only) */}
          <div className="block md:hidden mb-2">
            <div className="flex items-center justify-between mb-2.5 px-1">
              <span className="text-xs font-bold uppercase tracking-wider text-white/50 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[var(--primary)]" /> Select Plan
              </span>
              <span className="text-[11px] text-white/40 font-medium">
                Direct switch
              </span>
            </div>

            <div className="grid grid-cols-4 p-1 bg-white/[0.03] border border-white/10 rounded-2xl backdrop-blur-xl gap-1">
              {PLANS.map((p) => {
                const isActive = activeMobilePlan === p.id;
                const pPricing = REGIONAL_PRICES[p.id][currency] || REGIONAL_PRICES[p.id].usd;
                const displayAmt = billing === 'monthly' ? pPricing.monthly : pPricing.annualEffectiveMonthly;
                const currConfig = REGIONAL_CURRENCIES[currency] || REGIONAL_CURRENCIES.inr;

                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setActiveMobilePlan(p.id)}
                    className={cn(
                      'relative py-2.5 px-1 rounded-xl text-center transition-all flex flex-col items-center justify-center gap-0.5',
                      isActive ? 'text-white' : 'text-white/50 hover:text-white/80'
                    )}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeMobilePlanIndicator"
                        className={cn(
                          'absolute inset-0 rounded-xl border shadow-lg',
                          p.id === 'pro'
                            ? 'bg-blue-600/30 border-blue-500/50 shadow-blue-500/25'
                            : p.id === 'pro_plus'
                            ? 'bg-pink-600/30 border-pink-500/50 shadow-pink-500/25'
                            : p.id === 'vibers'
                            ? 'bg-purple-600/30 border-purple-500/50 shadow-purple-500/25'
                            : 'bg-white/15 border-white/25 shadow-white/10'
                        )}
                        transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                      />
                    )}
                    <span className="relative z-10 text-xs font-bold truncate max-w-full">
                      {p.name}
                    </span>
                    <span className="relative z-10 text-[10px] font-medium opacity-80 truncate max-w-full">
                      {displayAmt === 0 ? 'Free' : `${currConfig.symbol}${Math.round(displayAmt)}`}
                    </span>
                    {p.id === 'pro' && (
                      <span className="relative z-10 w-1.5 h-1.5 rounded-full bg-cyan-400 mt-0.5 shadow-sm shadow-cyan-400" />
                    )}
                    {p.id === 'pro_plus' && (
                      <span className="relative z-10 w-1.5 h-1.5 rounded-full bg-pink-400 mt-0.5 shadow-sm shadow-pink-400" />
                    )}
                    {p.id === 'vibers' && (
                      <span className="relative z-10 w-1.5 h-1.5 rounded-full bg-purple-400 mt-0.5 shadow-sm shadow-purple-400" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mobile Single-Card View (< md only) */}
          <div className="block md:hidden">
            <AnimatePresence mode="wait">
              {PLANS.filter((p) => p.id === activeMobilePlan).map((selectedPlan) => (
                <motion.div
                  key={selectedPlan.id}
                  initial={{ opacity: 0, y: 14, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -14, scale: 0.98 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                >
                  <PlanCard
                    plan={selectedPlan}
                    billing={billing}
                    currencyCode={currency}
                    userPlanId={current}
                    isLoggedIn={isLoggedIn}
                    index={0}
                    couponCode={appliedCoupon}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Desktop & Tablet 4-Column Grid (md and up) */}
          <div className="hidden md:grid md:grid-cols-2 xl:grid-cols-4 gap-6 items-stretch">
            {PLANS.map((plan, idx) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                billing={billing}
                currencyCode={currency}
                userPlanId={current}
                isLoggedIn={isLoggedIn}
                index={idx}
                couponCode={appliedCoupon}
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
