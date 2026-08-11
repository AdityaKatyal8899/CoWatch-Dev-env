"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';

import dynamic from 'next/dynamic';
import { api } from '../lib/api';

const TopBar = dynamic(() => import('../components/TopBar').then(mod => ({ default: mod.TopBar })), { ssr: false });
const VideoPlayer = dynamic(() => import('../components/VideoPlayer').then(mod => ({ default: mod.VideoPlayer })), { ssr: false });
const YouTubePlayer = dynamic(() => import('../components/YouTubePlayer').then(mod => ({ default: mod.YouTubePlayer })), { ssr: false });
const Chat = dynamic(() => import('../components/Chat').then(mod => ({ default: mod.Chat })), { ssr: false });
const InvitePanel = dynamic(() => import('../components/InvitePanel').then(mod => ({ default: mod.InvitePanel })), { ssr: false });
const VoiceSidebar = dynamic(() => import('../components/VoiceSidebar').then(mod => ({ default: mod.VoiceSidebar })), { ssr: false });
import { createWebSocket, RealWebSocket } from '../lib/websocket';
import type { Room as RoomType, User, Video, ChatMessage, SyncState } from '../lib/types';
import { useAuth } from '../lib/auth';
import { toast } from 'sonner';
import { Loader } from '../components/ui/Loader';
import { ListVideo, X } from 'lucide-react';
const ConfirmModal = dynamic(() => import('../components/ui/modal').then(mod => ({ default: mod.ConfirmModal })), { ssr: false });
import { cn } from '../lib/utils';
import { EpisodeList } from '../components/EpisodeList';


