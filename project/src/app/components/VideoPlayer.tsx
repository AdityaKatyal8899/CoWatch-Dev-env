import { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import { Play, Pause, Volume2, VolumeX, Maximize, Settings, Lock, Unlock, RotateCcw, RotateCw } from 'lucide-react';
import type { SyncState } from '../lib/types';
import { api } from '../lib/api';
import { cn } from '../lib/utils';
import { Loader } from './ui/Loader';
import { motion, AnimatePresence } from 'motion/react';

interface VideoPlayerProps {
  streamUrl: string;
  isHost: boolean;
  onPlayStateChange?: (playing: boolean, time: number) => void;
  onSeek?: (currentTime: number) => void;
  onSyncReport?: (currentTime: number) => void;
  syncState?: SyncState;
  seekTrigger?: number;
  isRemoteEvent?: React.MutableRefObject<boolean>;
  hostName?: string;
}

export function VideoPlayer({
  streamUrl,
  isHost,
  onPlayStateChange,
  onSeek,
  onSyncReport,
  syncState,
  seekTrigger,
  isRemoteEvent,
  hostName = "Host"
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Player state (local UI only)
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(true); // Default to muted for autoplay safety
  const [isBuffering, setIsBuffering] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [isStreamReady, setIsStreamReady] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [vReadyState, setVReadyState] = useState(0);
  const [bufferDepth, setBufferDepth] = useState(0);
  const [hostAction, setHostAction] = useState<string | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const actionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Refs for sync stabilization
  const lastSeekTimeRef = useRef(0);
  const isSeekingRef = useRef(false);
  const isSyncLockedRef = useRef(false);
  const initializingRef = useRef(false);
  const lastSyncRef = useRef<SyncState | undefined>(undefined);
  const lastSeekTriggerRef = useRef(0);
  const isDriftInhibitedRef = useRef(false);
  const pausedAtRef = useRef(0); // PART 2: Reset Baseline
  const isSyncInhibitedRef = useRef(false);
  const actionCounter = useRef(0);
  const lastActionTime = useRef(0);
  const lastInteractionTimeRef = useRef(0);
  const hasInitialSyncRef = useRef(false);

  // Constants (CRITICAL CONFIG)
  const TARGET_OFFSET = 0.7;    // Optimized for 1s segments (stay ~0.7 segments behind host)
  const SAFETY_CEILING = 0.2;   // Min safety margin
  const SEEK_THRESHOLD = 1.0;   // Aggressive seek trigger
  const BUFFER_REQUIRED = 2.0;  // Minimum buffer to allow video.play()

  // Helper: Acquire sync lock for a set duration (defaults to 1s)
  const acquireSyncLock = useCallback((duration = 1000) => {
    isSyncLockedRef.current = true;

    setTimeout(() => {
      isSyncLockedRef.current = false;

    }, duration);
  }, []);

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Helper: Calculate seconds of data buffered ahead of a specific time
  const getBufferAhead = useCallback((timeToCheck?: number) => {
    const video = videoRef.current;
    if (!video) return 0;
    const time = timeToCheck !== undefined ? timeToCheck : video.currentTime;
    const { buffered } = video;
    for (let i = 0; i < buffered.length; i++) {
      if (time >= buffered.start(i) && time <= buffered.end(i)) {
        return buffered.end(i) - time;
      }
    }
    return 0;
  }, []);

  const lastEmitRef = useRef<number>(0);
  // ==========================================
  // RULE 1: SINGLE INITIALIZATION
  // HLS player initializes IMMEDIATELY
  // ==========================================
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamUrl || initializingRef.current) return;

    initializingRef.current = true;
    const fullSourceUrl = api.getStreamUrl(streamUrl);

    if (streamUrl.endsWith('.mp4')) {
      video.src = fullSourceUrl;
      setIsStreamReady(true);
    } else if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        maxBufferLength: 20,
        maxMaxBufferLength: 40,
        liveSyncDuration: 2,
        liveMaxLatencyDuration: 10,
        maxBufferHole: 0.5,
        startPosition: syncState?.currentTime || 0,
      });

      hlsRef.current = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsStreamReady(true);

        // Auto-play from initial sync if available
        if (lastSyncRef.current?.isPlaying && video.paused) {
          video.play().catch(err => {
            video.muted = true;
            video.play().catch(() => { });
          });
        }
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              initializingRef.current = false;
              setIsStreamReady(false);
              break;
          }
        }
      });

      hls.loadSource(fullSourceUrl);
      hls.attachMedia(video);

    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = fullSourceUrl;
      setIsStreamReady(true);
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      initializingRef.current = false;
    };
  }, [streamUrl]);

  // ==========================================
  // SYNC CORE: PRODUCTION ENGINE
  // ==========================================
  useEffect(() => {
    if (!syncState) return;
    const video = videoRef.current;

    // PART 0: INTERACTION ISOLATION GATE (CRITICAL)
    const timeSinceInteraction = Date.now() - lastInteractionTimeRef.current;
    if (isScrubbing || timeSinceInteraction < 800) {
      return;
    }

    const hls = hlsRef.current;

    // PART 0: EXTRACTION
    const { isPlaying: shouldPlay, currentTime: hostTime, streamStatus, action: msgAction } = syncState as any;
    if (!video) return;

    // RULE: Allow the first sync to happen even if readyState is 0, to trigger the correct segment loading
    if (vReadyState < 1 && hasInitialSyncRef.current) return;

    // INJECTION: HOST ACTION NOTIFICATION (VIEWERS ONLY)
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
    lastSyncRef.current = { isPlaying: shouldPlay, currentTime: hostTime, streamStatus, startedAt: (syncState as any).startedAt, updatedAt: (syncState as any).updatedAt };

    // INJECTION: Late-Joiner Catchup Guard
    if (msgAction === "sync_state" && !isHost) {
      if (!isRemoteEvent) return; // Guard against stale state
      isRemoteEvent.current = true; // Lock feedback loop
      video.currentTime = hostTime - 1.0; // Stay behind host for safety
      if (shouldPlay) video.play().catch(() => { });
      setTimeout(() => {
        if (isRemoteEvent) isRemoteEvent.current = false;
      }, 500);
      return;
    }

    // PART 1: TARGET CALCULATION
    let targetTime = Math.max(0, hostTime - (isHost ? 0 : TARGET_OFFSET));

    // STEP 4: Constrain Viewer Seeks to Live Window Boundaries
    if (!isHost) {
      const windowSize = 18; // 20 segment list size, strictly locking within 18s threshold for starvation safety
      const liveEdge = hostTime;
      const minAllowedTime = Math.max(0, liveEdge - windowSize);

      if (targetTime < minAllowedTime) {
        targetTime = minAllowedTime;
      }
    }

    // PART 2: HARD PAUSE / MIRROR STATE
    if (!shouldPlay || streamStatus !== 'live') {
      if (video.playbackRate !== 1.0) video.playbackRate = 1.0;
      setIsPlaying(false);
      if (!video.paused) video.pause();
      return;
    }

    // PART 3: HOST AUTHORITY GUARD
    // The host is the source of truth and should never be seeked by round-trip sync messages.
    if (isHost) return;

    // FIX BUFFER EXIT CONDITION
    const buffer = getBufferAhead();
    // DYNAMIC BUFFER GATE: Relax requirement for the start of the stream or initial join
    const minRequiredBuffer = (video.currentTime < 2.0 || !hasInitialSyncRef.current) ? 0.2 : 1.0;

    if (buffer >= minRequiredBuffer) {
      if (video.paused && shouldPlay) {
        video.play().catch(() => { });
        setIsPlaying(true);
        setIsBuffering(false);
      }
    }

    // INJECTION: Anti-Starvation Buffer Guard (Universal)
    const timeDelta = Math.abs(video.currentTime - targetTime);

    if (timeDelta > 2.0) {
      video.pause();
      video.currentTime = targetTime;

      const onCanPlay = () => {
        if (shouldPlay) video.play().catch(() => { });
        video.removeEventListener('canplay', onCanPlay);
      };
      video.addEventListener('canplay', onCanPlay);
      return;
    }

    // SAFE SYNC LOGIC (VIEWERS ONLY)
    // Host already returned above at Part 3

    // RULE: Viewer MUST STAY BEHIND the host
    if (video.currentTime > hostTime) {
      video.currentTime = hostTime - TARGET_OFFSET;
      return;
    }

    const drift = targetTime - video.currentTime;

    // 🚫 NEVER SEEK DURING SMALL DRIFT
    if (Math.abs(video.currentTime - targetTime) < 1.0) {
      if (drift > 0.1 && drift < 1.0) {
        video.playbackRate = 1.05;
      } else if (drift < -0.1) {
        video.playbackRate = 0.95;
      } else {
        video.playbackRate = 1.0;
      }
    } else {
      // INJECTION: Anti-Starvation Buffer Guard
      const timeDelta = Math.abs(video.currentTime - targetTime);

      if (timeDelta > 2) {
        video.pause();
        video.currentTime = targetTime;

        const onCanPlay = () => {
          if (shouldPlay) video.play().catch(() => { });
          video.removeEventListener('canplay', onCanPlay);
        };
        video.addEventListener('canplay', onCanPlay);
        return;
      }

      // 🔴 HARD SEEK FLOW 
      if (Math.abs(video.currentTime - targetTime) > 1.2 || !hasInitialSyncRef.current) {
        if (!isSeekingRef.current) {
          // 3. Buffer-Starvation Guard
          const buffered = getBufferAhead(targetTime);
          if (buffered === 0 && !isHost) {
            setIsBuffering(true);
            // Remove return to allow native seeking and buffer triggering
          }

          isSeekingRef.current = true;
          video.currentTime = targetTime;

          // FORCED AUTO-START (Kickstart playback for joiners)
          if (shouldPlay && !isHost) {
            video.play().catch(() => {
              video.muted = true;
              video.play().catch(() => { });
            });
          }

          // 1. Initial State Sync (ONLY ONCE ON JOIN)
          if (!hasInitialSyncRef.current) {
            hasInitialSyncRef.current = true;
            isRemoteEvent?.current && (isRemoteEvent.current = true);
            setTimeout(() => {
              isRemoteEvent?.current && (isRemoteEvent.current = false);
            }, 500);
          }

          setTimeout(() => {
            isSeekingRef.current = false;
          }, 800);
        }
      }
    }

  }, [syncState, isHost, seekTrigger, isScrubbing, vReadyState, getBufferAhead]);

  // ==========================================
  // RULE 7: HOST HEARTBEAT (500ms)
  // ==========================================
  useEffect(() => {
    if (!isHost || !isPlaying) return;

    const interval = setInterval(() => {
      const video = videoRef.current;
      // Host pulse logic: Only broadcast if not scrubbing (peeking)
      if (video && !video.paused && !isScrubbing) {
        onSyncReport?.(video.currentTime);
      }
    }, 500); // 500ms high-precision heartbeat

    return () => clearInterval(interval);
  }, [isHost, isPlaying, onSyncReport, isScrubbing]);

  // ==========================================
  // RULE 7: PRODUCTION AUTO-HIDE CONTROLS
  // ==========================================
  const resetControlsTimer = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }

    setShowControls(true);

    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 2000);
    }
  }, [isPlaying]);

  useEffect(() => {
    if (isPlaying) {
      resetControlsTimer();
    } else {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      setShowControls(true);
    }
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [isPlaying, resetControlsTimer]);

  // Track time updates
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    const handleDurationChange = () => {
      setDuration(video.duration);
    };

    // TASK: REAL-TIME BUFFER STATE BINDING
    const handleBufferingStart = () => {
      setIsBuffering(true);
      if (videoRef.current) setVReadyState(videoRef.current.readyState);
    };
    const handleBufferingEnd = () => {
      setIsBuffering(false);
      if (videoRef.current) setVReadyState(videoRef.current.readyState);
    };
    const handleReadyChange = () => {
      if (videoRef.current) {
        setVReadyState(videoRef.current.readyState);
        setBufferDepth(getBufferAhead());
      }
    };
    const handleProgress = () => {
      setBufferDepth(getBufferAhead());
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('loadedmetadata', handleReadyChange);

    // Binding native HTML5 video events to UI state
    video.addEventListener('progress', handleProgress);
    video.addEventListener('waiting', handleBufferingStart);
    video.addEventListener('stalled', handleBufferingStart);
    video.addEventListener('playing', handleBufferingEnd);
    video.addEventListener('canplay', handleBufferingEnd);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('loadedmetadata', handleReadyChange);
      video.removeEventListener('progress', handleProgress);
      video.removeEventListener('waiting', handleBufferingStart);
      video.removeEventListener('stalled', handleBufferingStart);
      video.removeEventListener('playing', handleBufferingEnd);
      video.removeEventListener('canplay', handleBufferingEnd);
    };
  }, [getBufferAhead]);

  // Host controls
  const handlePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video || !isHost || isLocked || isRemoteEvent?.current) return;

    // 4. Anti-Spam (Rate Limiting)
    const now = Date.now();
    if (now - lastActionTime.current < 1000) {
      if (actionCounter.current >= 5) return;
      actionCounter.current++;
    } else {
      actionCounter.current = 1;
      lastActionTime.current = now;
    }

    // Refresh interaction timestamp for isolation gate
    lastInteractionTimeRef.current = now;

    if (video.paused) {
      video.play().then(() => {
        setIsPlaying(true);
        onPlayStateChange?.(true, video.currentTime);
      }).catch(err => {
      });
    } else {
      video.pause();
      setIsPlaying(false);
      onPlayStateChange?.(false, video.currentTime);
    }
  }, [isHost, onPlayStateChange, isLocked, isRemoteEvent]);

  const handleSeek = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video || !isHost || isLocked || isRemoteEvent?.current) return;

    // 4. Anti-Spam (Rate Limiting)
    const now = Date.now();
    if (now - lastActionTime.current < 1000) {
      if (actionCounter.current >= 5) return;
      actionCounter.current++;
    } else {
      actionCounter.current = 1;
      lastActionTime.current = now;
    }

    // Refresh interaction timestamp for isolation gate
    lastInteractionTimeRef.current = now;

    // RULE: Max 1 seek per 800ms (Stabilization Mode)
    if (now - lastSeekTimeRef.current < 800) return;

    const newTime = Math.max(0, Math.min(time, video.duration || Infinity));

    // 1. Initiate Isolation
    isSeekingRef.current = true;
    lastInteractionTimeRef.current = now;
    lastSeekTimeRef.current = now;
    setIsScrubbing(false);

    // 4. Debounced Seek (300ms logic)
    setTimeout(() => {
      onSeek?.(newTime);
    }, 300);

    // 2. Set Time directly
    video.currentTime = newTime;

    // 3. Reliable completion listener
    const onSeeked = () => {
      setTimeout(() => {
        lastInteractionTimeRef.current = Date.now();
        isSeekingRef.current = false;
        setIsBuffering(false);
      }, 300);
      video.removeEventListener('seeked', onSeeked);
    };

    video.addEventListener('seeked', onSeeked);
  }, [isHost, onSeek, isLocked, isPlaying, isRemoteEvent]);

  const handlePeek = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video || !isHost || isLocked) return;

    // RULE: Auto-pause on scrub start to synchronize the "Peek" state across all viewers
    if (isPlaying && !isScrubbing) {
      handlePlayPause();
    }

    setIsScrubbing(true);
    lastInteractionTimeRef.current = Date.now();

    const newTime = Math.max(0, Math.min(time, video.duration || Infinity));

    // Broadcast throttled to prevent WebSocket Storms
    if (Date.now() - lastEmitRef.current > 500) {
      onSeek?.(newTime);
      lastEmitRef.current = Date.now();
    }

    // 2. Peek Time natively (paused visually)
    video.currentTime = newTime;
    setCurrentTime(newTime);
  }, [isHost, isLocked, onSeek]);

  const stepSeek = useCallback((offset: number) => {
    const video = videoRef.current;
    if (!video || !isHost || isLocked) return;
    handleSeek(video.currentTime + offset);
  }, [handleSeek, isHost, isLocked]);

  const handleVolumeChange = useCallback((newVolume: number) => {
    const video = videoRef.current;
    if (!video) return;

    const clampedVolume = Math.max(0, Math.min(newVolume, 1));
    video.volume = clampedVolume;
    setVolume(clampedVolume);
    setIsMuted(clampedVolume === 0);
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isMuted) {
      video.volume = volume || 0.5;
      setIsMuted(false);
    } else {
      video.volume = 0;
      setIsMuted(true);
    }
  }, [isMuted, volume]);

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
          handleVolumeChange(volume + 0.1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          handleVolumeChange(volume - 0.1);
          break;
        case 'KeyM':
          if (e.ctrlKey) {
            e.preventDefault();
            toggleMute();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isHost, isLocked, handlePlayPause, stepSeek, volume, handleVolumeChange, toggleMute]);

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(err => {

      });
    } else {
      document.exitFullscreen();
    }
  }, []);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-black rounded-2xl overflow-hidden group shadow-2xl transition-all duration-500"
      onMouseMove={resetControlsTimer}
      onClick={resetControlsTimer}
      onTouchStart={resetControlsTimer}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        className="w-full h-full"
        playsInline
        muted={isMuted}
      />

      {/* Buffering/Initializing Overlay */}
      {(isBuffering || !isStreamReady) && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm z-10 transition-all duration-300">
          <div className="flex flex-col items-center gap-6">
            <Loader size="lg" />
            <div className="flex flex-col items-center gap-1">
              <p className="text-white font-semibold text-lg tracking-wide text-center">
                {!isStreamReady ? 'Preparing Stream...' : (getBufferAhead() < BUFFER_REQUIRED ? 'Buffering...' : 'Smoothing Playback...')}
              </p>
              <p className="text-white/50 text-xs animate-pulse text-center">
                {(isBuffering && isPlaying) ? 'Securing buffer for stable experience' : 'Optimizing sync with host'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Controls Overlay */}
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent transition-all duration-500",
          showControls || isLocked ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
      >
        {/* Host Action Notification Overlay */}
        <AnimatePresence>
          {hostAction && (
            <motion.div
              initial={{ y: -20, opacity: 0, x: '-50%' }}
              animate={{ y: 0, opacity: 1, x: '-50%' }}
              exit={{ y: -20, opacity: 0, x: '-50%' }}
              className="absolute top-8 left-1/2 z-[60] pointer-events-none"
            >
              <div className="flex items-center gap-3 px-6 py-2.5 bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.8)]">
                <div className="w-2 h-2 rounded-full bg-[var(--primary)] animate-pulse shadow-[0_0_8px_var(--primary)]" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/90 whitespace-nowrap">
                  {hostAction}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
                onInput={(e) => handlePeek(parseFloat(e.currentTarget.value))}
                onChange={(e) => handleSeek(parseFloat(e.currentTarget.value))}
                className="absolute inset-0 w-full opacity-0 cursor-pointer"
              />
            )}
          </div>

          {/* Control Buttons Bottom Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Mini Play/Pause (Always visible but disabled if locked) */}
              <button
                onClick={handlePlayPause}
                disabled={!isHost || isLocked}
                className={`w-8 h-8 sm:w-10 sm:h-10 shrink-0 rounded-xl flex items-center justify-center transition-all ${isHost && !isLocked
                    ? 'bg-white/10 hover:bg-[var(--primary)] hover:text-black cursor-pointer'
                    : 'bg-white/5 opacity-50 cursor-not-allowed'
                  }`}
              >
                {isPlaying ? (
                  <Pause className="w-3.5 h-3.5" fill="currentColor" />
                ) : (
                  <Play className="w-3.5 h-3.5 ml-0.5" fill="currentColor" />
                )}
              </button>

              {/* Time Indicator */}
              <div className="text-white/80 text-[10px] sm:text-[11px] font-black uppercase tracking-[0.15em] bg-black/40 px-3 py-2 rounded-xl border border-white/5 backdrop-blur-xl shadow-inner-lg">
                {formatTime(currentTime)} <span className="text-white/20 mx-0.5">/</span> {formatTime(duration)}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Volume Group */}
              <div className="flex items-center gap-1 group/volume bg-black/40 rounded-xl p-1 border border-white/5 backdrop-blur-xl">
                <button
                  onClick={toggleMute}
                  className="w-8 h-8 shrink-0 rounded-lg hover:bg-white/10 flex items-center justify-center transition-all text-white/60 hover:text-white"
                >
                  {isMuted || volume === 0 ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                </button>
                <div className="w-0 group-hover/volume:w-16 sm:group-hover/volume:w-24 overflow-hidden transition-all duration-300">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={volume}
                    onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                    className="w-16 sm:w-24 h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-[var(--primary)]"
                  />
                </div>
              </div>

              {/* Host Specific: Lock Control */}
              {isHost && (
                <button
                  onClick={(e) => { e.stopPropagation(); setIsLocked(!isLocked); }}
                  title={isLocked ? "Unlock Controls" : "Lock Controls"}
                  className={`w-9 h-9 sm:w-10 sm:h-10 shrink-0 rounded-xl flex items-center justify-center transition-all border ${isLocked
                      ? 'bg-[var(--primary)] border-[var(--primary)]/40 text-black shadow-[0_0_20px_var(--primary)]'
                      : 'bg-black/40 border-white/10 text-white/40 hover:text-white hover:bg-white/10'
                    }`}
                >
                  {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                </button>
              )}

              {/* Fullscreen */}
              <button
                onClick={toggleFullscreen}
                className="w-9 h-9 sm:w-10 sm:h-10 shrink-0 rounded-xl bg-black/40 border border-white/10 text-white/60 hover:text-[var(--primary)] hover:border-[var(--primary)] flex items-center justify-center transition-all"
              >
                <Maximize className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
