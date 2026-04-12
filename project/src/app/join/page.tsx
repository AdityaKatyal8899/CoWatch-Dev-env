"use client";

import { JoinPanel } from '../components/JoinPanel';

export default function JoinPage() {
  return (
    <main className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center p-6 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#1A1A1A] via-[transparent] to-[transparent]">
      {/* Decorative background elements */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none opacity-20">
        <div className="absolute top-[10%] left-[5%] w-[40rem] h-[40rem] bg-[#9333EA] rounded-full blur-[150px]" />
        <div className="absolute bottom-[10%] right-[5%] w-[35rem] h-[35rem] bg-[#3B82F6] rounded-full blur-[150px]" />
      </div>

      <div className="relative z-10 w-full flex flex-col items-center">
        {/* Logo or Brand Name could go here */}
        <div className="mb-12 flex items-center gap-3">
          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center">
            <span className="text-black text-2xl font-black">C</span>
          </div>
          <span className="text-2xl font-black text-white tracking-widest uppercase">CoWatch</span>
        </div>

        <JoinPanel />
      </div>

      <footer className="mt-24 relative z-10">
        <p className="text-white/10 text-xs font-bold tracking-[0.3em] uppercase">
          Synchronized Playback Engine v1.0
        </p>
      </footer>
    </main>
  );
}
