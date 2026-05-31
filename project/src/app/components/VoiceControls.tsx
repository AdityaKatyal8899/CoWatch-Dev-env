"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
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
  const [mounted, setMounted] = useState(false);
  const [showVolume, setShowVolume] = useState(false);
  const volumeRef = useRef<HTMLDivElement>(null);

  // Enable client-only portal mounting
  useEffect(() => {
    setMounted(true);
  }, []);

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

  if (!mounted) return null;

  const playerContainer = document.getElementById("video-player-container");
  if (!playerContainer) return null;

  // Custom Deafen Icon with a strike-through
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

  // Render the floating pill controls inside a React Portal (mounted in the player container)
  return createPortal(
    <div 
      className={cn(
        "absolute z-40 flex items-center gap-1.5 p-1.5",
        "bg-[#0B0B0F]/95 backdrop-blur-md border border-white/10 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
        "transition-all duration-300 select-none",
        // Desktop: Float over bottom-left of player, above playback controls (bottom-28)
        // Mobile: Float near bottom-left, above playback controls (bottom-24)
        "bottom-24 left-4 lg:bottom-28 lg:left-6"
      )}
    >
      {/* Mute/Unmute Button */}
      <button
        onClick={onToggleMute}
        disabled={isDeafened}
        title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 border",
          isDeafened
            ? "bg-white/[0.01] border-transparent text-white/20 cursor-not-allowed"
            : isMuted
              ? "bg-red-500/20 border-red-500/30 text-red-400 hover:bg-red-500/30"
              : "bg-white/5 border-white/5 text-white/70 hover:text-white hover:bg-white/10"
        )}
      >
        {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
      </button>

      {/* Deafen/Undeafen Button */}
      <button
        onClick={onToggleDeafen}
        title={isDeafened ? "Undeafen Audio" : "Deafen Audio"}
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 border",
          isDeafened
            ? "bg-red-500/20 border-red-500/30 text-red-400 hover:bg-red-500/30"
            : "bg-white/5 border-white/5 text-white/70 hover:text-white hover:bg-white/10"
        )}
      >
        <DeafenIcon active={isDeafened} />
      </button>

      {/* Volume Controller Trigger (Voice Output) */}
      <div className="relative" ref={volumeRef}>
        <button
          onClick={() => setShowVolume(!showVolume)}
          title="Adjust Speaker Volume & Destination"
          className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 border",
            volume === 0
              ? "bg-red-500/20 border-red-500/30 text-red-400 hover:bg-red-500/30"
              : "bg-white/5 border-white/5 text-white/70 hover:text-white hover:bg-white/10",
            showVolume && "bg-[var(--primary)]/10 border-[var(--primary)]/30 text-[var(--primary)]"
          )}
        >
          {volume === 0 ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
        </button>

        {/* Floating Voice Output Popover */}
        {showVolume && (
          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-[#0F0F14]/95 backdrop-blur-xl border border-white/10 p-3 rounded-2xl shadow-2xl z-50 flex flex-col gap-3 w-56 animate-in fade-in slide-in-from-bottom-2 duration-200 select-none">
            {/* Volume Section */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-wider text-white/40">
                <span>Speaker Volume</span>
                <span className="text-[var(--primary)] font-bold">{volume}%</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={(e) => onChangeVolume(Number(e.target.value))}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[var(--primary)]"
                />
              </div>
            </div>

            {/* Separator */}
            <div className="h-[1px] bg-white/5" />

            {/* Output Device Selection */}
            <div className="space-y-1">
              <span className="text-[9px] font-black uppercase tracking-wider text-white/40 block">
                Output Destination
              </span>
              <select
                defaultValue="default-out"
                className="w-full bg-[#161620] border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white/80 focus:outline-none focus:border-[var(--primary)] transition-colors cursor-pointer"
              >
                <option value="default-out">Default (System Speakers)</option>
                <option value="realtek-out">Built-in Speakers (Realtek)</option>
                <option value="headphone-out">Stereo Headphones (USB)</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Settings Button */}
      <button
        onClick={onOpenSettings}
        title="Voice Settings"
        className="w-8 h-8 rounded-full flex items-center justify-center border bg-white/5 border-white/5 text-white/70 hover:text-white hover:bg-white/10 transition-all duration-200"
      >
        <Settings className="w-3.5 h-3.5" />
      </button>

      {/* Separator */}
      <div className="w-[1px] h-4 bg-white/10 mx-1" />

      {/* Leave Voice Button */}
      <button
        onClick={onLeave}
        title="Leave Voice Channel"
        className="w-8 h-8 rounded-full flex items-center justify-center border bg-red-500/20 border-red-500/30 text-red-400 hover:bg-red-500/30 transition-all duration-200"
      >
        <PhoneOff className="w-3.5 h-3.5" />
      </button>
    </div>,
    playerContainer
  );
}
