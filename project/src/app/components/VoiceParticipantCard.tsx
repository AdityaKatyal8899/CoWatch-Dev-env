"use client";

import React from "react";
import { Mic, MicOff, Headphones, Crown } from "lucide-react";
import { SpeakingIndicator } from "./SpeakingIndicator";
import { cn } from "../lib/utils";

export interface VoiceParticipant {
  id: string;
  name: string;
  isMuted: boolean;
  isDeafened?: boolean;
  isSpeaking: boolean;
  isLocal?: boolean;
  isHost?: boolean;
}

interface VoiceParticipantCardProps {
  participant: VoiceParticipant;
}

export function VoiceParticipantCard({ participant }: VoiceParticipantCardProps) {
  // Generate initials for avatar
  const initials = participant.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-2.5 rounded-lg border transition-all duration-300",
        participant.isSpeaking
          ? "bg-[var(--primary)]/[0.03] border-[var(--primary)]/20"
          : "bg-white/[0.02] border-white/5 hover:border-white/10 hover:bg-white/[0.04]"
      )}
    >
      {/* Speaking Indicator around Avatar */}
      <SpeakingIndicator isSpeaking={participant.isSpeaking}>
        <div
          className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors select-none shrink-0 border",
            participant.isSpeaking
              ? "bg-[var(--primary)]/10 border-[var(--primary)]/30 text-[var(--primary)]"
              : "bg-white/5 border-white/10 text-white/50"
          )}
        >
          {initials}
        </div>
      </SpeakingIndicator>

      {/* Participant Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span 
            className={cn(
              "text-[10px] font-bold uppercase tracking-widest truncate transition-colors",
              participant.isLocal ? "text-[var(--primary)] font-extrabold" : "text-white/80"
            )}
          >
            {participant.name}
          </span>
          
          {/* Host Badge */}
          {participant.isHost && (
            <span title="Host / Presenter" className="inline-flex shrink-0">
              <Crown className="w-3 h-3 text-amber-500" fill="currentColor" />
            </span>
          )}

          {participant.isLocal && (
            <span className="text-[8px] font-extrabold uppercase tracking-wider text-[var(--primary)] bg-[var(--primary)]/10 px-1 py-0.5 rounded border border-[var(--primary)]/10 shrink-0 select-none">
              You
            </span>
          )}
        </div>
        
        {/* Status Line */}
        <p className="text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 mt-0.5 select-none">
          {participant.isDeafened ? (
            <span className="text-white/30 flex items-center gap-1">
              Deafened
            </span>
          ) : participant.isMuted ? (
            <span className="text-white/30 flex items-center gap-1">
              Muted
            </span>
          ) : (
            <span className="text-[var(--primary)] flex items-center gap-1 animate-pulse">
              Connected
            </span>
          )}
        </p>
      </div>

      {/* Right Icon Status Indicators */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Deafen status */}
        {participant.isDeafened && (
          <div className="w-6 h-6 rounded bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center">
            <Headphones className="w-3 h-3 opacity-60" />
          </div>
        )}
        
        {/* Mute status */}
        {(participant.isMuted || participant.isDeafened) ? (
          <div className="w-6 h-6 rounded bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center">
            <MicOff className="w-3 h-3" />
          </div>
        ) : (
          <div className="w-6 h-6 rounded bg-[var(--primary)]/10 border border-[var(--primary)]/20 text-[var(--primary)] flex items-center justify-center">
            <Mic className="w-3 h-3" />
          </div>
        )}
      </div>
    </div>
  );
}
