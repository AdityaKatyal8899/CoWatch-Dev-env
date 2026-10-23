"use client";

// Triggering rebuild for production deployment
import { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Pause, Volume2, VolumeX, Volume1, Maximize2, Minimize2, RectangleHorizontal, Settings, Lock, Unlock, RotateCcw, RotateCw, Languages, Check, Scan, Sun, SunMedium, SunDim } from './icons';
import type { SyncState, AudioTrackInfo } from '../lib/types';
import { api } from '../lib/api';
import { cn } from '../lib/utils';
import { Loader } from './ui/Loader';
import { toast } from 'sonner';


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
  activeAudioTrack?: { track_id: number; track_name?: string; language?: string } | null;
  onAudioTrackChange?: (trackId: number, trackName?: string, language?: string) => void;
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
  hostName = "Host",
  activeAudioTrack,
  onAudioTrackChange
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
  const [audioTracks, setAudioTracks] = useState<AudioTrackInfo[]>([]);
  const [selectedAudioTrack, setSelectedAudioTrack] = useState<number>(0);
  const [showAudioMenu, setShowAudioMenu] = useState<boolean>(false);
  const [seekFeedback, setSeekFeedback] = useState<{ type: 'backward' | 'forward'; id: number } | null>(null);
  
  // Viewport Aspect Ratio / Zoom-to-Fill modes ('contain' = original, 'cover' = zoom to fill, 'fill' = stretch)
  type AspectMode = 'contain' | 'cover' | 'fill';
  const [aspectMode, setAspectMode] = useState<AspectMode>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('cowatch_player_aspect') as AspectMode) || 'contain';
    }
    return 'contain';
  });
  const [aspectBadge, setAspectBadge] = useState<string | null>(null);
  const aspectBadgeTimer = useRef<NodeJS.Timeout | null>(null);
  const lastTouchTapRef = useRef<number>(0);

  const cycleAspectMode = useCallback(() => {
    setAspectMode((prev) => {
      const next: AspectMode = prev === 'contain' ? 'cover' : prev === 'cover' ? 'fill' : 'contain';
      const label = next === 'cover' ? 'Zoom to Fill (Cover)' : next === 'fill' ? 'Stretch (Fill Screen)' : 'Original Fit';
      setAspectBadge(label);
      if (aspectBadgeTimer.current) clearTimeout(aspectBadgeTimer.current);
      aspectBadgeTimer.current = setTimeout(() => setAspectBadge(null), 2200);
      return next;
    });
  }, []);

  // Brightness Control (0.2 to 1.5, default 1.0)
  const [brightness, setBrightness] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('cowatch_player_brightness');
      return saved ? parseFloat(saved) : 1.0;
    }
    return 1.0;
  });

  // Mobile / Gesture HUD Indicator ('brightness' | 'volume')
  const [activeGestureHUD, setActiveGestureHUD] = useState<'brightness' | 'volume' | null>(null);
  const gestureHUDTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartRef = useRef<{
    startX: number;
    startY: number;
    type: 'brightness' | 'volume' | null;
    initialVal: number;
    isDragging: boolean;
  } | null>(null);

  const showHUD = useCallback((type: 'brightness' | 'volume') => {
    setActiveGestureHUD(type);
    if (gestureHUDTimeoutRef.current) clearTimeout(gestureHUDTimeoutRef.current);
    gestureHUDTimeoutRef.current = setTimeout(() => {
      setActiveGestureHUD(null);
    }, 1400);
  }, []);

  const handleBrightnessChange = useCallback((newVal: number) => {
    const clamped = Math.max(0.2, Math.min(1.5, Math.round(newVal * 100) / 100));
    setBrightness(clamped);
    if (typeof window !== 'undefined') {
      localStorage.setItem('cowatch_player_brightness', clamped.toString());
    }
    showHUD('brightness');
  }, [showHUD]);

  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const actionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const seekFeedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const triggerSeekAnimation = useCallback((direction: 'backward' | 'forward') => {
    if (seekFeedbackTimeoutRef.current) clearTimeout(seekFeedbackTimeoutRef.current);
    setSeekFeedback({ type: direction, id: Date.now() });
    seekFeedbackTimeoutRef.current = setTimeout(() => {
      setSeekFeedback(null);
    }, 650);
  }, []);

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
  const activeAudioTrackRef = useRef(activeAudioTrack);
  useEffect(() => {
    activeAudioTrackRef.current = activeAudioTrack;
  }, [activeAudioTrack]);

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

      const syncAudioTracks = () => {
        if (hls.audioTracks && hls.audioTracks.length > 0) {
          const mapped: AudioTrackInfo[] = hls.audioTracks.map((t, idx) => ({
            id: idx,
            name: t.name || t.lang || `Track ${idx + 1}`,
            language: t.lang || undefined,
            default: t.default,
          }));
          setAudioTracks(mapped);

          const active = activeAudioTrackRef.current;
          const activeId = active ? (typeof active.track_id === 'number' ? active.track_id : (active as any).trackId) : null;
          if (!isHost && typeof activeId === 'number' && activeId >= 0 && activeId < hls.audioTracks.length) {
            hls.audioTrack = activeId;
            setSelectedAudioTrack(activeId);
            return;
          }
          setSelectedAudioTrack(hls.audioTrack >= 0 ? hls.audioTrack : 0);
        }
      };

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsStreamReady(true);
        syncAudioTracks();

        // Auto-play from initial sync if available
        if (lastSyncRef.current?.isPlaying && video.paused) {
          video.play().catch(err => {
            video.muted = true;
            video.play().catch(() => { });
          });
        }
      });

      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, () => {
        syncAudioTracks();
      });

      hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (event, data) => {
        setSelectedAudioTrack(data.id);
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
    const { isPlaying: shouldPlay, currentTime: rawHostTime, streamStatus, action: msgAction } = syncState as any;
    if (!video) return;

    if (rawHostTime === undefined || rawHostTime === null || !Number.isFinite(Number(rawHostTime))) {
      console.warn("[VideoPlayer] syncState ignored due to non-finite/missing currentTime:", rawHostTime);
      return;
    }
    const hostTime = Number(rawHostTime);

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
  // RULE 7: PRODUCTION AUTO-HIDE CONTROLS (2s Netflix Dissolve)
  // ==========================================
  const resetControlsTimer = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }

    setShowControls(true);

    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
        setShowAudioMenu(false);
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

    const duration = (video.duration && Number.isFinite(video.duration)) ? video.duration : Infinity;
    const computedTime = Math.max(0, Math.min(time, duration));
    const newTime = Number.isFinite(computedTime) ? computedTime : 0;

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

    const duration = (video.duration && Number.isFinite(video.duration)) ? video.duration : Infinity;
    const computedTime = Math.max(0, Math.min(time, duration));
    const newTime = Number.isFinite(computedTime) ? computedTime : 0;

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
    triggerSeekAnimation(offset < 0 ? 'backward' : 'forward');
    handleSeek(video.currentTime + offset);
  }, [handleSeek, isHost, isLocked, triggerSeekAnimation]);

  const handleVolumeChange = useCallback((newVolume: number) => {
    const video = videoRef.current;
    if (!video) return;

    const clampedVolume = Math.max(0, Math.min(newVolume, 1));
    video.volume = clampedVolume;
    setVolume(clampedVolume);
    setIsMuted(clampedVolume === 0);
    showHUD('volume');
  }, [showHUD]);

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

  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

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

  // Viewer auto-follow: Sync active audio track from Host
  useEffect(() => {
    if (!isHost && activeAudioTrack && hlsRef.current) {
      const rawId = activeAudioTrack.track_id ?? (activeAudioTrack as any).trackId;
      if (typeof rawId === 'number' && rawId >= 0) {
        const targetTrackId = rawId;
        if (hlsRef.current.audioTracks.length > targetTrackId && hlsRef.current.audioTrack !== targetTrackId) {
          hlsRef.current.audioTrack = targetTrackId;
          setSelectedAudioTrack(targetTrackId);
          const track = audioTracks.find(t => t.id === targetTrackId) || audioTracks[targetTrackId];
          toast.info(`Audio set to ${track?.name || activeAudioTrack.track_name || 'Host selection'}`);
        }
      }
    }
  }, [activeAudioTrack, isHost, audioTracks]);

  const handleAudioTrackChange = useCallback((trackId: number) => {
    if (!isHost) {
      toast.info("Audio language is managed by the Host");
      return;
    }
    const hls = hlsRef.current;
    if (hls && trackId >= 0 && trackId < hls.audioTracks.length) {
      hls.audioTrack = trackId;
      setSelectedAudioTrack(trackId);
      setShowAudioMenu(false);
      const track = audioTracks.find(t => t.id === trackId) || audioTracks[trackId];
      const trackName = track?.name || `Track ${trackId + 1}`;
      toast.success(`Switched audio to ${trackName}`);
      onAudioTrackChange?.(trackId, track?.name, track?.language);
    }
  }, [isHost, audioTracks, onAudioTrackChange]);

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
          handleVolumeChange(volume + 0.05);
          break;
        case 'ArrowDown':
          e.preventDefault();
          handleVolumeChange(volume - 0.05);
          break;
        case 'BracketLeft':
          e.preventDefault();
          handleBrightnessChange(brightness - 0.08);
          break;
        case 'BracketRight':
          e.preventDefault();
          handleBrightnessChange(brightness + 0.08);
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
  }, [isHost, isLocked, handlePlayPause, stepSeek, volume, handleVolumeChange, toggleMute, toggleFullscreen, brightness, handleBrightnessChange]);

  // Touch Swipe Handlers for Dual-Zone Brightness (Left) & Volume (Right)
  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    resetControlsTimer();
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const relativeY = touch.clientY - rect.top;
    const relativeX = touch.clientX - rect.left;

    // Ignore gestures in top 55px (status headers) and bottom 75px (seek bar & control buttons)
    if (relativeY < 55 || relativeY > rect.height - 75) {
      touchStartRef.current = null;
      return;
    }

    const isLeft = relativeX < rect.width / 2;
    touchStartRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      type: isLeft ? 'brightness' : 'volume',
      initialVal: isLeft ? brightness : (videoRef.current ? videoRef.current.volume : volume),
      isDragging: false,
    };
  }, [brightness, volume, resetControlsTimer]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (!touchStartRef.current || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const container = containerRef.current;
    if (!container) return;

    const deltaY = touchStartRef.current.startY - touch.clientY; // UP is positive
    const deltaX = Math.abs(touch.clientX - touchStartRef.current.startX);

    // Threshold to engage swipe gesture
    if (!touchStartRef.current.isDragging) {
      if (Math.abs(deltaY) > 8 && Math.abs(deltaY) > deltaX) {
        touchStartRef.current.isDragging = true;
      } else {
        return;
      }
    }

    const rect = container.getBoundingClientRect();
    const swipeRange = Math.max(160, rect.height * 0.45);
    const progressDelta = deltaY / swipeRange;

    if (touchStartRef.current.type === 'brightness') {
      const newBright = touchStartRef.current.initialVal + progressDelta * 1.3;
      handleBrightnessChange(newBright);
    } else if (touchStartRef.current.type === 'volume') {
      const newVol = touchStartRef.current.initialVal + progressDelta * 1.0;
      handleVolumeChange(newVol);
    }
  }, [handleBrightnessChange, handleVolumeChange]);

  // Double Click / Double Tap Action: Left side = Rewind 10s, Right side = Seek 10s forward
  const handleDoubleAction = useCallback((clientX: number) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const isRight = (clientX - rect.left) > rect.width / 2;
    if (isRight) {
      stepSeek(10);
    } else {
      stepSeek(-10);
    }
  }, [stepSeek]);

  const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    const wasDragging = touchStartRef.current?.isDragging;
    const startX = touchStartRef.current?.startX ?? (e.changedTouches?.[0]?.clientX || 0);
    touchStartRef.current = null;

    if (!wasDragging) {
      const now = Date.now();
      if (now - lastTouchTapRef.current < 320) {
        handleDoubleAction(startX);
      }
      lastTouchTapRef.current = now;
    }
  }, [handleDoubleAction]);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-black rounded-2xl overflow-hidden group shadow-2xl transition-all duration-500 select-none touch-none"
      onMouseMove={resetControlsTimer}
      onClick={resetControlsTimer}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onDoubleClick={(e) => handleDoubleAction(e.clientX)}
    >
      {/* Video Element with Dynamic Viewport Aspect Ratio & Brightness Filter */}
      <video
        ref={videoRef}
        style={{ filter: `brightness(${brightness})` }}
        className={cn(
          "w-full h-full transition-[object-fit] duration-300",
          aspectMode === 'cover' && "object-cover",
          aspectMode === 'fill' && "object-fill",
          aspectMode === 'contain' && "object-contain"
        )}
        playsInline
        muted={isMuted}
      />

      {/* Floating Brightness HUD (Left Side Gesture Indicator) */}
      <AnimatePresence>
        {activeGestureHUD === 'brightness' && (
          <motion.div
            initial={{ opacity: 0, x: -24, y: '-50%', scale: 0.9 }}
            animate={{ opacity: 1, x: 0, y: '-50%', scale: 1 }}
            exit={{ opacity: 0, x: -24, y: '-50%', scale: 0.9 }}
            transition={{ type: "spring", stiffness: 420, damping: 26 }}
            className="absolute left-3 sm:left-8 top-1/2 z-50 pointer-events-none flex flex-col items-center gap-2 sm:gap-2.5 px-2.5 sm:px-3 py-3 sm:py-4 rounded-2xl bg-black/85 backdrop-blur-2xl border border-amber-500/30 shadow-[0_16px_48px_rgba(0,0,0,0.85),0_0_24px_rgba(245,158,11,0.2)]"
          >
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-400">
              {brightness < 0.6 ? (
                <SunDim className="w-4 h-4 sm:w-5 sm:h-5" />
              ) : brightness < 1.1 ? (
                <SunMedium className="w-4 h-4 sm:w-5 sm:h-5" />
              ) : (
                <Sun className="w-4 h-4 sm:w-5 sm:h-5 drop-shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
              )}
            </div>
            {/* Vertical Slider Track */}
            <div className="w-2 sm:w-2.5 h-20 sm:h-28 bg-white/10 rounded-full overflow-hidden flex flex-col justify-end p-0.5 border border-white/5">
              <div
                className="w-full rounded-full bg-gradient-to-t from-amber-600 via-amber-400 to-amber-300 transition-all duration-75 shadow-[0_0_12px_rgba(245,158,11,0.7)]"
                style={{ height: `${Math.max(4, Math.min(100, ((brightness - 0.2) / 1.3) * 100))}%` }}
              />
            </div>
            {/* Value Label */}
            <span className="text-[9px] sm:text-[11px] font-black text-amber-300 font-mono tracking-tight">
              {Math.round(brightness * 100)}%
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Volume HUD (Right Side Gesture Indicator) */}
      <AnimatePresence>
        {activeGestureHUD === 'volume' && (
          <motion.div
            initial={{ opacity: 0, x: 24, y: '-50%', scale: 0.9 }}
            animate={{ opacity: 1, x: 0, y: '-50%', scale: 1 }}
            exit={{ opacity: 0, x: 24, y: '-50%', scale: 0.9 }}
            transition={{ type: "spring", stiffness: 420, damping: 26 }}
            className="absolute right-3 sm:right-8 top-1/2 z-50 pointer-events-none flex flex-col items-center gap-2 sm:gap-2.5 px-2.5 sm:px-3 py-3 sm:py-4 rounded-2xl bg-black/85 backdrop-blur-2xl border border-[var(--primary)]/30 shadow-[0_16px_48px_rgba(0,0,0,0.85),0_0_24px_rgba(139,92,246,0.25)]"
          >
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-[var(--primary)]/15 flex items-center justify-center text-[var(--primary)]">
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
              ) : volume < 0.5 ? (
                <Volume1 className="w-4 h-4 sm:w-5 sm:h-5" />
              ) : (
                <Volume2 className="w-4 h-4 sm:w-5 sm:h-5 drop-shadow-[0_0_8px_var(--primary)]" />
              )}
            </div>
            {/* Vertical Slider Track */}
            <div className="w-2 sm:w-2.5 h-20 sm:h-28 bg-white/10 rounded-full overflow-hidden flex flex-col justify-end p-0.5 border border-white/5">
              <div
                className="w-full rounded-full bg-gradient-to-t from-indigo-500 via-[var(--primary)] to-purple-300 transition-all duration-75 shadow-[0_0_12px_var(--primary)]"
                style={{ height: `${isMuted ? 0 : Math.round(volume * 100)}%` }}
              />
            </div>
            {/* Value Label */}
            <span className="text-[9px] sm:text-[11px] font-black text-purple-300 font-mono tracking-tight">
              {isMuted ? 'MUTED' : `${Math.round(volume * 100)}%`}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Aspect Mode Feedback Pill Badge */}
      <AnimatePresence>
        {aspectBadge && (
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute top-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none px-4 py-2 rounded-full bg-black/85 backdrop-blur-2xl border border-white/20 text-white text-xs font-bold tracking-wide shadow-[0_8px_32px_rgba(0,0,0,0.8)] flex items-center gap-2"
          >
            <Scan className="w-4 h-4 text-[var(--primary)]" />
            <span>{aspectBadge}</span>
          </motion.div>
        )}
      </AnimatePresence>

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
          "absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent transition-opacity duration-300 ease-out",
          showControls ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
      >
        {/* Host Action Notification Overlay */}
        {hostAction && (
          <div
            className="absolute top-8 left-1/2 z-[60] pointer-events-none transform -translate-x-1/2 transition-all duration-300 opacity-100"
          >
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
            <div 
              className="flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-[var(--primary)]/40 animate-pulse backdrop-blur-md"
              style={{ background: 'var(--primary-gradient, var(--primary))', color: 'var(--primary-foreground, #ffffff)' }}
            >
              <Lock className="w-3.5 h-3.5" />
              Controls Locked
            </div>
          )}
        </div>

        {/* Center Play/Seek Controls (Host Only - Netflix Style Modular Floating Buttons) */}
        {isHost && !isLocked && (
          <div className="absolute inset-0 flex items-center justify-center gap-4 sm:gap-12 md:gap-20 pointer-events-none select-none">
            {/* 10s Rewind with Subtle Spring Micro-Animation */}
            <button
              onClick={(e) => { e.stopPropagation(); stepSeek(-10); }}
              className="relative group flex flex-col items-center justify-center p-1.5 sm:p-3 text-white/90 hover:text-white hover:scale-110 active:scale-90 transition-all duration-200 cursor-pointer pointer-events-auto filter drop-shadow-[0_4px_16px_rgba(0,0,0,0.85)] focus:outline-none"
              title="Rewind 10 seconds"
              aria-label="Rewind 10 seconds"
            >
              <AnimatePresence>
                {seekFeedback?.type === 'backward' && (
                  <motion.div
                    key={seekFeedback.id}
                    initial={{ opacity: 0, y: 4, scale: 0.7 }}
                    animate={{ opacity: 1, y: -18, scale: 1.05 }}
                    exit={{ opacity: 0, y: -26, scale: 0.85 }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    className="absolute -top-3 pointer-events-none px-1.5 py-0.5 rounded-full bg-white/20 border border-white/25 backdrop-blur-md text-white font-black text-[8px] sm:text-[10px] tracking-tight shadow-[0_0_12px_rgba(255,255,255,0.4)]"
                  >
                    -10s
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.div 
                animate={seekFeedback?.type === 'backward' ? { rotate: -40, scale: 1.15 } : { rotate: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 450, damping: 15 }}
                className="relative flex items-center justify-center"
              >
                <RotateCcw className="w-6 h-6 sm:w-9 sm:h-9 md:w-11 md:h-11 text-white stroke-[1.75]" />
                <span className="absolute text-[7px] sm:text-[10px] font-black text-white select-none pointer-events-none mt-0.5">10</span>
              </motion.div>
            </button>

            {/* Center Play/Pause */}
            <button
              onClick={(e) => { e.stopPropagation(); handlePlayPause(); }}
              className="p-2 sm:p-4 text-white hover:text-white hover:scale-110 active:scale-90 transition-all duration-200 cursor-pointer pointer-events-auto filter drop-shadow-[0_6px_24px_rgba(0,0,0,0.9)] focus:outline-none"
              title={isPlaying ? "Pause" : "Play"}
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <Pause className="w-8 h-8 sm:w-13 sm:h-13 md:w-18 md:h-18 text-white fill-white" />
              ) : (
                <Play className="w-8 h-8 sm:w-13 sm:h-13 md:w-18 md:h-18 text-white fill-white ml-1" />
              )}
            </button>

            {/* 10s Forward with Subtle Spring Micro-Animation */}
            <button
              onClick={(e) => { e.stopPropagation(); stepSeek(10); }}
              className="relative group flex flex-col items-center justify-center p-1.5 sm:p-3 text-white/90 hover:text-white hover:scale-110 active:scale-90 transition-all duration-200 cursor-pointer pointer-events-auto filter drop-shadow-[0_4px_16px_rgba(0,0,0,0.85)] focus:outline-none"
              title="Forward 10 seconds"
              aria-label="Forward 10 seconds"
            >
              <AnimatePresence>
                {seekFeedback?.type === 'forward' && (
                  <motion.div
                    key={seekFeedback.id}
                    initial={{ opacity: 0, y: 4, scale: 0.7 }}
                    animate={{ opacity: 1, y: -18, scale: 1.05 }}
                    exit={{ opacity: 0, y: -26, scale: 0.85 }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    className="absolute -top-3 pointer-events-none px-1.5 py-0.5 rounded-full bg-white/20 border border-white/25 backdrop-blur-md text-white font-black text-[8px] sm:text-[10px] tracking-tight shadow-[0_0_12px_rgba(255,255,255,0.4)]"
                  >
                    +10s
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.div 
                animate={seekFeedback?.type === 'forward' ? { rotate: 40, scale: 1.15 } : { rotate: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 450, damping: 15 }}
                className="relative flex items-center justify-center"
              >
                <RotateCw className="w-6 h-6 sm:w-9 sm:h-9 md:w-11 md:h-11 text-white stroke-[1.75]" />
                <span className="absolute text-[7px] sm:text-[10px] font-black text-white select-none pointer-events-none mt-0.5">10</span>
              </motion.div>
            </button>
          </div>
        )}
        {/* Bottom Controls */}
        <div className="absolute bottom-0 left-0 right-0 p-2.5 sm:p-4 lg:p-6 space-y-2 sm:space-y-3.5">
          {/* Progress Bar Area */}
          <div className={`relative group/progress transition-all duration-300 ${isLocked ? 'opacity-30 pointer-events-none' : ''}`}>
            {/* Peek Time Indicator */}
            <AnimatePresence>
              {isScrubbing && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.85 }}
                  animate={{ opacity: 1, y: -20, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.85 }}
                  transition={{ duration: 0.15 }}
                  style={{ left: `${Math.max(4, Math.min(progressPercent, 96))}%` }}
                  className="absolute -top-1 -translate-x-1/2 pointer-events-none z-30 px-1.5 py-0.5 rounded bg-black/85 backdrop-blur-md border border-white/20 text-white font-mono text-[9px] font-bold shadow-xl"
                >
                  {formatTime(currentTime)}
                </motion.div>
              )}
            </AnimatePresence>
            <div className="h-1 sm:h-1.5 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
              <div
                className="h-full transition-all duration-100 relative"
                style={{ width: `${progressPercent}%`, background: 'var(--primary-gradient, var(--primary))' }}
              >
                <div 
                  className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 rounded-full shadow-lg"
                  style={{ background: 'var(--primary, #ffffff)', boxShadow: '0 0 10px var(--primary)' }}
                />
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
            <div className="flex items-center gap-2 sm:gap-4">
              {/* Time Indicator */}
              <div className="text-white/80 text-[8px] sm:text-[10px] font-black uppercase tracking-[0.12em] bg-black/50 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-md sm:rounded-lg border border-white/5 backdrop-blur-xl shadow-inner-lg">
                {formatTime(currentTime)} <span className="text-white/20 mx-0.5">/</span> {formatTime(duration)}
              </div>
            </div>

            <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2">
              {/* Volume / Mute Button */}
              <button
                onClick={toggleMute}
                title={isMuted ? "Unmute" : "Mute"}
                className="w-6 h-6 sm:w-7 sm:h-7 shrink-0 rounded-md sm:rounded-lg bg-black/50 border border-white/5 backdrop-blur-xl hover:bg-white/10 flex items-center justify-center transition-all text-white/60 hover:text-white"
              >
                {isMuted || volume === 0 ? <VolumeX className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-red-400" /> : <Volume2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
              </button>

              {/* Host Specific: Lock Control */}
              {isHost && (
                <button
                  onClick={(e) => { e.stopPropagation(); setIsLocked(!isLocked); }}
                  title={isLocked ? "Unlock Controls" : "Lock Controls"}
                  className={`w-6 h-6 sm:w-7 sm:h-7 shrink-0 rounded-md sm:rounded-lg flex items-center justify-center transition-all border ${isLocked
                      ? 'border-[var(--primary)]/40 shadow-[0_0_15px_var(--primary)]'
                      : 'bg-black/50 border-white/10 text-white/40 hover:text-white hover:bg-white/10'
                    }`}
                  style={isLocked ? { background: 'var(--primary-gradient, var(--primary))', color: 'var(--primary-foreground, #ffffff)' } : {}}
                >
                  {isLocked ? <Lock className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> : <Unlock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />}
                </button>
              )}

              {/* Multi-Audio Language Selector (Displays if > 1 Audio Track) */}
              {audioTracks.length > 1 && (
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isHost) {
                        toast.info("Audio language is managed by the Host");
                        return;
                      }
                      setShowAudioMenu(!showAudioMenu);
                    }}
                    title={isHost ? "Audio Language" : "Audio language is managed by the Host"}
                    className={cn(
                      "h-6 sm:h-7 px-1.5 sm:px-2 shrink-0 rounded-md sm:rounded-lg flex items-center gap-1 transition-all border text-[9px] sm:text-xs font-bold",
                      isHost && showAudioMenu
                        ? "border-[var(--primary)] shadow-[0_0_15px_var(--primary)]"
                        : "bg-black/50 border-white/10 text-white/70 hover:text-white hover:bg-white/10"
                    )}
                    style={isHost && showAudioMenu ? { background: 'var(--primary-gradient, var(--primary))', color: 'var(--primary-foreground, #ffffff)' } : {}}
                  >
                    <Languages className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    <span className="hidden sm:inline uppercase text-[10px] tracking-wider">
                      {audioTracks[selectedAudioTrack]?.language && audioTracks[selectedAudioTrack]?.language !== 'und'
                        ? audioTracks[selectedAudioTrack]?.language?.toUpperCase()
                        : audioTracks[selectedAudioTrack]?.name || "Audio"}
                    </span>
                    {!isHost && (
                      <span className="hidden sm:inline text-[7.5px] px-1 py-0.2 rounded bg-white/10 text-white/40 uppercase font-mono ml-0.5">
                        HOST
                      </span>
                    )}
                  </button>

                  {/* Audio Language Menu Popover (Host Only) */}
                  {isHost && showAudioMenu && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute bottom-9 right-0 z-50 min-w-[200px] p-2 bg-neutral-900/95 backdrop-blur-2xl border border-white/10 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.8)] space-y-1 animate-in fade-in slide-in-from-bottom-2 duration-200"
                    >
                      <div className="px-2 py-1 text-[10px] font-black uppercase tracking-widest text-white/40 border-b border-white/5 mb-1 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Languages className="w-3 h-3 text-[var(--primary)]" />
                          Audio Languages
                        </div>
                        <span className="text-[8px] px-1 rounded bg-[var(--primary)]/20 text-[var(--primary)] font-bold">HOST</span>
                      </div>
                      {audioTracks.map((track) => {
                        const isSelected = track.id === selectedAudioTrack;
                        return (
                          <button
                            key={track.id}
                            onClick={() => handleAudioTrackChange(track.id)}
                            className={cn(
                              "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all text-left",
                              isSelected
                                ? "bg-[var(--primary)]/20 text-[var(--primary)] font-bold border border-[var(--primary)]/30"
                                : "text-white/80 hover:bg-white/10 hover:text-white"
                            )}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span>{track.name}</span>
                              {track.language && track.language !== "und" && (
                                <span className="text-[9px] px-1 py-0.5 rounded bg-white/10 text-white/50 uppercase font-mono">
                                  {track.language}
                                </span>
                              )}
                            </div>
                            {isSelected && <Check className="w-3.5 h-3.5 text-[var(--primary)] shrink-0 ml-2" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Viewport Aspect Ratio / Zoom to Fill Mode Toggle */}
              <button
                onClick={(e) => { e.stopPropagation(); cycleAspectMode(); }}
                title={`Aspect Ratio: ${aspectMode.toUpperCase()} (Click to toggle Zoom to Fill)`}
                className={cn(
                  "h-6 sm:h-7 px-1.5 sm:px-2 shrink-0 rounded-md sm:rounded-lg flex items-center gap-1 transition-all border text-[8.5px] sm:text-xs font-bold",
                  aspectMode !== 'contain'
                    ? "bg-[var(--primary)]/20 border-[var(--primary)] text-[var(--primary)] shadow-[0_0_12px_var(--primary)]"
                    : "bg-black/50 border-white/10 text-white/60 hover:text-white hover:bg-white/10"
                )}
              >
                <RectangleHorizontal className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                <span className="font-mono uppercase font-black tracking-tight text-[8px] sm:text-[9.5px]">
                  {aspectMode === 'cover' ? 'Zoom' : aspectMode === 'fill' ? 'Fill' : 'Fit'}
                </span>
              </button>

              {/* Fullscreen Toggle */}
              <button
                onClick={toggleFullscreen}
                title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                className="w-6 h-6 sm:w-7 sm:h-7 shrink-0 rounded-md sm:rounded-lg bg-black/50 border border-white/10 text-white/60 hover:text-[var(--primary)] hover:border-[var(--primary)] flex items-center justify-center transition-all"
              >
                {isFullscreen ? (
                  <Minimize2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                ) : (
                  <Maximize2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
