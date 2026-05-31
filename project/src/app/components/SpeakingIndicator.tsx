"use client";

import React from "react";
import { cn } from "../lib/utils";

interface SpeakingIndicatorProps {
  isSpeaking: boolean;
  children: React.ReactNode;
}

export function SpeakingIndicator({ isSpeaking, children }: SpeakingIndicatorProps) {
  return (
    <div className="relative inline-block">
      {/* Keyframe animation styling using the theme variable var(--primary) */}
      <style jsx global>{`
        @keyframes speaking-pulse-glow {
          0% {
            box-shadow: 0 0 0 0 var(--primary);
            opacity: 0.7;
          }
          70% {
            box-shadow: 0 0 0 8px var(--primary);
            opacity: 0;
          }
          100% {
            box-shadow: 0 0 0 0 var(--primary);
            opacity: 0;
          }
        }
        .speaking-glow-active {
          animation: speaking-pulse-glow 1.6s infinite cubic-bezier(0.4, 0, 0.2, 1);
        }
      `}</style>

      <div
        className={cn(
          "rounded-full transition-all duration-300 relative z-10",
          isSpeaking 
            ? "ring-2 ring-[var(--primary)] ring-offset-2 ring-offset-[#0B0B0F] speaking-glow-active" 
            : "ring-0 ring-transparent"
        )}
      >
        {children}
      </div>
      
      {/* Inner subtle glow for extra depth */}
      {isSpeaking && (
        <span 
          className="absolute inset-0 rounded-full border border-[var(--primary)]/40 animate-pulse pointer-events-none z-0 scale-105" 
          style={{ borderColor: 'var(--primary)' }}
        />
      )}
    </div>
  );
}
