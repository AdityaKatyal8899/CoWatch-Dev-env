"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { ShieldCheck, Heart, Lock, AlertTriangle, Check } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { PageTransition } from '../components/ui/PageTransition';
import { toast } from 'sonner';

const GUIDELINES = [
  {
    icon: Lock,
    title: '1. Keep chat respectful',
    body: 'Hate speech, slurs, targeted harassment, and severe profanity are not allowed in chat. Messages that break this are filtered automatically and repeated violations mute you from chat.',
  },
  {
    icon: AlertTriangle,
    title: '2. Zero tolerance for illegal content',
    body: 'Child abuse, sex trafficking, and terrorism-related content are strictly forbidden. Such content is removed immediately, the account is banned, and we report it to the appropriate authorities. There are no warnings for these violations.',
  },
  {
    icon: ShieldCheck,
    title: '3. Adult (18+) rooms are gated',
    body: 'Some rooms contain adult content. Hosts must flag these rooms as 18+ and are responsible for doing so. If an unflagged adult room is detected, it is cancelled and the host is warned. You must be age-verified (18+) to enter an 18+ room — under-aged or unverified users cannot join.',
  },
  {
    icon: Heart,
    title: '4. Be a good community member',
    body: 'No spam, scams, non-consensual imagery, or copyright-infringing streams. You can report any room or message, and you can appeal a warning or ban if you believe it was a mistake.',
  },
];

export default function GuidelinesPage() {
  const router = useRouter();
  const { user, acceptTerms } = useAuth();
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleAccept = async () => {
    if (!agreed) return;
    setSubmitting(true);
    try {
      await acceptTerms();
      toast.success('Thanks — you’re all set!');
      // Route to the next step: onboarding for new users, dashboard for returning ones.
      router.push(user?.display_name ? '/dashboard' : '/onboarding');
    } catch (error) {
      toast.error('Could not save your acceptance. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 -left-48 w-96 h-96 bg-[var(--primary)]/20 rounded-full blur-3xl animated-gradient" />
          <div className="absolute bottom-1/4 -right-48 w-96 h-96 bg-[var(--primary)]/20 rounded-full blur-3xl animated-gradient" style={{ animationDelay: '-5s' }} />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 w-full max-w-2xl glass-card rounded-2xl p-8 shadow-2xl"
        >
          <div className="mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[var(--primary)]/15 border border-[var(--primary)]/30 mb-4">
              <ShieldCheck className="w-6 h-6 text-[var(--primary)]" />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Community Guidelines</h1>
            <p className="text-white/60 mt-2">
              Before you continue, please review our guidelines. You must accept them to use CoWatch.
            </p>
          </div>

          {/* Scrollable guidelines */}
          <div className="space-y-4 max-h-[46vh] overflow-y-auto scrollbar-thin pr-2 mb-6">
            {GUIDELINES.map((g) => {
              const Icon = g.icon;
              return (
                <div key={g.title} className="flex gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className="shrink-0 w-9 h-9 rounded-lg bg-[var(--primary)]/10 border border-[var(--primary)]/20 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-[var(--primary)]" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold text-sm mb-1">{g.title}</h3>
                    <p className="text-white/55 text-sm leading-relaxed">{g.body}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Agreement */}
          <label className="flex items-start gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/5 cursor-pointer hover:border-[var(--primary)]/30 transition-colors mb-5">
            <div className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${agreed ? 'bg-[var(--primary)] border-[var(--primary)]' : 'border-white/20'}`}>
              {agreed && <Check className="w-3.5 h-3.5 text-[var(--bg)]" strokeWidth={3} />}
            </div>
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="sr-only"
            />
            <span className="text-sm text-white/70 leading-relaxed">
              I have read and agree to the Community Guidelines and Terms of Service. I understand that
              18+ rooms require age verification and that illegal content results in an immediate ban.
            </span>
          </label>

          <button
            onClick={handleAccept}
            disabled={!agreed || submitting}
            className="w-full py-3.5 rounded-xl bg-[var(--primary)] hover:opacity-90 text-white font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? 'Saving…' : 'Accept & Continue'}
          </button>
        </motion.div>
      </div>
    </PageTransition>
  );
}
