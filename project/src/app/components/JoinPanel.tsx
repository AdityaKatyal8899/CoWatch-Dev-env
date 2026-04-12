"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogIn, Link as LinkIcon, Hash, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';

export function JoinPanel() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCode.trim()) return;

    setLoading(true);
    try {
      // Create a guest identity if none exists
      let user = sessionStorage.getItem('currentUser');
      if (!user) {
        const guestUser = {
          id: `guest_${Math.random().toString(36).substr(2, 9)}`,
          name: `Guest_${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
          isHost: false
        };
        sessionStorage.setItem('currentUser', JSON.stringify(guestUser));
      }

      const result = await api.joinRoom(roomCode.trim(), JSON.parse(sessionStorage.getItem('currentUser')!).id, JSON.parse(sessionStorage.getItem('currentUser')!).name);
      
      if (result.success) {
        toast.success('Room found! Joining...');
        router.push(`/room/${roomCode.trim()}`);
      } else {
        toast.error(result.message || 'Room not found. Check the code.');
      }
    } catch (err) {
      toast.error('Failed to join room');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinByLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteLink.trim()) return;

    // Extract room ID from link
    // Supports http://localhost:3000/room/abcd-1234 or /stream/abcd-1234 or just the ID
    const match = inviteLink.match(/(?:room|stream)\/([a-zA-Z0-9-]+)/) || inviteLink.match(/^([a-zA-Z0-9-]+)$/);
    
    if (match && match[1]) {
      const id = match[1];
      toast.success('Link parsed! Joining...');
      router.push(`/room/${id}`);
    } else {
      toast.error('Invalid invite link format');
    }
  };

  return (
    <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-[#121212] rounded-[2rem] border border-white/10 shadow-2xl overflow-hidden relative">
        {/* Glow Effects */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-[#9333EA]/20 rounded-full blur-[80px]" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-[#3B82F6]/20 rounded-full blur-[80px]" />

        <div className="p-8 relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-gradient-to-br from-[#9333EA] to-[#4F46E5] rounded-2xl shadow-lg shadow-purple-500/20">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Join Party</h1>
              <p className="text-white/40 text-sm">Enter a code or link to start watching</p>
            </div>
          </div>

          <div className="space-y-8">
            {/* Join by Code */}
            <form onSubmit={handleJoinByCode} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-white/30 uppercase tracking-widest ml-1">
                  Room Code
                </label>
                <div className="relative group">
                  <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-[#9333EA] transition-colors" />
                  <input
                    type="text"
                    placeholder="e.g. abcd-1234"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[#9333EA]/50 focus:border-[#9333EA]/50 transition-all font-mono tracking-wider"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading || !roomCode.trim()}
                className="w-full py-4 bg-gradient-to-r from-[#9333EA] to-[#4F46E5] hover:from-[#7C3AED] hover:to-[#4338CA] text-white font-bold rounded-2xl transition-all shadow-lg hover:shadow-purple-500/25 flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Join via Code
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="relative flex items-center py-2">
              <div className="flex-1 border-t border-white/5"></div>
              <span className="px-4 text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">OR</span>
              <div className="flex-1 border-t border-white/5"></div>
            </div>

            {/* Join by Link */}
            <form onSubmit={handleJoinByLink} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-white/30 uppercase tracking-widest ml-1">
                  Invite Link
                </label>
                <div className="relative group">
                  <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-[#3B82F6] transition-colors" />
                  <input
                    type="url"
                    placeholder="Paste full URL here"
                    value={inviteLink}
                    onChange={(e) => setInviteLink(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6]/50 transition-all text-sm"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading || !inviteLink.trim()}
                className="w-full py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl border border-white/10 transition-all flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Join via Link
                <LogIn className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </form>
          </div>
        </div>
      </div>

      <p className="mt-8 text-center text-white/30 text-sm">
        New to CoWatch? <button onClick={() => router.push('/')} className="text-white/60 hover:text-white transition-colors underline decoration-white/20 underline-offset-4">Back to home</button>
      </p>
    </div>
  );
}
