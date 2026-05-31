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
        "flex items-center transition-all duration-300 select-none",
        // Desktop: Stack vertically (avatar top, name bottom), centered
        // Mobile: Align horizontally (avatar left, name right)
        "flex-row lg:flex-col gap-2.5 lg:gap-1.5 p-1 lg:p-1.5 justify-start lg:justify-center lg:text-center w-full"
      )}
    >
      {/* Speaking Indicator around Avatar */}
      <SpeakingIndicator isSpeaking={participant.isSpeaking} themeColor={themeColor}>
        <div
          className={cn(
            "w-9 h-9 lg:w-11 lg:h-11 rounded-full flex items-center justify-center text-xs lg:text-sm font-bold transition-all duration-300 border shadow-inner shrink-0 overflow-hidden",
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
      <div className="flex flex-row lg:flex-col items-center gap-1.5 min-w-0 text-left lg:text-center">
        <span 
          className={cn(
            "text-[9px] lg:text-[10px] font-semibold tracking-wide truncate max-w-[125px] lg:max-w-[80px]",
            participant.isLocal ? "text-[var(--primary)] font-bold" : "text-white/85"
          )}
        >
          {participant.name}
        </span>
        
        {/* Host Crown Badge */}
        {participant.isHost && (
          <span title="Host / Presenter" className="inline-flex shrink-0">
            <Crown className="w-3 h-3 text-amber-500" fill="currentColor" />
          </span>
        )}
      </div>
    </div>
  );
}
