"use client";

import React, { useState, useEffect, useRef } from "react";
import { Mic, Headphones, ShieldAlert, Users, Radio, RefreshCw, Menu, X } from "lucide-react";
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

  // Drawer panel trigger state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Active participant list
  const [participantsList, setParticipantsList] = useState<VoiceParticipant[]>([]);

  // Refs for tracking active Room connection and state sync (avoids stale closures)
  const roomRef = useRef<Room | null>(null);
  const isLocalMutedRef = useRef(isLocalMuted);
  const isLocalDeafenedRef = useRef(isLocalDeafened);
  const volumeRef = useRef(volume);

  // Synchronize Refs with state changes
  useEffect(() => { isLocalMutedRef.current = isLocalMuted; }, [isLocalMuted]);
  useEffect(() => { isLocalDeafenedRef.current = isLocalDeafened; }, [isLocalDeafened]);
  useEffect(() => { volumeRef.current = volume; }, [volume]);

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

          // Apply current volume & deafen states
          const targetVol = isLocalDeafenedRef.current ? 0 : volumeRef.current / 100;
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

      // 6. Publish Local Microphone to the Voice Room
      await room.localParticipant.setMicrophoneEnabled(true);
      console.log("[VoiceSidebar] Microphone Enabled (published).");

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
          await room.localParticipant.setMicrophoneEnabled(!isLocalMuted);
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
        const targetVolume = isLocalDeafened ? 0 : volume / 100;
        
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
  }, [isLocalDeafened, volume]);

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
        .wave-bar:nth-child(3) { animation-delay: 0.30s; height: 14px; opacity: 0.6; }
        .wave-bar:nth-child(4) { animation-delay: 0.45s; height: 22px; opacity: 0.8; }
        .wave-bar:nth-child(5) { animation-delay: 0.60s; height: 10px; opacity: 0.5; }
      `}</style>

      {/* DESKTOP VIEW: Collapsed 64px Side Dock */}
      <div className="hidden lg:flex flex-col items-center gap-4 h-full w-full py-4 shrink-0">
        {/* Symmetrical Hamburger Button */}
        <button
          onClick={() => setIsDrawerOpen(!isDrawerOpen)}
          title={isConnected ? "Open Voice Participants Drawer" : "Join Voice Channel"}
          className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center border transition-all duration-200",
            isDrawerOpen
              ? "bg-[var(--primary)]/10 border-[var(--primary)]/30 text-[var(--primary)]"
              : "bg-white/5 border-white/5 text-white/75 hover:bg-white/10 hover:text-white"
          )}
        >
          <Menu className="w-4 h-4" />
        </button>

        {/* Connection Indicator Dot */}
        <div className="flex flex-col items-center gap-2 mt-2">
          <div 
            className={cn(
              "w-2 h-2 rounded-full transition-all duration-300",
              isConnected 
                ? "bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" 
                : "bg-white/20"
            )} 
            title={isConnected ? "Voice Connected" : "Voice Disconnected"} 
          />
          <span className={cn(
            "text-[7.5px] font-black uppercase tracking-[0.25em] text-center select-none [writing-mode:vertical-lr] transition-colors duration-300",
            isConnected ? "text-emerald-500/60" : "text-white/30"
          )}>
            {isConnected ? "Connected" : "Disconnected"}
          </span>
        </div>
      </div>

      {/* MOBILE VIEW: Compact Horizontal Top Header */}
      <div className="flex lg:hidden items-center justify-between px-4 h-full w-full">
        <div className="flex items-center gap-2">
          <span className={cn(
            "w-2 h-2 rounded-full transition-all duration-300",
            isConnected ? "bg-emerald-500 animate-pulse" : "bg-white/20"
          )} />
          <span className={cn(
            "text-[10px] font-bold uppercase tracking-wider transition-colors duration-300",
            isConnected ? "text-white/90" : "text-white/50"
          )}>
            {isConnected ? "Voice Connected" : "Voice Chat"}
          </span>
        </div>
        
        <button
          onClick={() => setIsDrawerOpen(true)}
          className="p-1.5 bg-white/5 border border-white/5 text-white/80 rounded-md hover:bg-white/10 hover:text-white transition-all flex items-center justify-center"
        >
          <Menu className="w-4 h-4" />
        </button>
      </div>

      {/* ================= PARTICIPANTS DRAWER ================= */}
      {/* Backdrop Blur Overlay */}
      {isDrawerOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[95] transition-opacity duration-300 animate-in fade-in"
          onClick={() => setIsDrawerOpen(false)}
        />
      )}

      {/* Drawer slide-out panel */}
      <div 
        className={cn(
          "fixed left-0 top-0 h-full w-[300px] bg-[#0A0A0E] border-r border-white/5 z-[100] transition-transform duration-300 ease-out flex flex-col shadow-2xl",
          isDrawerOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Drawer Header */}
        <div className="p-4 border-b border-white/5 flex items-center justify-between bg-[#0B0B0F]">
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" /> {isConnected ? `Voice Channels (${participantsList.length})` : "Voice Chat"}
          </span>
          <button 
            onClick={() => setIsDrawerOpen(false)}
            className="p-1.5 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Drawer Content */}
        {!isConnected ? (
          /* Disconnected State inside Drawer */
          <div className="flex-1 flex flex-col justify-center items-center text-center p-6 my-auto select-none">
            <div className="relative mb-6 flex items-end justify-center gap-1.5 h-10 w-20">
              <div className="wave-bar !h-5" />
              <div className="wave-bar !h-8" />
              <div className="wave-bar !h-10" />
              <div className="wave-bar !h-6" />
              <div className="wave-bar !h-4" />
            </div>

            <h3 className="text-xs font-bold text-white mb-2 tracking-tight uppercase tracking-wider">Talk in Real Time</h3>
            <p className="text-white/40 text-[10px] font-medium leading-relaxed max-w-[200px] mb-6">
              Join the room voice channel and talk with other participants in real time.
            </p>

            {/* Error Message Box */}
            {connectionState === 'error' && errorMsg && (
              <div className="w-full mb-5 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-left flex items-start gap-2.5 animate-in fade-in slide-in-from-top-1 duration-200">
                <ShieldAlert className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-bold text-red-400 uppercase tracking-wider mb-0.5">Connection Error</p>
                  <p className="text-[9px] text-white/70 leading-normal font-medium">{errorMsg}</p>
                </div>
              </div>
            )}

            <button
              onClick={handleJoinVoice}
              disabled={connectionState === 'connecting'}
              className="w-full btn-primary flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-xl"
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
          /* Connected State: Responsive Grid/Row Participant list and Controls Footer */
          <>
            <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
              <div 
                // Desktop: Responsive 3-column grid layout
                // Mobile: Vertical stack row layout
                className="grid grid-cols-1 gap-3"
              >
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

      {/* Settings Modal overlay */}
      <VoiceSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
