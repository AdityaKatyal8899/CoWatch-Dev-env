"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Play, Users, QrCode, Shield, Zap, Layout, ArrowRight, Sparkles, Video, Share2 } from 'lucide-react';

export default function LandingPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white selection:bg-[#9333EA]/30 selection:text-white overflow-x-hidden">
      {/* Background Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40rem] h-[40rem] bg-[var(--primary)]/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[20%] right-[-5%] w-[35rem] h-[35rem] bg-[var(--primary)]/10 rounded-full blur-[100px]" />
      </div>

      {/* Navigation */}
      <nav className="relative z-50 h-20 px-6 md:px-12 flex items-center justify-between border-b border-white/5 backdrop-blur-md bg-black/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[var(--primary)] rounded-xl flex items-center justify-center">
            <Play className="w-5 h-5 text-[var(--bg)]" fill="currentColor" />
          </div>
          <span className="text-xl font-black uppercase tracking-widest bg-clip-text text-transparent bg-gradient-to-r from-white to-white/50">
            CoWatch
          </span>
        </div>
        <div className="flex items-center gap-6">
          <Link href="/auth" className="text-sm font-bold text-white/60 hover:text-white transition-colors">
            Login
          </Link>
          <button 
            onClick={() => router.push('/auth')}
            className="px-6 py-2.5 bg-white text-black text-sm font-black rounded-xl hover:bg-white/90 transition-all active:scale-95"
          >
            Get Started
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-24 pb-20 px-6 text-center overflow-hidden">
        <div className="max-w-4xl mx-auto relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/5 border border-white/10 rounded-full mb-8 animate-in fade-in slide-in-from-top-4 duration-1000">
            <Sparkles className="w-4 h-4 text-[var(--primary)]" />
            <span className="text-xs font-bold uppercase tracking-widest text-white/70">Social Streaming Reinvented</span>
          </div>
          
          <h1 className="text-5xl md:text-8xl font-black leading-[1.1] mb-8 tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-white/20 animate-in fade-in slide-in-from-bottom-8 duration-1000">
            Watch Together, <br className="hidden md:block" />
            <span className="text-[var(--primary)]">Anywhere</span> in Sync.
          </h1>
          
          <p className="text-lg md:text-xl text-white/50 mb-12 max-w-2xl mx-auto leading-relaxed animate-in fade-in duration-1000 delay-300">
            The ultimate synchronized video platform. Upload your content, invite your friends via QR or Link, and enjoy seamless real-time playback control.
          </p>

          <div className="flex flex-col md:flex-row items-center justify-center gap-4 animate-in fade-in duration-1000 delay-500">
            <button 
              onClick={() => router.push('/auth')}
              className="w-full md:w-auto px-10 py-5 bg-[var(--primary)] hover:opacity-90 text-[var(--bg)] font-black text-lg rounded-2xl transition-all shadow-xl shadow-[var(--primary)]/20 hover:scale-105 active:scale-95 flex items-center justify-center gap-3"
            >
              Start Watching Now
              <ArrowRight className="w-6 h-6" />
            </button>
            <button 
              onClick={() => router.push('/join')}
              className="w-full md:w-auto px-10 py-5 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-black text-lg rounded-2xl transition-all"
            >
              Join a Party
            </button>
          </div>
        </div>

        {/* Hero Image Mockup Area */}
        <div className="mt-20 relative max-w-6xl mx-auto group animate-in fade-in slide-in-from-bottom-20 duration-1000 delay-700">
          <div className="absolute -inset-1 bg-[var(--primary)] rounded-[2.5rem] blur opacity-25 group-hover:opacity-40 transition duration-1000"></div>
          <div className="relative bg-[#1A1A1A] rounded-[2.5rem] border border-white/10 overflow-hidden shadow-2xl aspect-video md:aspect-[21/9] flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
               <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center">
                 <Play className="w-10 h-10 text-white/20" />
               </div>
               <span className="text-white/20 font-bold uppercase tracking-widest text-sm">Synchronized Engine Ready</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 px-6 md:px-12 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              icon: Zap,
              title: "Millisecond Sync",
              desc: "Engineered for zero-drift playback. Whether you pause or seek, everyone stays exactly on the same frame."
            },
            {
              icon: Share2,
              title: "Instant Invitations",
              desc: "Share your room instantly with high-res QR codes or simple links. No complicated setup required."
            },
            {
              icon: Layout,
              title: "Premium Player",
              desc: "A touch-optimized, mobile-responsive player with keyboard shortcuts, lock mode, and HLS streaming."
            }
          ].map((feat, i) => (
            <div key={i} className="p-8 bg-white/5 border border-white/10 rounded-3xl hover:bg-white/[0.07] transition-all group">
              <div className="w-12 h-12 bg-[var(--primary)]/20 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <feat.icon className="w-6 h-6 text-[var(--primary)]" />
              </div>
              <h3 className="text-xl font-black mb-3">{feat.title}</h3>
              <p className="text-white/50 leading-relaxed text-sm">{feat.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Call to Action Banner */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto bg-[var(--primary)] rounded-[3rem] p-12 md:p-20 text-center relative overflow-hidden shadow-2xl shadow-[var(--primary)]/20">
          {/* Decoration */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-black/20 rounded-full blur-3xl -ml-20 -mb-20" />

          <div className="relative z-10 text-[var(--bg)]">
            <h2 className="text-3xl md:text-5xl font-black mb-8 leading-tight">
              Ready to host your <br /> next watch party?
            </h2>
            <button 
              onClick={() => router.push('/auth')}
              className="px-12 py-5 bg-[var(--bg)] text-[var(--primary)] font-black text-xl rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-xl"
            >
              Get Started for Free
            </button>
            <p className="mt-8 opacity-70 text-sm font-bold uppercase tracking-widest">
              Join 1,000+ Synchronized Streamers
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 md:px-12 border-t border-white/5 text-center md:text-left">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
              <Play className="w-4 h-4 text-white" fill="white" />
            </div>
            <span className="font-black uppercase tracking-widest text-white/50 text-sm">
              CoWatch © 2026
            </span>
          </div>
          <div className="flex gap-8 text-sm font-bold text-white/40">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Twitter</a>
            <a href="#" className="hover:text-white transition-colors">Discord</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