export default function Room() {
  const params = useParams();
  const roomId = params?.roomId as string;
  const router = useRouter();
  const { user: authUser, isLoading: authLoading } = useAuth();

  const [room, setRoom] = useState<RoomType | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [video, setVideo] = useState<Video | null>(null);
  const [ws, setWs] = useState<RealWebSocket | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [syncState, setSyncState] = useState<SyncState>({
    streamStatus: 'waiting',
    isPlaying: false,
    currentTime: 0,
    startedAt: null,
  });
  const [participantCount, setParticipantCount] = useState(1);
  const [seekTrigger, setSeekTrigger] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const wsRef = useRef<RealWebSocket | null>(null);
  const lastInteractionTimeRef = useRef(0);
  const hasInitialSyncRef = useRef(false);
  const isHostRef = useRef(false);
  const isProcessingRemoteEvent = useRef(false);
  const unmountingRef = useRef(false);
  const [isDisbanding, setIsDisbanding] = useState(false);
  const [disbandCountdown, setDisbandCountdown] = useState(5);
  const [newVideoLink, setNewVideoLink] = useState('');

  const videoRef = useRef<Video | null>(null);
  useEffect(() => {
    videoRef.current = video;
  }, [video]);

  // Constants (CRITICAL CONFIG)
  // Initialize room
  useEffect(() => {
    if (!roomId) {
      router.push('/');
      return;
    }

    const initRoom = async () => {
      try {
        let user: User | null = null;
        if (authUser) {
          user = authUser;
        } else {
          const userJson = sessionStorage.getItem('currentUser');
          if (userJson) user = JSON.parse(userJson);
        }

        if (!user) {
          if (authLoading) return;
          router.push('/auth');
          return;
        }

        setCurrentUser(user);


        const roomData = await api.getRoom(roomId);
        if (!roomData) {
          toast.error('Room not found');
          router.push('/');
          return;
        }
        
        setRoom(roomData);
        isHostRef.current = authUser?.id === roomData.host_id;

        // Map data supporting both nested video object and flat room metadata
        const videoData = roomData.video || {
          video_id: roomData.youtube_video_id || roomData.video_id,
          title: roomData.title,
          description: roomData.description || roomData.video_description,
          stream_url: roomData.stream_url,
          duration: roomData.duration,
          thumbnail_url: roomData.thumbnail_url,
          processing_status: roomData.media_type === 'youtube' ? 'ready' : 'ready'
        };
        
        setVideo(videoData as any);
        setLoading(false);
        toast.success('Connected to room');

        // Append system message for current user joining
        const isSelfHost = user.id === roomData.host_id;
        const selfMsg: ChatMessage = {
          id: `system-self-${user.id}-${Date.now()}`,
          userId: 'system',
          username: 'System',
          message: isSelfHost
            ? `${user.name} is the HOST`
            : `${user.name} joined the room`,
          timestamp: new Date().toISOString()
        };
        setMessages([selfMsg]);
      } catch (error) {
        console.error('[Room] Init Error:', error);
        toast.error('Failed to join room');
        router.push('/');
      }
    };

    if (!authLoading) initRoom();
  }, [roomId, router, authLoading]);

  // POLL FOR VIDEO PROCESSING STATUS
  useEffect(() => {
    if (!video || video.processing_status === 'ready') return;

    const pollStatus = setInterval(async () => {
      try {
        const roomData = await api.getRoom(roomId);
        if (roomData) {
          const videoData = roomData.video || {
            video_id: roomData.video_id,
            title: roomData.title,
            description: roomData.description || roomData.video_description,
            stream_url: roomData.stream_url,
            duration: roomData.duration,
            thumbnail_url: roomData.thumbnail_url,
            processing_status: roomData.processing_status || (roomData.video as any)?.processing_status
          };
          
          if ((videoData as any).processing_status === 'ready') {
            setVideo(videoData as any);
            toast.success('Video is ready! Enjoy your watch party.');
          }
        }
      } catch (error) {
        console.error('[Room] Polling Error:', error);
      }
    }, 3000);

    return () => clearInterval(pollStatus);
  }, [roomId, video?.processing_status]);

  // TRACK UNMOUNTING STATUS
  useEffect(() => {
    return () => {
      unmountingRef.current = true;
    };
  }, []);

  // DISBANDING COUNTDOWN LIGIC
  useEffect(() => {
    if (!isDisbanding) return;
    
    if (disbandCountdown <= 0) {
      router.push('/dashboard');
      return;
    }

    const timer = setInterval(() => {
      setDisbandCountdown(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isDisbanding, disbandCountdown, router]);

  // ==========================================
  // WEBSOCKET LIFECYCLE (STRICT: ONCE PER SESSION)
  // ==========================================
  useEffect(() => {
    // Strict Guard: Prevent re-initialization on re-renders
    if (!roomId || !currentUser?.id || !room?.host_id || wsRef.current) return;

    const websocket = createWebSocket(roomId, currentUser.id, currentUser.id === room.host_id);
    setWs(websocket);
    wsRef.current = websocket;

    websocket.onMessage((message) => {
      // 3. Metadata Segregation: Bypass sync logic for chat
      if (message.type === "chat") {
        setMessages((prev: ChatMessage[]) => [...prev, message.data]);
        return;
      }

      // 2. Feedback Loop Suppression (Echo Guard)
      isProcessingRemoteEvent.current = true;

      // INJECTION 1: Host Authority & Disband Lifecycle
      if (message.type === 'ROOM_ENDED' || (message.event_type === "control" && message.action === "disband") || message.type === "host_disconnected" || message.code === "ROOM_NOT_FOUND") {
        // KILL SOCKET: Prevent automatic reconnect loops during the 5s redirect countdown
        websocket.disconnect();
        setIsDisbanding(true);

        if (message.code === "ROOM_NOT_FOUND") {
          toast.error('Room no longer exists. Redirecting...');
        } else {
          toast.error('Host has left. Redirecting in 5s...');
        }
        return;
      }

      // Generic WS error surfaced to the user (e.g. rejected video switch)
      if (message.type === 'error') {
        if (message.code !== 'ROOM_NOT_FOUND' && message.message) {
          toast.error(message.message);
        }
        return;
      }

      switch (message.type) {
        case 'room_state': {
          const data = message.data as SyncState & { participant_count?: number; youtube_video_id?: string; media_type?: string; video_url?: string; video_id?: string; video_title?: string; stream_url?: string; thumbnail_url?: string; duration?: number };
          setSyncState({
            streamStatus: data.streamStatus || 'waiting',
            isPlaying: data.isPlaying,
            currentTime: data.currentTime,
            startedAt: data.startedAt,
            updatedAt: data.updatedAt,
          });

          if (data.participant_count !== undefined) {
            setParticipantCount(data.participant_count);
          }

          // Dynamically update the media if it changed — works for both HLS (video_id) and YouTube
          const currentVideo = videoRef.current;
          const newMediaId = data.video_id || data.youtube_video_id;
          if (newMediaId && (!currentVideo || currentVideo.video_id !== newMediaId)) {
            const isYoutube = data.media_type === 'youtube';
            setVideo({
              video_id: newMediaId,
              title: data.video_title || (isYoutube ? 'YouTube Video Watch Together' : room?.title || ''),
              description: '',
              stream_url: isYoutube ? (data.video_url || data.stream_url || '') : (data.stream_url || ''),
              duration: data.duration || 0,
              thumbnail_url: data.thumbnail_url || '',
              processing_status: 'ready'
            } as any);

            setRoom(prev => prev ? {
              ...prev,
              youtube_video_id: data.youtube_video_id || undefined,
              video_url: data.video_url || '',
              media_type: data.media_type || prev.media_type,
              video_id: data.video_id || prev.video_id,
              stream_url: data.stream_url || prev.stream_url,
            } : null);
          }
          break;
        }
        case 'seek':
          setSyncState(prev => ({ ...prev, currentTime: message.data.currentTime }));
          setSeekTrigger(Date.now());
          break;
        case 'sync':
          setSyncState(prev => ({ ...prev, currentTime: message.data.currentTime }));
          if (message.data.participant_count !== undefined) {
            setParticipantCount(message.data.participant_count);
          }
          break;
        case 'request_sync':
          // INJECTION 2: Host Side - Emit targeted sync_state via stable Ref
          if (isHostRef.current) {
            ws?.sendHostControl('sync_state', { 
              currentTime: syncState.currentTime,
              isPlaying: syncState.isPlaying
            });
          }
          break;
        case 'participant_join':
          if (message.data.participant_count) {
            setParticipantCount(message.data.participant_count);
          }
          if (message.data.id) {
            const newParticipant: User = {
              id: message.data.id,
              name: message.data.name,
              profile_picture: message.data.profile_picture || undefined,
              email: '',
              genres: [],
              theme: 'default-dark',
              storage_used: 0,
              storage_limit: 0,
              created_at: new Date().toISOString()
            };

            // Append system message to chat log
            const joinMsg: ChatMessage = {
              id: `system-join-${message.data.id}-${Date.now()}`,
              userId: 'system',
              username: 'System',
              message: message.data.isHost 
                ? `${message.data.name} is the HOST` 
                : `${message.data.name} joined the room`,
              timestamp: new Date().toISOString()
            };
            setMessages((prev) => [...prev, joinMsg]);

            setRoom((prev) => {
              if (!prev) return null;
              if (prev.participants.some((p) => p.id === newParticipant.id)) return prev;
              return {
                ...prev,
                participants: [...prev.participants, newParticipant]
              };
            });
          }
          break;
        case 'participant_leave':
          if (message.data.participant_count) {
            setParticipantCount(message.data.participant_count);
          }
          if (message.data.id) {
            setRoom((prev) => {
              if (!prev) return null;
              const leavingUser = prev.participants.find((p) => p.id === message.data.id);
              if (leavingUser) {
                const leaveMsg: ChatMessage = {
                  id: `system-leave-${message.data.id}-${Date.now()}`,
                  userId: 'system',
                  username: 'System',
                  message: `${leavingUser.name} left the room`,
                  timestamp: new Date().toISOString()
                };
                setMessages((prevMsgs) => [...prevMsgs, leaveMsg]);
              }
              return {
                ...prev,
                participants: prev.participants.filter((p) => p.id !== message.data.id)
              };
            });
          }
          break;
      }

      // Clear Echo Guard after 200ms
      setTimeout(() => {
        isProcessingRemoteEvent.current = false;
      }, 200);
    });

    // INJECTION 3: Viewer Side - Request sync on handshake completion
    if (!currentUser?.isHost) {
      setTimeout(() => {
        websocket.sendType('request_sync', {});
      }, 500);
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.disconnect();
        wsRef.current = null;
        setWs(null);
      }
    };
  }, [currentUser?.id, roomId, room?.host_id]);


  const handleChangeVideoSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!newVideoLink || !ws) return;

    // Parse YouTube Video ID helper
    const ytIdMatch = newVideoLink.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
    const parsedId = ytIdMatch ? ytIdMatch[1] : null;

    if (!parsedId) {
      toast.error('Invalid YouTube link. Please provide a valid URL.');
      return;
    }

    // Send change_video WebSocket control message to the backend
    ws.sendType('change_video', {
      youtube_video_id: parsedId,
      video_url: newVideoLink,
      media_type: 'youtube'
    });

    setNewVideoLink('');
    toast.success('Changing room video...');
  }, [newVideoLink, ws]);

  const isHost = useMemo(() => {
    if (!currentUser || !room) return false;
    return currentUser.id === room.host_id;
  }, [currentUser, room]);

  // Switch to an episode from the room's collection playlist (host only)
  const handleSelectEpisode = useCallback((episode: Video) => {
    if (!ws || !isHost) return;
    if (episode.processing_status !== 'ready') {
      toast.error('This episode is not ready yet.');
      return;
    }
    if (episode.video_id === videoRef.current?.video_id) return;

    ws.sendType('change_video', {
      video_id: episode.video_id,
      media_type: 'hls'
    });
    setEpisodesOpen(false);
    toast.success(`Loading ${episode.title}...`);
  }, [ws, isHost]);

  const handlePlayStateChange = useCallback((isPlaying: boolean, currentTime: number) => {
    if (!ws || !currentUser) return;
    ws.sendHostControl(isPlaying ? 'play' : 'pause', { currentTime });
  }, [ws, currentUser]);

  const handleSeek = useCallback((currentTime: number) => {
    if (!ws || !currentUser) return;
    ws.sendHostControl('seek', { currentTime });
  }, [ws, currentUser]);

  const handleSendMessage = useCallback((message: string) => {
    if (!ws || !currentUser) return;
    ws.sendChatMessage(message, currentUser.display_name || currentUser.name, currentUser.theme);
  }, [ws, currentUser]);

  const handleLeave = useCallback(async () => {
    if (isHost) {
      setShowEndConfirm(true);
      return;
    }
    if (room && currentUser) {
      ws?.disconnect();
      sessionStorage.removeItem('currentUser');
      toast.success('Left room');
    }
    router.push('/dashboard');
  }, [isHost, room, currentUser, ws, router]);

  const confirmEndRoom = useCallback(() => {
    if (!ws || !isHost) return;
    ws.sendEndRoom();
    
    // Slight buffer for network delay, then visually teardown immediately
    setTimeout(() => {
      ws.disconnect();
      router.push('/dashboard');
    }, 200);
  }, [ws, isHost, router]);



  const handleSyncReport = useCallback((currentTime: number) => {
    if (!ws || !isHost) return;
    ws.sendSyncReport(currentTime);
  }, [ws, isHost]);

  const [activeTab, setActiveTab] = useState<'chat' | 'invite' | 'episodes'>('chat');
  const [episodesOpen, setEpisodesOpen] = useState(false);

  if (loading || !room || !currentUser || !video) {
    return <Loader fullscreen label="Connecting to Room" />;
  }

  const isVideoProcessing = video.processing_status !== 'ready';

  return (
    <div className="flex flex-col h-screen bg-[#050505] overflow-hidden selection:bg-[var(--primary)]/30">
      <TopBar 
        roomId={room.room_id}
        roomName={room.title}
        isHost={isHost}
        onLeave={handleLeave}
      />

      {/* SESSION ENDED OVERLAY */}
      <>
        {isDisbanding && (
          <div 
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-xl transition-opacity duration-300"
          >
            <div className="text-center max-w-sm px-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-red-500/10 mb-8 border border-red-500/20">
                <div className="w-8 h-8 rounded-xl bg-red-500 animate-pulse" />
              </div>
              <h2 className="text-3xl font-black text-white mb-4 tracking-tighter">Session Ended</h2>
              <p className="text-white/40 mb-8 font-medium leading-relaxed">
                The host has disbanded the room or disconnected permanently.
              </p>
              <div className="glass-card rounded-2xl py-3 px-6 inline-block border border-white/5">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20">
                  Redirecting to Dashboard in <span className="text-white">{disbandCountdown}s</span>
                </span>
              </div>
            </div>
          </div>
        )}
      </>

      {/* Main Container */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative min-h-0">
        
        {/* Voice Chat Sidebar */}
        <VoiceSidebar 
          currentUser={currentUser} 
          hostId={room.host_id}
          isHost={isHost}
          roomId={room.room_id}
          roomParticipants={room.participants}
        />

        {/* Stream Area */}
        <div className="w-full lg:flex-1 flex flex-col min-w-0 lg:h-full shrink-0 order-1 lg:order-none">
          <div className="px-4 lg:px-6 py-3 bg-[#0B0B0F] border-b border-white/5 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between order-2 lg:order-none">
            <div className="flex items-center gap-4">
               <div className="flex items-center gap-2 px-3 py-1 bg-white/[0.03] border border-white/5 rounded-full">
                 <div className="w-1.5 h-1.5 bg-[#9333EA] rounded-full animate-pulse" />
                 <span className="text-[10px] font-bold uppercase text-white/40 tracking-widest">
                   {participantCount} {participantCount === 1 ? 'Viewer' : 'Viewers'}
                 </span>
               </div>
               
               <div className={cn(
                 "px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-widest flex items-center gap-2",
                 syncState.streamStatus === 'live' 
                   ? "bg-red-500/10 border-red-500/20 text-red-500" 
                   : "bg-white/5 border-white/5 text-white/40"
               )}>
                 <div className={cn(
                   "w-1 h-1 rounded-full",
                   syncState.streamStatus === 'live' ? "bg-red-500" : "bg-white/40"
                 )} />
                 {syncState.streamStatus === 'live' ? 'Live' : 'Waiting'}
               </div>
            </div>

            {isHost && (
              <form onSubmit={handleChangeVideoSubmit} className="flex items-center gap-2 max-w-sm w-full">
                <input
                  type="text"
                  placeholder="Paste YouTube URL to load..."
                  value={newVideoLink}
                  onChange={(e) => setNewVideoLink(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-[var(--primary)] transition-all flex-1"
                />
                <button
                  type="submit"
                  className="bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-black font-extrabold uppercase tracking-[0.1em] text-[10px] px-4 py-2 rounded-xl transition-all shadow-lg active:scale-95 whitespace-nowrap"
                >
                  Load Video
                </button>
              </form>
            )}
          </div>

          <div id="video-player-container" className="w-full aspect-video lg:flex-1 lg:aspect-auto p-0 lg:p-6 overflow-hidden relative bg-black shrink-0 order-1 lg:order-none">
            {room.media_type === 'youtube' ? (
              <YouTubePlayer
                key={room.youtube_video_id || "default"}
                videoId={room.youtube_video_id || ""}
                isHost={isHost}
                onPlayStateChange={handlePlayStateChange}
                onSeek={handleSeek}
                onSyncReport={handleSyncReport}
                syncState={syncState}
                seekTrigger={seekTrigger}
                isRemoteEvent={isProcessingRemoteEvent}
                hostName={room.host_name}
              />
            ) : (
              <VideoPlayer
                streamUrl={video.stream_url}
                isHost={isHost}
                onPlayStateChange={handlePlayStateChange}
                onSeek={handleSeek}
                onSyncReport={handleSyncReport}
                syncState={syncState}
                seekTrigger={seekTrigger}
                isRemoteEvent={isProcessingRemoteEvent}
                hostName={room.host_name}
              />
            )}

            {/* Collection playlist overlay — visible on the player */}
            {room.collection && (
              <>
                <button
                  onClick={() => setEpisodesOpen(prev => !prev)}
                  title="Episodes"
                  aria-label="Episodes"
                  className={cn(
                    "absolute top-4 right-4 z-20 w-9 h-9 rounded-xl flex items-center justify-center border transition-all",
                    episodesOpen
                      ? "bg-[var(--primary)] text-black border-[var(--primary)]/50 shadow-lg shadow-[var(--primary)]/30"
                      : "bg-black/50 backdrop-blur-xl border-white/10 text-white/70 hover:text-white hover:border-white/25"
                  )}
                >
                  <ListVideo className="w-4 h-4" />
                </button>

                {episodesOpen && (
                  <div className="absolute inset-y-0 right-0 z-30 w-80 max-w-[85%] bg-[#0B0B0F]/95 backdrop-blur-xl border-l border-white/10 flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="flex items-center justify-between gap-3 p-4 border-b border-white/5 shrink-0">
                      <div className="min-w-0">
                        <h3 className="text-xs font-black uppercase tracking-widest text-white truncate">{room.collection.name}</h3>
                        <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest mt-0.5">
                          {room.collection.videos.length} {room.collection.videos.length === 1 ? 'episode' : 'episodes'}
                          {!isHost && ' · Host controls playback'}
                        </p>
                      </div>
                      <button
                        onClick={() => setEpisodesOpen(false)}
                        className="p-2 hover:bg-white/5 rounded-lg text-white/30 hover:text-white transition-colors shrink-0"
                        aria-label="Close episodes"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
                      <EpisodeList
                        episodes={room.collection.videos}
                        currentVideoId={video?.video_id}
                        isHost={isHost}
                        onSelect={handleSelectEpisode}
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Sidebar (Chat & Tabs) */}
        <div className="w-full lg:w-[380px] bg-[#0B0B0F] border-t lg:border-t-0 lg:border-l border-white/5 flex flex-col flex-1 lg:flex-none lg:h-full shrink-0 min-h-0 order-3 lg:order-none">
          {/* Tabs Header */}
          <div className="flex border-b border-white/5 p-1.5 gap-1.5">
            <button
               onClick={() => setActiveTab('chat')}
               className={cn(
                 "flex-1 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                 activeTab === 'chat' ? "bg-white/5 text-white" : "text-white/20 hover:text-white/40"
               )}
            >
              Chat
            </button>
            {room.collection && (
              <button
                 onClick={() => setActiveTab('episodes')}
                 className={cn(
                   "flex-1 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-1.5",
                   activeTab === 'episodes' ? "bg-white/5 text-white" : "text-white/20 hover:text-white/40"
                 )}
              >
                <ListVideo className="w-3 h-3" />
                Episodes
              </button>
            )}
            <button
               onClick={() => setActiveTab('invite')}
               className={cn(
                 "flex-1 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                 activeTab === 'invite' ? "bg-white/5 text-white" : "text-white/20 hover:text-white/40"
               )}
            >
              Invite
            </button>
          </div>

          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {activeTab === 'chat' ? (
              <Chat
                messages={messages}
                onSendMessage={handleSendMessage}
                currentUsername={currentUser.name}
                room={room}
                isHost={isHost}
              />
            ) : activeTab === 'episodes' && room.collection ? (
              <div className="h-full overflow-y-auto scrollbar-thin">
                <div className="p-6">
                  <h2 className="heading-section mb-1">{room.collection.name}</h2>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/20 mb-5 flex items-center gap-2">
                    {room.collection.videos.length} {room.collection.videos.length === 1 ? 'episode' : 'episodes'}
                    {!isHost && ' · Host controls playback'}
                  </p>
                  <EpisodeList
                    episodes={room.collection.videos}
                    currentVideoId={video?.video_id}
                    isHost={isHost}
                    onSelect={handleSelectEpisode}
                  />
                </div>
              </div>
            ) : (
              <div className="h-full overflow-y-auto scrollbar-thin">
                <div className="p-6">
                  <h2 className="heading-section mb-6">Invite Friends</h2>
                  <InvitePanel
                    room={room}
                    isHost={isHost}
                    embedded={true}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal 
        isOpen={showEndConfirm}
        onClose={() => setShowEndConfirm(false)}
        onConfirm={confirmEndRoom}
        title="End Session?"
        description="Leaving will permanently dissolve this room and disconnect all viewers."
        confirmLabel="End Room"
        variant="destructive"
      />
    </div>
  );
}
