"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Settings, Lock, Unlock, RotateCcw, RotateCw } from './icons';
import { cn } from '../lib/utils';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YouTubePlayerProps {
  videoId: string;
  isHost: boolean;
  onPlayStateChange?: (playing: boolean, time: number) => void;
  onSeek?: (currentTime: number) => void;
  onSyncReport?: (currentTime: number) => void;
  syncState?: any;
  seekTrigger?: number;
  isRemoteEvent?: React.MutableRefObject<boolean>;
  hostName?: string;
}

export function YouTubePlayer({
  videoId,
  isHost,
  onPlayStateChange,
  onSeek,
  onSyncReport,
  syncState,
  seekTrigger,
  isRemoteEvent,
  hostName = "Host"
}: YouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const iframeId = `yt-player-${videoId}`;

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [hostAction, setHostAction] = useState<string | null>(null);

  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const actionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncRef = useRef<any>(null);
  const lastInteractionTimeRef = useRef(0);
  const hasInitialSyncRef = useRef(false);
  const isSeekingRef = useRef(false);

  // Format Time Helper
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Reset controls hide timer
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (isLocked) return;
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  }, [isLocked]);

  useEffect(() => {
    resetControlsTimer();
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [resetControlsTimer]);

  // Load YouTube Iframe API dynamically
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }

    const checkInterval = setInterval(() => {
      if (window.YT && window.YT.Player) {
        clearInterval(checkInterval);
        initPlayer();
      }
    }, 100);

    function initPlayer() {
      playerRef.current = new window.YT.Player(iframeId, {
        height: '100%',
        width: '100%',
        videoId: videoId,
        playerVars: {
          autoplay: 0,
          controls: 0, // Disable native YouTube controls
          disablekb: 1,
          fs: 0,
          rel: 0,
          showinfo: 0,
          iv_load_policy: 3,
          modestbranding: 1,
          mute: 1 // Autoplay safety
        },
        events: {
          onReady: (event: any) => {
            console.log("[YouTubePlayer] onReady fired");
            setIsReady(true);
            setDuration(event.target.getDuration());
            
            // Set initial state from syncState if present
            if (syncState) {
              const { isPlaying: shouldPlay, currentTime: hostTime } = syncState;
              console.log("[YouTubePlayer] onReady initial syncState:", syncState);
              event.target.seekTo(hostTime || 0, true);
              if (shouldPlay) {
                event.target.playVideo();
                setIsPlaying(true);
              } else {
                event.target.pauseVideo();
                setIsPlaying(false);
              }
              hasInitialSyncRef.current = true;
            }
          },
          onStateChange: (event: any) => {
            const state = event.data;
            console.log("[YouTubePlayer] onStateChange:", state);
            if (state === window.YT.PlayerState.PLAYING) {
              setIsPlaying(true);
            } else if (state === window.YT.PlayerState.PAUSED) {
              setIsPlaying(false);
            }
          }
        }
      });
    }

    return () => {
      clearInterval(checkInterval);
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        playerRef.current.destroy();
      }
    };
  }, [videoId, iframeId]);

  // Update current time tracker interval
  useEffect(() => {
    const timeInterval = setInterval(() => {
      if (isReady && playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
        const time = playerRef.current.getCurrentTime();
        setCurrentTime(time);
        
        // Report time periodically if host
        if (isHost && isPlaying && onSyncReport) {
          onSyncReport(time);
        }
      }
    }, 500);

    return () => clearInterval(timeInterval);
  }, [isReady, isHost, isPlaying, onSyncReport]);

  // Host Action Notification Logic and state sync
  useEffect(() => {
    if (!syncState || !isReady || !playerRef.current || typeof playerRef.current.getPlayerState !== 'function') {
      console.log("[YouTubePlayer] syncState useEffect skipped:", { hasSyncState: !!syncState, isReady, hasPlayer: !!playerRef.current });
      return;
    }

    const timeSinceInteraction = Date.now() - lastInteractionTimeRef.current;
    if (timeSinceInteraction < 800) {
      console.log("[YouTubePlayer] syncState useEffect throttled due to user interaction");
      return;
    }

    const { isPlaying: shouldPlay, currentTime: rawHostTime } = syncState;
    if (rawHostTime === undefined || rawHostTime === null || !Number.isFinite(Number(rawHostTime))) {
      console.warn("[YouTubePlayer] syncState ignored due to non-finite/missing currentTime:", rawHostTime);
      return;
    }
    const hostTime = Number(rawHostTime);
    console.log("[YouTubePlayer] syncState useEffect running:", { isHost, shouldPlay, hostTime, hasInitialSync: hasInitialSyncRef.current });

    if (!isHost && lastSyncRef.current) {
      const prev = lastSyncRef.current;
      let actionMsg: string | null = null;

      if (prev.isPlaying !== shouldPlay) {
        actionMsg = shouldPlay ? `${hostName} resumed playback` : `${hostName} paused playback`;
      } else if (Math.abs(prev.currentTime - hostTime) > 3) {
        actionMsg = `${hostName} seeked to ${formatTime(hostTime)}`;
      }

      if (actionMsg) {
        setHostAction(actionMsg);
        if (actionTimeoutRef.current) clearTimeout(actionTimeoutRef.current);
        actionTimeoutRef.current = setTimeout(() => setHostAction(null), 3000);
      }
    }

    lastSyncRef.current = { isPlaying: shouldPlay, currentTime: hostTime };

    // Apply sync state to player
    if (!isHost) {
      const localTime = playerRef.current.getCurrentTime();
      const TARGET_OFFSET = 0.7;
      let targetTime = Math.max(0, hostTime - TARGET_OFFSET);
      console.log("[YouTubePlayer] Viewer sync status:", { localTime, hostTime, targetTime, isPlaying, shouldPlay, hasInitialSync: hasInitialSyncRef.current });

      // PART 2: HARD PAUSE / MIRROR STATE
      if (!shouldPlay) {
        setIsPlaying(false);
        const localState = playerRef.current.getPlayerState();
        if (localState === window.YT.PlayerState.PLAYING) {
          playerRef.current.pauseVideo();
        }
        return;
      }

      // RULE: Viewer MUST STAY BEHIND the host
      if (localTime > hostTime) {
        playerRef.current.seekTo(hostTime - TARGET_OFFSET, true);
        return;
      }

      const drift = targetTime - localTime;

      // playbackRate micro adjustment
      if (Math.abs(localTime - targetTime) < 1.0) {
        if (drift > 0.1 && drift < 1.0) {
          if (typeof playerRef.current.setPlaybackRate === 'function') {
            playerRef.current.setPlaybackRate(1.05);
          }
        } else if (drift < -0.1) {
          if (typeof playerRef.current.setPlaybackRate === 'function') {
            playerRef.current.setPlaybackRate(0.95);
          }
        } else {
          if (typeof playerRef.current.setPlaybackRate === 'function') {
            playerRef.current.setPlaybackRate(1.0);
          }
        }
      } else {
        // hard seek
        if (Math.abs(localTime - targetTime) > 1.2 || !hasInitialSyncRef.current) {
          if (!isSeekingRef.current) {
            isSeekingRef.current = true;
            if (isRemoteEvent) isRemoteEvent.current = true;

            playerRef.current.seekTo(targetTime, true);

            if (shouldPlay) {
              playerRef.current.playVideo();
              setIsPlaying(true);
            }

            hasInitialSyncRef.current = true;

            setTimeout(() => {
              isSeekingRef.current = false;
              if (isRemoteEvent) isRemoteEvent.current = false;
            }, 800);
          }
        }
      }
    }
  }, [syncState, isReady, isHost, hostName, isRemoteEvent, seekTrigger]);

  // Play Pause Handler
  const handlePlayPause = useCallback(() => {
    if (!isReady || !playerRef.current) return;
    lastInteractionTimeRef.current = Date.now();

    const player = playerRef.current;
    const state = player.getPlayerState();

    if (state === window.YT.PlayerState.PLAYING) {
      player.pauseVideo();
      setIsPlaying(false);
      if (onPlayStateChange) onPlayStateChange(false, player.getCurrentTime());
    } else {
      player.playVideo();
      setIsPlaying(true);
      if (onPlayStateChange) onPlayStateChange(true, player.getCurrentTime());
    }
  }, [isReady, onPlayStateChange]);

  // Seek Handler
  const handleSeek = useCallback((time: number) => {
    if (!isReady || !playerRef.current) return;
    lastInteractionTimeRef.current = Date.now();

    playerRef.current.seekTo(time, true);
    setCurrentTime(time);
    if (onSeek) onSeek(time);
  }, [isReady, onSeek]);

  // Skip step seeker
  const stepSeek = useCallback((offset: number) => {
    if (!isReady || !playerRef.current) return;
    const nextTime = Math.max(0, Math.min(duration, playerRef.current.getCurrentTime() + offset));
    handleSeek(nextTime);
  }, [isReady, duration, handleSeek]);

  // Mute / Volume handlers
  const toggleMute = useCallback(() => {
    if (!isReady || !playerRef.current) return;
    const player = playerRef.current;
    if (player.isMuted()) {
      player.unMute();
      setIsMuted(false);
    } else {
      player.mute();
      setIsMuted(true);
    }
  }, [isReady]);

  const handleVolumeChange = useCallback((val: number) => {
    if (!isReady || !playerRef.current) return;
    playerRef.current.setVolume(val);
    setVolume(val);
    if (val > 0 && isMuted) {
      playerRef.current.unMute();
      setIsMuted(false);
    }
  }, [isReady, isMuted]);

  // Fullscreen Handler
  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen();
    }
  }, []);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          if (isHost && !isLocked) handlePlayPause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (isHost && !isLocked) stepSeek(-10);
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (isHost && !isLocked) stepSeek(10);
          break;
        case 'ArrowUp':
          e.preventDefault();
          handleVolumeChange(Math.min(100, volume + 10));
          break;
        case 'ArrowDown':
          e.preventDefault();
          handleVolumeChange(Math.max(0, volume - 10));
          break;
        case 'KeyM':
          e.preventDefault();
          toggleMute();
          break;
        case 'KeyF':
          e.preventDefault();
          toggleFullscreen();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isHost, isLocked, handlePlayPause, stepSeek, volume, handleVolumeChange, toggleMute, toggleFullscreen]);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-black rounded-2xl overflow-hidden group shadow-2xl transition-all duration-500"
      onMouseMove={resetControlsTimer}
      onClick={resetControlsTimer}
    >
      {/* YouTube Iframe element container */}
      <div className="w-full h-full pointer-events-none">
        <div id={iframeId} className="w-full h-full" />
      </div>

      {/* Initialize Loader */}
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm z-10">
          <div className="flex flex-col items-center gap-6">
            <div className="w-10 h-10 border-4 border-white/20 border-t-[var(--primary)] rounded-full animate-spin" />
            <p className="text-white font-semibold text-lg tracking-wide text-center">Loading YouTube Player...</p>
          </div>
        </div>
      )}

      {/* Controls Overlay */}
      {isReady && (
        <div
          className={cn(
            "absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent transition-all duration-500",
            showControls ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          )}
        >
          {/* Host Action Notification Overlay */}
          {hostAction && (
            <div className="absolute top-8 left-1/2 z-[60] pointer-events-none transform -translate-x-1/2 transition-all duration-300 opacity-100">
              <div className="flex items-center gap-3 px-6 py-2.5 bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.8)]">
                <div className="w-2 h-2 rounded-full bg-[var(--primary)] animate-pulse shadow-[0_0_8px_var(--primary)]" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/90 whitespace-nowrap">
                  {hostAction}
                </span>
              </div>
            </div>
          )}

          {/* Top Indicators */}
          <div className="absolute top-6 left-6 flex items-center gap-3">
            {isLocked && (
              <div className="flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-[var(--bg)] text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-[var(--primary)]/40 animate-pulse backdrop-blur-md">
                <Lock className="w-3.5 h-3.5" />
                Controls Locked
              </div>
            )}
          </div>

          {/* Center Play/Seek Controls (Host Only) */}
          {isHost && !isLocked && (
            <div className="absolute inset-0 flex items-center justify-center gap-6 sm:gap-12 pointer-events-none">
              <button
                onClick={(e) => { e.stopPropagation(); stepSeek(-10); }}
                className="p-4 sm:p-5 bg-black/20 hover:bg-white/10 rounded-full border border-white/5 backdrop-blur-xl transition-all group active:scale-90 pointer-events-auto shadow-2xl"
              >
                <RotateCcw className="w-5 h-5 sm:w-8 sm:h-8 text-white/70 group-hover:text-white" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handlePlayPause(); }}
                className="w-14 h-14 sm:w-20 sm:h-20 bg-white text-black rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(255,255,255,0.2)] hover:scale-105 active:scale-95 transition-all pointer-events-auto"
              >
                {isPlaying ? <Pause className="w-6 h-6 sm:w-10 sm:h-10" fill="black" /> : <Play className="w-6 h-6 sm:w-10 sm:h-10 ml-1" fill="black" />}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); stepSeek(10); }}
                className="p-4 sm:p-5 bg-black/20 hover:bg-white/10 rounded-full border border-white/5 backdrop-blur-xl transition-all group active:scale-90 pointer-events-auto shadow-2xl"
              >
                <RotateCw className="w-5 h-5 sm:w-8 sm:h-8 text-white/70 group-hover:text-white" />
              </button>
            </div>
          )}

          {/* Bottom Controls */}
          <div className="absolute bottom-0 left-0 right-0 p-4 lg:p-6 space-y-4">
            {/* Progress Bar Area */}
            <div className={`relative group/progress transition-all duration-300 ${isLocked ? 'opacity-30 pointer-events-none' : ''}`}>
              <div className="h-1.5 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
                <div
                  className="h-full bg-[var(--primary)] transition-all duration-100 relative"
                  style={{ width: `${progressPercent}%` }}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg shadow-[var(--primary)]/50" />
                </div>
              </div>
              {isHost && (
                <input
                  type="range"
                  min="0"
                  max={duration || 100}
                  value={currentTime}
                  onChange={(e) => handleSeek(parseFloat(e.currentTarget.value))}
                  className="absolute inset-0 w-full opacity-0 cursor-pointer"
                />
              )}
            </div>

            {/* Control Buttons Bottom Bar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {/* Time Indicator */}
                <div className="text-white/80 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.15em] bg-black/40 px-2.5 py-1.5 rounded-lg border border-white/5 backdrop-blur-xl shadow-inner-lg">
                  {formatTime(currentTime)} <span className="text-white/20 mx-0.5">/</span> {formatTime(duration)}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Volume Group */}
                <div className="flex items-center gap-0.5 group/volume bg-black/40 rounded-lg p-0.5 border border-white/5 backdrop-blur-xl">
                  <button
                    onClick={toggleMute}
                    className="w-7 h-7 shrink-0 rounded-md hover:bg-white/10 flex items-center justify-center transition-all text-white/60 hover:text-white"
                  >
                    {isMuted || volume === 0 ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                  </button>
                  <div className="w-0 group-hover/volume:w-16 sm:group-hover/volume:w-20 overflow-hidden transition-all duration-300">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={volume}
                      onChange={(e) => handleVolumeChange(parseInt(e.target.value))}
                      className="w-16 sm:w-20 h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-[var(--primary)]"
                    />
                  </div>
                </div>

                {/* Host Specific: Lock Control */}
                {isHost && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setIsLocked(!isLocked); }}
                    title={isLocked ? "Unlock Controls" : "Lock Controls"}
                    className={`w-7 h-7 shrink-0 rounded-lg flex items-center justify-center transition-all border ${isLocked
                        ? 'bg-[var(--primary)] border-[var(--primary)]/40 text-black shadow-[0_0_15px_var(--primary)]'
                        : 'bg-black/40 border-white/10 text-white/40 hover:text-white hover:bg-white/10'
                      }`}
                  >
                    {isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                  </button>
                )}

                {/* Fullscreen */}
                <button
                  onClick={toggleFullscreen}
                  className="w-7 h-7 shrink-0 rounded-lg bg-black/40 border border-white/10 text-white/60 hover:text-[var(--primary)] hover:border-[var(--primary)] flex items-center justify-center transition-all"
                >
                  <Maximize className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
