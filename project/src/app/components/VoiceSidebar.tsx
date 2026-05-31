"use client";

import React, { useState, useEffect } from "react";
import { Mic, Headphones, ShieldAlert, Users, Radio, RefreshCw, VolumeX } from "lucide-react";
import { VoiceParticipantCard, VoiceParticipant } from "./VoiceParticipantCard";
import { VoiceControls } from "./VoiceControls";
import { VoiceSettingsModal } from "./VoiceSettingsModal";
import { cn } from "../lib/utils";

interface VoiceSidebarProps {
  currentUser: {
    id: string;
    name: string;
    display_name?: string;
    theme?: string;
  } | null;
  hostId?: string;
  isHost?: boolean;
}

export function VoiceSidebar({ currentUser, hostId, isHost }: VoiceSidebarProps) {
  // Connection state machine: 'disconnected' | 'connecting' | 'connected' | 'error'
  const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Controls states
  const [isLocalMuted, setIsLocalMuted] = useState(false);
  const [isLocalDeafened, setIsLocalDeafened] = useState(false);
  const [volume, setVolume] = useState(80);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Local user details
  const localUserId = currentUser?.id || "local-user";
  const localUserName = currentUser?.display_name || currentUser?.name || "You";
  const isLocalHost = isHost || (currentUser && hostId ? currentUser.id === hostId : false);

  // Mock participants list state
  const [participants, setParticipants] = useState<VoiceParticipant[]>([
    { id: "p1", name: "Sarah Jenkins", isMuted: true, isSpeaking: false, isHost: !isLocalHost }, // Sarah is host if you are not
    { id: "p2", name: "Michael Chen", isMuted: false, isSpeaking: false },
    { id: "p3", name: "David K.", isMuted: false, isSpeaking: false },
  ]);

  // Handle local mic join logic with simulated connecting state
  const handleJoinVoice = async () => {
    setConnectionState('connecting');
    setErrorMsg(null);

    // Add a short artificial delay (1s) to show the connecting loading spinner state
    setTimeout(async () => {
      try {
        // Browser API call to request microphone permission
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // Stop all tracks immediately as this is UI only
        stream.getTracks().forEach((track) => track.stop());
        
        // Successfully connected
        setConnectionState('connected');
        setIsLocalMuted(false);
        setIsLocalDeafened(false);
      } catch (err: any) {
        console.error("[VoiceSidebar] Microphone permission error:", err);
        setConnectionState('error');
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          setErrorMsg("Permission Denied: Please click the camera/microphone icon in your URL bar and allow access.");
        } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
          setErrorMsg("No microphone found. Please connect an input device and try again.");
        } else {
          setErrorMsg("Unable to access microphone. Please check your system settings.");
        }
      }
    }, 1000);
  };

  // Leave channel logic
  const handleLeaveVoice = () => {
    setConnectionState('disconnected');
    setIsLocalMuted(false);
    setIsLocalDeafened(false);
    setErrorMsg(null);
  };

  // Sync mute state when deafen is toggled
  const handleToggleDeafen = () => {
    const nextDeafen = !isLocalDeafened;
    setIsLocalDeafened(nextDeafen);
    if (nextDeafen) {
      setIsLocalMuted(true);
    } else {
      setIsLocalMuted(false);
    }
  };

  const handleToggleMute = () => {
    if (isLocalDeafened) return; // Cannot unmute if deafened
    setIsLocalMuted(!isLocalMuted);
  };

  // Periodic active-speaker animation simulation (cycles speakers)
  useEffect(() => {
    if (connectionState !== 'connected') return;

    const interval = setInterval(() => {
      setParticipants((prev) => {
        // Find which participants can speak (not muted and not deafened)
        const activeCandidates = prev.filter((p) => !p.isMuted && !p.isDeafened);
        if (activeCandidates.length === 0) return prev;

        // Pick a random index or let no one speak
        const rand = Math.random();
        
        return prev.map((p) => {
          if (p.isMuted || p.isDeafened) return { ...p, isSpeaking: false };
          
          // 40% chance Michael (p2) speaks, 30% chance David (p3) speaks, else quiet
          if (p.id === "p2" && rand > 0.6) {
            return { ...p, isSpeaking: true };
          }
          if (p.id === "p3" && rand > 0.3 && rand <= 0.6) {
            return { ...p, isSpeaking: true };
          }
          return { ...p, isSpeaking: false };
        });
      });
    }, 2500);

    return () => clearInterval(interval);
  }, [connectionState]);

  // Combine local participant and external participants
  const localParticipantCard: VoiceParticipant = {
    id: localUserId,
    name: localUserName,
    isMuted: isLocalMuted,
    isDeafened: isLocalDeafened,
    isSpeaking: connectionState === 'connected' && !isLocalMuted && !isLocalDeafened && Math.random() > 0.85,
    isLocal: true,
    isHost: isLocalHost,
  };

  const allParticipants = [localParticipantCard, ...participants];

  return (
    <div className="w-full lg:w-[380px] bg-[#0B0B0F] border-b lg:border-b-0 lg:border-r border-white/5 flex flex-col flex-1 lg:flex-none lg:h-full shrink-0 min-h-0 relative select-none">
      
      {/* Soundwave wave pulse style block using theme color */}
      <style jsx>{`
        @keyframes wave-bounce {
          0%, 100% { transform: scaleY(0.4); }
          50% { transform: scaleY(1.1); }
        }
        .wave-bar {
          display: inline-block;
          width: 3px;
          height: 24px;
          background-color: var(--primary);
          border-radius: 9999px;
          transform-origin: bottom;
          animation: wave-bounce 1.2s ease-in-out infinite;
        }
        .wave-bar:nth-child(2) { animation-delay: 0.15s; height: 32px; opacity: 0.8; }
        .wave-bar:nth-child(3) { animation-delay: 0.30s; height: 18px; opacity: 0.6; }
        .wave-bar:nth-child(4) { animation-delay: 0.45s; height: 28px; opacity: 0.8; }
        .wave-bar:nth-child(5) { animation-delay: 0.60s; height: 14px; opacity: 0.5; }
      `}</style>

      {/* Voice Sidebar Header - Styled identical to the Chat Tab Headers */}
      <div className="flex border-b border-white/5 p-1.5">
        <div className="flex-1 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest bg-white/5 text-white text-center flex items-center justify-center gap-2 border border-white/5">
          <span className={cn(
            "w-1.5 h-1.5 rounded-full transition-colors duration-300",
            connectionState === 'connected' ? "bg-emerald-500 animate-pulse" : "bg-white/20"
          )} />
          {connectionState === 'connected' ? "Voice Connected" : "Voice Chat"}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 scrollbar-thin min-h-0 flex flex-col justify-between">
        
        {connectionState === 'disconnected' || connectionState === 'connecting' || connectionState === 'error' ? (
          /* Disconnected State Panel */
          <div className="flex-1 flex flex-col justify-center items-center text-center my-auto px-4">
            
            {/* Theme-Aware Soundwave Animation Graphic */}
            <div className="relative mb-6 flex items-end justify-center gap-1.5 h-12 w-24">
              <div className="wave-bar" />
              <div className="wave-bar" />
              <div className="wave-bar" />
              <div className="wave-bar" />
              <div className="wave-bar" />
            </div>

            <h3 className="text-sm font-bold text-white mb-2 tracking-tight">
              Talk in Real Time
            </h3>
            
            <p className="text-white/40 text-[11px] font-medium leading-relaxed max-w-[220px] mb-8">
              Join the room voice channel and talk with other participants in real time.
            </p>

            {/* Error Message Box */}
            {connectionState === 'error' && errorMsg && (
              <div className="w-full mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-left flex items-start gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
                <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-0.5">Connection Error</p>
                  <p className="text-[10px] text-white/70 leading-normal font-medium">{errorMsg}</p>
                </div>
              </div>
            )}

            {/* Redesigned Premium Action Button */}
            <button
              onClick={handleJoinVoice}
              disabled={connectionState === 'connecting'}
              className="w-full btn-primary flex items-center justify-center gap-2 py-3"
            >
              {connectionState === 'connecting' ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <Headphones className="w-3.5 h-3.5" />
                  <span>Join Voice</span>
                </>
              )}
            </button>
          </div>
        ) : (
          /* Connected State - Participant list */
          <div className="space-y-4 flex-1">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" /> Participants ({allParticipants.length})
              </span>
              <div className="flex items-center gap-1">
                <Radio className="w-3 h-3 text-emerald-500 animate-pulse" />
                <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-500">Live</span>
              </div>
            </div>

            <div className="space-y-2">
              {allParticipants.map((participant) => (
                <VoiceParticipantCard
                  key={participant.id}
                  participant={participant}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Voice Controls (Fixed at bottom when connected) */}
      {connectionState === 'connected' && (
        <VoiceControls
          isMuted={isLocalMuted}
          onToggleMute={handleToggleMute}
          isDeafened={isLocalDeafened}
          onToggleDeafen={handleToggleDeafen}
          volume={volume}
          onChangeVolume={(v) => setVolume(v)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onLeave={handleLeaveVoice}
        />
      )}

      {/* Settings Modal overlay */}
      <VoiceSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
