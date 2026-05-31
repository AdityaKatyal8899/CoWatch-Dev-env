"use client";

import React, { useState, useRef, useEffect } from "react";
import { Mic, MicOff, Headphones, Settings, PhoneOff, Volume2, VolumeX } from "lucide-react";
import { cn } from "../lib/utils";

interface VoiceControlsProps {
  isMuted: boolean;
  onToggleMute: () => void;
  isDeafened: boolean;
  onToggleDeafen: () => void;
  volume: number; // 0 to 100
  onChangeVolume: (volume: number) => void;
  onOpenSettings: () => void;
  onLeave: () => void;
}

export function VoiceControls({
  isMuted,
  onToggleMute,
  isDeafened,
  onToggleDeafen,
  volume,
  onChangeVolume,
  onOpenSettings,
  onLeave,
}: VoiceControlsProps) {
  const [showVolume, setShowVolume] = useState(false);
  const volumeRef = useRef<HTMLDivElement>(null);

  // Close volume popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (volumeRef.current && !volumeRef.current.contains(event.target as Node)) {
        setShowVolume(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Custom Deafen Icon with a diagonal strike-through when active
  const DeafenIcon = ({ active }: { active: boolean }) => (
    <div className="relative">
      <Headphones className="w-4 h-4" />
      {active && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-5 h-[1.5px] bg-red-500 rotate-45 transform origin-center shadow-sm" />
        </div>
      )}
    </div>
  );

  return (
    <div className="p-4 bg-[#08080C] border-t border-white/5 flex flex-col gap-3 shrink-0 select-none">
      
      {/* Voice Status Header Bar */}
      <div className="flex items-center justify-between px-1">
        <div className="flex flex-col min-w-0">
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--primary)] animate-pulse">
            Voice Connected
          </span>
          <span className="text-[10px] text-white/40 truncate font-medium">
            Room Channel
          </span>
        </div>
        {/* Connection quality signal bars */}
        <div className="flex items-end gap-0.5 h-3">
          <div className="w-[2px] h-1.5 bg-[var(--primary)] rounded-full" />
          <div className="w-[2px] h-2 bg-[var(--primary)] rounded-full animate-pulse" />
          <div className="w-[2px] h-3 bg-[var(--primary)] rounded-full" />
        </div>
      </div>

      {/* Buttons Action Bar */}
      <div className="flex items-center justify-between gap-2 relative">
        
        {/* Mute/Unmute Button */}
        <button
          onClick={onToggleMute}
          disabled={isDeafened}
          title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
          className={cn(
            "w-9 h-9 rounded-lg flex items-center justify-center border transition-all duration-200",
            isDeafened
              ? "bg-white/[0.01] border-white/5 text-white/20 cursor-not-allowed"
              : isMuted
                ? "bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20"
                : "bg-white/5 border-white/5 text-white/70 hover:text-white hover:bg-white/10 hover:border-white/10"
          )}
        >
          {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        {/* Deafen/Undeafen Button */}
        <button
          onClick={onToggleDeafen}
          title={isDeafened ? "Undeafen Audio" : "Deafen Audio"}
          className={cn(
            "w-9 h-9 rounded-lg flex items-center justify-center border transition-all duration-200",
            isDeafened
              ? "bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20"
              : "bg-white/5 border-white/5 text-white/70 hover:text-white hover:bg-white/10 hover:border-white/10"
          )}
        >
          <DeafenIcon active={isDeafened} />
        </button>

        {/* Volume Controller Trigger */}
        <div className="relative" ref={volumeRef}>
          <button
            onClick={() => setShowVolume(!showVolume)}
            title="Adjust Speaker Volume"
            className={cn(
              "w-9 h-9 rounded-lg flex items-center justify-center border transition-all duration-200",
              volume === 0
                ? "bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20"
                : "bg-white/5 border-white/5 text-white/70 hover:text-white hover:bg-white/10 hover:border-white/10"
            )}
          >
            {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Floating Volume Slider Popover */}
          {showVolume && (
            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-[#121218] border border-white/10 p-3 rounded-lg shadow-2xl z-50 flex flex-col items-center gap-2 w-28 animate-in fade-in slide-in-from-bottom-2 duration-150">
              <span className="text-[9px] font-bold text-white/50 select-none uppercase tracking-wider">
                Volume: {volume}%
              </span>
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(e) => onChangeVolume(Number(e.target.value))}
                className="w-20 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[var(--primary)] my-1"
              />
              <button
                onClick={() => onChangeVolume(volume === 0 ? 80 : 0)}
                className="text-[9px] font-extrabold text-[var(--primary)] hover:text-purple-300 uppercase tracking-widest"
              >
                {volume === 0 ? "Restore" : "Mute"}
              </button>
            </div>
          )}
        </div>

        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          title="Voice Settings"
          className="w-9 h-9 rounded-lg flex items-center justify-center border bg-white/5 border-white/5 text-white/70 hover:text-white hover:bg-white/10 hover:border-white/10 transition-all duration-200"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Leave Voice Button */}
        <button
          onClick={onLeave}
          title="Leave Voice Channel"
          className="w-11 h-9 rounded-lg flex items-center justify-center border bg-red-500/10 hover:bg-red-500/20 border-red-500/20 text-red-500 transition-all duration-200 ml-auto"
        >
          <PhoneOff className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
