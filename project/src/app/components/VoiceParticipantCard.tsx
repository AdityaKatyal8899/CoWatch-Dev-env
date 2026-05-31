"use client";

import React from "react";
import { Crown } from "lucide-react";
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
  profilePicture?: string;
}

interface VoiceParticipantCardProps {
  participant: VoiceParticipant;
  themeColor: string;
}

export function VoiceParticipantCard({ participant, themeColor }: VoiceParticipantCardProps) {
  // Generate initials for avatar presentation fallback
  const initials = participant.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className={cn(
        "flex transition-all duration-300 select-none items-center",
        // Desktop: Stack vertically (avatar top, name bottom), centered
        // Mobile: Align horizontally (avatar left, name right)
        "flex-row lg:flex-col gap-3 lg:gap-2 p-1.5 w-full lg:justify-center lg:text-center"
      )}
    >
      {/* Speaking Indicator around Avatar */}
      <SpeakingIndicator isSpeaking={participant.isSpeaking} themeColor={themeColor}>
        <div
          className={cn(
            "w-10 h-10 lg:w-12 lg:h-12 rounded-full flex items-center justify-center text-xs lg:text-sm font-bold transition-all duration-300 border shadow-inner shrink-0 overflow-hidden relative",
            participant.isSpeaking
              ? "bg-white/10 text-white"
              : "bg-white/5 text-white/50 border-white/10"
          )}
          style={participant.isSpeaking ? { borderColor: themeColor, color: themeColor } : {}}
        >
          {participant.profilePicture ? (
            <img 
              src={participant.profilePicture} 
              alt={participant.name} 
              className="w-full h-full object-cover rounded-full"
            />
          ) : (
            initials
          )}
        </div>
      </SpeakingIndicator>

      {/* Participant Details */}
      <div className="flex flex-row lg:flex-col items-center gap-1.5 min-w-0 text-left lg:text-center justify-start lg:justify-center">
        <span 
          className={cn(
            "text-xs lg:text-[11px] font-semibold tracking-wide truncate max-w-[130px] lg:max-w-[85px]",
            participant.isLocal ? "text-[var(--primary)] font-bold animate-pulse" : "text-white/90"
          )}
        >
          {participant.name}
        </span>
        
        {/* Host Crown Badge */}
        {participant.isHost && (
          <span title="Host / Presenter" className="inline-flex shrink-0">
            <Crown className="w-3.5 h-3.5 text-amber-500" fill="currentColor" />
          </span>
        )}
      </div>
    </div>
  );
}
