"use client";

import React from "react";
import { cn } from "../lib/utils";

interface SpeakingIndicatorProps {
  isSpeaking: boolean;
  themeColor: string;
  children: React.ReactNode;
}

export function SpeakingIndicator({ isSpeaking, themeColor, children }: SpeakingIndicatorProps) {
  return (
    <div 
      className="relative inline-block"
      style={{ "--speaking-theme-color": themeColor } as React.CSSProperties}
    >
      {/* Keyframe animation using the participant's dynamic themeColor custom property */}
      <style jsx global>{`
        @keyframes speaking-theme-pulse {
          0% {
            box-shadow: 0 0 0 0 var(--speaking-theme-color);
            opacity: 0.8;
          }
          70% {
            box-shadow: 0 0 0 10px var(--speaking-theme-color);
            opacity: 0;
          }
          100% {
            box-shadow: 0 0 0 0 var(--speaking-theme-color);
            opacity: 0;
          }
        }
        .speaking-glow-dynamic {
          animation: speaking-theme-pulse 1.4s infinite cubic-bezier(0.4, 0, 0.2, 1);
        }
      `}</style>

      <div
        className={cn(
          "rounded-full transition-all duration-300 relative z-10",
          isSpeaking 
            ? "ring-2 ring-offset-2 ring-offset-[#0B0B0F] speaking-glow-dynamic" 
            : "ring-0 ring-transparent"
        )}
        style={isSpeaking ? { borderColor: themeColor } : {}}
      >
        {children}
      </div>
      
      {/* Inner audio-reactive glowing wave */}
      {isSpeaking && (
        <span 
          className="absolute inset-0 rounded-full border animate-pulse pointer-events-none z-0 scale-105" 
          style={{ borderColor: `${themeColor}40` }}
        />
      )}
    </div>
  );
}
