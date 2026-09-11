"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Mic, Headphones, ShieldAlert, Users, Radio, RefreshCw, Menu, X, Settings2 } from "lucide-react";
import { 
  Room, 
  RoomEvent, 
  Track, 
  ConnectionState,
  Participant,
  RemoteParticipant
} from "livekit-client";

import { VoiceParticipantCard, VoiceParticipant } from "./VoiceParticipantCard";
import { VoiceControls } from "./VoiceControls";
import { VoiceSettingsModal } from "./VoiceSettingsModal";
import { cn } from "../lib/utils";
import { api } from "../lib/api";
import { VoiceSettings, useVoiceSettings } from "../lib/audioSettings";
import type { User } from "../lib/types";

interface VoiceSidebarProps {
  currentUser: User | null;
  hostId?: string;
  isHost?: boolean;
  roomId: string;
  roomParticipants?: User[];
}

export function VoiceSidebar({ currentUser, hostId, isHost, roomId, roomParticipants = [] }: VoiceSidebarProps) {
  // Connection state machine: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error'
  const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error'>('disconnected');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Controls states
  const [isLocalMuted, setIsLocalMuted] = useState(false);
  const [isLocalDeafened, setIsLocalDeafened] = useState(false);
  const [volume, setVolume] = useState(80);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Persistent Audio Settings Hook
  const {
    settings: voiceSettings,
    updateSettings: updateVoiceSettings,
  } = useVoiceSettings();

  // Drawer panel trigger state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Active participant list
  const [participantsList, setParticipantsList] = useState<VoiceParticipant[]>([]);

  // Refs for tracking active Room connection and state sync (avoids stale closures)
  const roomRef = useRef<Room | null>(null);
  const isLocalMutedRef = useRef(isLocalMuted);
  const isLocalDeafenedRef = useRef(isLocalDeafened);
  const volumeRef = useRef(volume);
  const voiceSettingsRef = useRef(voiceSettings);

  // Synchronize Refs with state changes
  useEffect(() => { isLocalMutedRef.current = isLocalMuted; }, [isLocalMuted]);
  useEffect(() => { isLocalDeafenedRef.current = isLocalDeafened; }, [isLocalDeafened]);
  useEffect(() => { volumeRef.current = volume; }, [volume]);
  useEffect(() => { voiceSettingsRef.current = voiceSettings; }, [voiceSettings]);

  // Local user display helper
  const localUserName = currentUser?.display_name || currentUser?.name || "Guest User";
  const isLocalHost = isHost || (currentUser && hostId ? currentUser.id === hostId : false);

  // Recalculates participants in the UI list by querying active LiveKit room state
  const updateParticipantsList = () => {
    const room = roomRef.current;
    if (!room) return;

    const list: VoiceParticipant[] = [];

    // 1. Local Participant Card
    const local = room.localParticipant;
    if (local) {
      const matchedUser = roomParticipants.find(
        (u) => u.id.replace(/-/g, "").toLowerCase() === local.identity.replace(/-/g, "").toLowerCase()
      ) || currentUser;
      list.push({
        id: local.identity,
        name: local.name || local.identity,
        isMuted: !local.isMicrophoneEnabled,
        isDeafened: isLocalDeafenedRef.current,
        isSpeaking: local.isSpeaking,
        isLocal: true,
        isHost: isLocalHost,
        profilePicture: matchedUser?.profile_picture,
      });
    }

    // 2. Remote Participants Cards
    room.remoteParticipants.forEach((p) => {
      const isP_Host = hostId ? p.identity.replace(/-/g, "").toLowerCase() === hostId.replace(/-/g, "").toLowerCase() : false;
      const matchedUser = roomParticipants.find(
        (u) => u.id.replace(/-/g, "").toLowerCase() === p.identity.replace(/-/g, "").toLowerCase()
      );
      list.push({
        id: p.identity,
        name: p.name || p.identity,
        isMuted: !p.isMicrophoneEnabled,
        isSpeaking: p.isSpeaking,
        isLocal: false,
        isHost: isP_Host,
        profilePicture: matchedUser?.profile_picture,
      });
    });

    setParticipantsList(list);
  };

  // Helper to map participant ID to their selected CoWatch theme color
  const getParticipantThemeColor = (participantId: string) => {
    const pUser = roomParticipants.find(
      (u) => u.id.replace(/-/g, "").toLowerCase() === participantId.replace(/-/g, "").toLowerCase()
    );
    const themeName = pUser?.theme || "default-dark";

    if (themeName.startsWith('custom:')) {
      const [, , primary] = themeName.split(':');
      return primary || '#9333EA';
    }

    const PRESET_THEMES: Record<string, string> = {
      'default-dark': '#9333EA', // Primary CoWatch Purple
      'neo-purple': '#8B5CF6',
      'midnight-blue': '#3B82F6',
      'cyber-green': '#22C55E',
      'warm-minimal': '#F59E0B'
    };
    return PRESET_THEMES[themeName] || '#9333EA';
  };

  // Connect to LiveKit Room End-to-End
  const handleJoinVoice = async () => {
    setConnectionState('connecting');
    setErrorMsg(null);
    console.log(`[VoiceSidebar] Token Request: Initiating for room=${roomId}, user=${localUserName}`);

    try {
      // 1. Fetch token and LiveKit server URL
      const tokenResponse = await api.getLiveKitToken(roomId, localUserName, currentUser?.id);
      console.log("[VoiceSidebar] Token Received successfully:", tokenResponse);

      // 2. Instantiate LiveKit Room
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });
      roomRef.current = room;

      // 3. Register LiveKit Connection Event Listeners
      room.on(RoomEvent.Connected, () => {
        console.log("[VoiceSidebar] LiveKit Connected successfully!");
        setConnectionState('connected');
        updateParticipantsList();
      });

      room.on(RoomEvent.Disconnected, (reason) => {
        console.log("[VoiceSidebar] LiveKit Disconnected. Reason:", reason);
        handleLeaveVoice();
      });

      room.on(RoomEvent.Reconnecting, () => {
        console.log("[VoiceSidebar] LiveKit Reconnecting...");
        setConnectionState('reconnecting');
      });

      room.on(RoomEvent.Reconnected, () => {
        console.log("[VoiceSidebar] LiveKit Reconnected successfully!");
        setConnectionState('connected');
        updateParticipantsList();
      });

      // 4. Register Participant and Speaker Tracking Event Listeners
      room.on(RoomEvent.ParticipantConnected, (p: RemoteParticipant) => {
        console.log(`[VoiceSidebar] Participant Joined: ${p.identity}`);
        updateParticipantsList();
      });

      room.on(RoomEvent.ParticipantDisconnected, (p: RemoteParticipant) => {
        console.log(`[VoiceSidebar] Participant Left: ${p.identity}`);
        updateParticipantsList();
      });

      room.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
        updateParticipantsList();
      });

      room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        console.log(`[VoiceSidebar] Track Subscribed: kind=${track.kind} from participant=${participant.identity}`);
        
        if (track.kind === Track.Kind.Audio) {
          // Play remote audio track automatically by attaching it to DOM
          const audioEl = track.attach();
          document.body.appendChild(audioEl);

          // Route audio output device if custom sink specified
          if (voiceSettingsRef.current.outputDeviceId !== "default" && typeof (audioEl as any).setSinkId === "function") {
            (audioEl as any).setSinkId(voiceSettingsRef.current.outputDeviceId).catch((err: any) => {
              console.warn("[VoiceSidebar] setSinkId error on track subscription:", err);
            });
          }

          // Apply current volume & deafen states scaled by user voice settings
          const scaledVolume = (volumeRef.current / 100) * (voiceSettingsRef.current.outputVolume / 100);
          const targetVol = isLocalDeafenedRef.current ? 0 : Math.max(0, Math.min(1, scaledVolume));
          audioEl.volume = targetVol;
          console.log(`[VoiceSidebar] Audio Playback Started for ${participant.identity} with volume=${targetVol * 100}%`);
        }
        updateParticipantsList();
      });

      room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
        console.log(`[VoiceSidebar] Track Unsubscribed: kind=${track.kind} from participant=${participant.identity}`);
        if (track.kind === Track.Kind.Audio) {
          track.detach();
        }
        updateParticipantsList();
      });

      room.on(RoomEvent.TrackMuted, () => updateParticipantsList());
      room.on(RoomEvent.TrackUnmuted, () => updateParticipantsList());
      room.on(RoomEvent.LocalTrackPublished, () => {
        console.log("[VoiceSidebar] Local Microphone Track Published.");
        updateParticipantsList();
      });
      room.on(RoomEvent.LocalTrackUnpublished, () => {
        console.log("[VoiceSidebar] Local Microphone Track Unpublished.");
        updateParticipantsList();
      });

      // 5. Connect WebSocket to LiveKit Server
      await room.connect(tokenResponse.url, tokenResponse.token);

      // 6. Set custom output device if configured
      if (voiceSettingsRef.current.outputDeviceId !== "default") {
        try {
          await room.switchActiveDevice("audiooutput", voiceSettingsRef.current.outputDeviceId);
        } catch (devErr) {
          console.warn("[VoiceSidebar] Output device selection on connect:", devErr);
        }
      }

      // 7. Publish Local Microphone to the Voice Room with custom DSP constraints
      await room.localParticipant.setMicrophoneEnabled(true, {
        deviceId: voiceSettingsRef.current.inputDeviceId !== "default" ? voiceSettingsRef.current.inputDeviceId : undefined,
        echoCancellation: voiceSettingsRef.current.echoCancellation,
        noiseSuppression: voiceSettingsRef.current.noiseSuppression,
        autoGainControl: voiceSettingsRef.current.autoGainControl,
      });
      console.log("[VoiceSidebar] Microphone Enabled with audio DSP parameters:", {
        echoCancellation: voiceSettingsRef.current.echoCancellation,
        noiseSuppression: voiceSettingsRef.current.noiseSuppression,
        autoGainControl: voiceSettingsRef.current.autoGainControl,
      });

    } catch (err: any) {
      console.error("[VoiceSidebar] Connection Error:", err);
      setConnectionState('error');
      setErrorMsg(err.message || "Failed to establish a connection to the LiveKit voice server.");
    }
  };

  // Disconnect from LiveKit and reset states
  const handleLeaveVoice = () => {
    if (roomRef.current) {
      console.log("[VoiceSidebar] Leave Voice: Disconnecting from LiveKit room.");
      roomRef.current.disconnect();
      roomRef.current = null;
    }
    setConnectionState('disconnected');
    setParticipantsList([]);
    setIsDrawerOpen(false);
    setIsLocalMuted(false);
    setIsLocalDeafened(false);
    setErrorMsg(null);
  };

  // Synchronize mute/unmute state with LiveKit Room
  useEffect(() => {
    const syncMute = async () => {
      const room = roomRef.current;
      if (room && room.state === ConnectionState.Connected) {
        try {
          await room.localParticipant.setMicrophoneEnabled(!isLocalMuted, {
            deviceId: voiceSettingsRef.current.inputDeviceId !== "default" ? voiceSettingsRef.current.inputDeviceId : undefined,
            echoCancellation: voiceSettingsRef.current.echoCancellation,
            noiseSuppression: voiceSettingsRef.current.noiseSuppression,
            autoGainControl: voiceSettingsRef.current.autoGainControl,
          });
          console.log(`[VoiceSidebar] Local Mic published state synced to: ${!isLocalMuted}`);
        } catch (e) {
          console.error("[VoiceSidebar] Error syncing local microphone state:", e);
        }
        updateParticipantsList();
      }
    };
    syncMute();
  }, [isLocalMuted]);

  // Synchronize volume and deafen states with remote audio elements
  useEffect(() => {
    const syncVolume = () => {
      const room = roomRef.current;
      if (room) {
        const scaledVolume = (volume / 100) * (voiceSettings.outputVolume / 100);
        const targetVolume = isLocalDeafened ? 0 : Math.max(0, Math.min(1, scaledVolume));
        
        // Loop over participants and update volume parameters on subscribed audio tracks
        room.remoteParticipants.forEach((participant) => {
          participant.trackPublications.forEach((pub) => {
            if (pub.track && pub.track.kind === Track.Kind.Audio) {
              const audioTrack = pub.track;
              if (typeof (audioTrack as any).setVolume === 'function') {
                (audioTrack as any).setVolume(targetVolume);
              }
              
              // Also update any raw HTMLAudioElement instances volume directly
              const attachedElements = (audioTrack as any).attachedElements || [];
              attachedElements.forEach((el: HTMLAudioElement) => {
                el.volume = targetVolume;
              });
            }
          });
        });
        console.log(`[VoiceSidebar] Synced remote volume: ${targetVolume * 100}%`);
      }
    };
    syncVolume();
  }, [isLocalDeafened, volume, voiceSettings.outputVolume]);

  // Handle dynamic hardware device switching
  const handleDeviceSwitch = useCallback(async (kind: "audioinput" | "audiooutput", deviceId: string) => {
    const room = roomRef.current;
    if (room && room.state === ConnectionState.Connected) {
      try {
        await room.switchActiveDevice(kind, deviceId);
        console.log(`[VoiceSidebar] Switched active ${kind} device to: ${deviceId}`);

        if (kind === "audiooutput") {
          // Update all existing remote audio elements sinkId
          document.querySelectorAll("audio").forEach((el) => {
            if (typeof (el as any).setSinkId === "function") {
              (el as any).setSinkId(deviceId).catch((e: any) => console.warn("Sink ID update error:", e));
            }
          });
        }
      } catch (err) {
        console.warn(`[VoiceSidebar] Failed to switch ${kind} device:`, err);
      }
    }
  }, []);

  // Handle dynamic DSP constraints modification live during a call
  const handleSettingsChange = useCallback(async (newSettings: VoiceSettings) => {
    updateVoiceSettings(newSettings);
    const room = roomRef.current;
    if (room && room.state === ConnectionState.Connected && !isLocalMutedRef.current) {
      try {
        // Re-apply microphone track with new constraints seamlessly
        await room.localParticipant.setMicrophoneEnabled(false);
        await room.localParticipant.setMicrophoneEnabled(true, {
          deviceId: newSettings.inputDeviceId !== "default" ? newSettings.inputDeviceId : undefined,
          echoCancellation: newSettings.echoCancellation,
          noiseSuppression: newSettings.noiseSuppression,
          autoGainControl: newSettings.autoGainControl,
        });
        console.log("[VoiceSidebar] Live audio DSP constraints re-applied:", newSettings);
      } catch (e) {
        console.error("[VoiceSidebar] Failed to re-apply microphone constraints:", e);
      }
    }
  }, [updateVoiceSettings]);

  // Synchronize deafen states
  const handleToggleDeafen = () => {
    const nextDeafen = !isLocalDeafened;
    setIsLocalDeafened(nextDeafen);
    // Deafening automatically mutes microphone (standard Discord UX)
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

  // Safe cleanup on unmount
  useEffect(() => {
    return () => {
      if (roomRef.current) {
        console.log("[VoiceSidebar] Unmounting. Disconnecting LiveKit session.");
        roomRef.current.disconnect();
        roomRef.current = null;
      }
    };
  }, []);

  const isConnected = connectionState === 'connected' || connectionState === 'reconnecting';

  // Responsive outer sidebar classes
  const containerClasses = cn(
    "bg-[#0B0B0F] border-white/5 flex flex-col shrink-0 min-h-0 select-none transition-all duration-300 ease-in-out relative",
    // Always collapsed: Desktop collapses to 64px vertical strip, Mobile collapses to a 48px horizontal top bar
    "w-full h-12 border-b lg:w-[64px] lg:h-full lg:border-r lg:border-b-0 order-2 lg:order-none"
  );

  return (
    <div className={containerClasses}>
      
      {/* Soundwave animation helper block */}
      <style jsx>{`
        @keyframes wave-bounce {
          0%, 100% { transform: scaleY(0.4); }
          50% { transform: scaleY(1.1); }
        }
        .wave-bar {
          display: inline-block;
          width: 3px;
          height: 18px;
          background-color: var(--primary);
          border-radius: 9999px;
          transform-origin: bottom;
          animation: wave-bounce 1.2s ease-in-out infinite;
        }
        .wave-bar:nth-child(2) { animation-delay: 0.15s; height: 26px; opacity: 0.8; }
        .wave-bar:nth-child(3) { animation-delay: 0.3s; height: 14px; opacity: 0.6; }
      `}</style>

      {/* ========================================================================= */}
      {/* 1. COLLAPSED BAR: Desktop 64px vertical strip / Mobile 48px horizontal bar */}
      {/* ========================================================================= */}
      
      {/* Desktop Vertical Strip */}
      <div className="hidden lg:flex flex-col items-center justify-between h-full py-4 z-10 w-[64px]">
        {/* Top: Header Icon & Status Tooltip */}
        <div className="flex flex-col items-center gap-3">
          <div 
            onClick={() => setIsDrawerOpen(true)}
            className="w-10 h-10 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 hover:border-purple-500/30 transition-all cursor-pointer group relative"
            title="Open Voice Chat Panel"
          >
            <Radio className={cn("w-5 h-5 transition-transform group-hover:scale-110", isConnected ? "text-emerald-400" : "text-white/70")} />
            {isConnected && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-[#0B0B0F] animate-pulse" />
            )}
          </div>
          
          {/* Active Voice Indicator Strip */}
          {isConnected && (
            <div 
              onClick={() => setIsDrawerOpen(true)}
              className="flex items-center gap-0.5 py-1 px-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 cursor-pointer hover:bg-purple-500/20 transition-colors"
              title="Voice Connected (Click to expand)"
            >
              <div className="wave-bar !w-1 !h-3 !bg-emerald-400" />
              <div className="wave-bar !w-1 !h-4 !bg-emerald-400" />
              <div className="wave-bar !w-1 !h-2.5 !bg-emerald-400" />
            </div>
          )}
        </div>

        {/* Middle: Connected Participants Avatars Stack */}
        <div 
          onClick={() => setIsDrawerOpen(true)}
          className="flex flex-col items-center gap-1.5 cursor-pointer py-2 overflow-hidden max-h-[40vh]"
          title="View Participants"
        >
          {participantsList.slice(0, 4).map((p) => (
            <div 
              key={p.id}
              className={cn(
                "w-8 h-8 rounded-full border flex items-center justify-center text-xs font-bold transition-all relative",
                p.isSpeaking ? "border-emerald-400 scale-105 shadow-[0_0_8px_rgba(52,211,153,0.4)]" : "border-white/10 bg-white/5 text-white/70",
                p.isMuted && "opacity-50"
              )}
            >
              {p.profilePicture ? (
                <img src={p.profilePicture} alt={p.name} className="w-full h-full rounded-full object-cover" />
              ) : (
                p.name.charAt(0).toUpperCase()
              )}
              {p.isMuted && (
                <div className="absolute -bottom-0.5 -right-0.5 bg-red-500 rounded-full p-0.5 border border-[#0B0B0F]">
                  <Mic className="w-2 h-2 text-white" />
                </div>
              )}
            </div>
          ))}
          {participantsList.length > 4 && (
            <div className="w-7 h-7 rounded-full bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-[10px] font-bold text-purple-300">
              +{participantsList.length - 4}
            </div>
          )}
        </div>

        {/* Bottom: Quick Actions / Expand Button */}
        <div className="flex flex-col items-center gap-2">
          {isConnected ? (
            <button
              onClick={handleToggleMute}
              className={cn(
                "w-9 h-9 rounded-xl flex items-center justify-center transition-all border",
                isLocalMuted 
                  ? "bg-red-500/20 border-red-500/30 text-red-400 hover:bg-red-500/30" 
                  : "bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:text-white"
              )}
              title={isLocalMuted ? "Unmute Microphone" : "Mute Microphone"}
            >
              <Mic className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => {
                setIsDrawerOpen(true);
                handleJoinVoice();
              }}
              disabled={connectionState === 'connecting'}
              className="w-9 h-9 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-300 flex items-center justify-center hover:bg-purple-600 hover:text-white transition-all shadow-sm group"
              title="Join Voice Channel"
            >
              <Mic className="w-4 h-4 group-hover:scale-110 transition-transform" />
            </button>
          )}

          <button
            onClick={() => setIsDrawerOpen(true)}
            className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            title="Expand Voice Panel"
          >
            <Users className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mobile Top Bar Strip */}
      <div className="flex lg:hidden items-center justify-between h-12 px-4 w-full z-10">
        <div 
          onClick={() => setIsDrawerOpen(true)}
          className="flex items-center gap-2.5 cursor-pointer"
        >
          <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Radio className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white/90">Voice Channel</span>
            {isConnected ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                {participantsList.length} Connected
              </span>
            ) : (
              <span className="text-[10px] text-white/40">Disconnected</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isConnected && (
            <button
              onClick={handleToggleMute}
              className={cn(
                "p-1.5 rounded-lg border text-xs",
                isLocalMuted ? "bg-red-500/20 border-red-500/30 text-red-400" : "bg-white/5 border-white/10 text-white/70"
              )}
            >
              <Mic className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => setIsDrawerOpen(!isDrawerOpen)}
            className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:text-white transition-colors"
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>
      </div>


      {/* ========================================================================= */}
      {/* 2. EXPANDABLE FLOATING / OVERLAY DRAWER PANEL                             */}
      {/* ========================================================================= */}
      
      {/* Backdrop for click outside */}
      {isDrawerOpen && (
        <div 
          onClick={() => setIsDrawerOpen(false)}
          className="fixed inset-0 bg-black/50 backdrop-blur-xs z-40 transition-opacity"
        />
      )}

      {/* Drawer Body: Slid out horizontally on desktop from the left bar (64px), slide up on mobile */}
      <div 
        className={cn(
          "fixed z-50 bg-[#0E0E14] border-white/10 shadow-2xl flex flex-col transition-all duration-300 ease-out",
          // Desktop positioning: Slides out from left right next to the 64px strip
          "lg:top-0 lg:bottom-0 lg:left-[64px] lg:w-72 lg:border-r lg:rounded-none lg:max-h-none",
          // Mobile positioning: Bottom sheet drawer
          "max-lg:bottom-0 max-lg:left-0 max-lg:right-0 max-lg:max-h-[85vh] max-lg:rounded-t-2xl max-lg:border-t",
          isDrawerOpen 
            ? "translate-y-0 lg:translate-x-0 opacity-100 pointer-events-auto visible" 
            : "translate-y-full lg:-translate-x-full lg:translate-y-0 opacity-0 pointer-events-none invisible"
        )}
      >
        {/* Drawer Header */}
        <div className="p-4 border-b border-white/5 flex items-center justify-between bg-[#12121A]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Radio className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">Voice Channel</h2>
              <p className="text-[10px] text-white/40 font-medium">Low-latency Spatial WebRTC</p>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5">
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white flex items-center justify-center transition-colors"
              title="Voice & Audio Settings"
            >
              <Settings2 className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setIsDrawerOpen(false)}
              className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white flex items-center justify-center transition-colors"
              title="Close Panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Drawer Content Body */}
        {!isConnected ? (
          /* Disconnected / Join Voice CTA View */
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-[var(--primary)] shadow-[0_0_24px_rgba(147,51,234,0.15)]">
                <Mic className="w-7 h-7 text-[var(--primary)]" />
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white">Voice Channel Ready</h3>
              <p className="text-xs text-white/40 max-w-[200px] leading-relaxed">
                Join your room mates to talk, react, and watch together in real time.
              </p>
            </div>

            {errorMsg && (
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start gap-2 max-w-[220px] text-left">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-tight">{errorMsg}</span>
              </div>
            )}

            <button
              onClick={handleJoinVoice}
              disabled={connectionState === 'connecting'}
              className="btn-primary w-full max-w-[200px] py-2.5 text-xs font-bold shadow-lg shadow-purple-600/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {connectionState === 'connecting' ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4" />
                  <span>Join Voice</span>
                </>
              )}
            </button>
          </div>
        ) : (
          /* Connected State: Participants List & Controls */
          <>
            <div className="flex-1 flex flex-col min-h-0">
              <div className="p-3 bg-emerald-500/5 border-b border-emerald-500/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-semibold text-emerald-400">RTC Connected</span>
                </div>
                <span className="text-[10px] text-white/40 font-mono">
                  {participantsList.length} Active
                </span>
              </div>

              {/* Scrollable list of participant tiles */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                {participantsList.map((participant) => {
                  const themeColor = getParticipantThemeColor(participant.id);
                  return (
                    <VoiceParticipantCard
                      key={participant.id}
                      participant={participant}
                      themeColor={themeColor}
                    />
                  );
                })}
              </div>
            </div>

            {/* Symmetrical Inline Voice Controls Footer at the bottom of the Sidebar drawer */}
            <div className="p-4 border-t border-white/5 bg-[#0B0B0F]">
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
            </div>
          </>
        )}
      </div>

      {/* Settings Modal overlay with real device switching and live WebRTC audio constraints */}
      <VoiceSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        activeSettings={voiceSettings}
        onSettingsChange={handleSettingsChange}
        onDeviceSwitch={handleDeviceSwitch}
      />
    </div>
  );
}
