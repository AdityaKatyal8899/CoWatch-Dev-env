"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { MessageSquare, Users, Menu, X, Play, Clock, Share2, AlertCircle } from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { VideoPlayer } from '../components/VideoPlayer';
import { Chat } from '../components/Chat';
import { Participants } from '../components/Participants';
import { InvitePanel } from '../components/InvitePanel';
import { api } from '../lib/api';
import { createWebSocket, RealWebSocket } from '../lib/websocket';
import type { Room as RoomType, User, Video, ChatMessage, SyncState } from '../lib/types';
import { useAuth } from '../lib/auth';
import { toast } from 'sonner';
import { Loader } from '../components/ui/Loader';
import { ConfirmModal } from '../components/ui/modal';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

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
          video_id: roomData.video_id,
          title: roomData.title,
          description: roomData.description || roomData.video_description,
          stream_url: roomData.stream_url,
          duration: roomData.duration,
          thumbnail_url: roomData.thumbnail_url
        };
        
        setVideo(videoData as any);
        setLoading(false);
        toast.success('Connected to room');
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
    if (!roomId || !currentUser?.id || wsRef.current) return;

    const websocket = createWebSocket(roomId, currentUser.id, !!currentUser.isHost);
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

      switch (message.type) {
        case 'room_state':
          const data = message.data as SyncState & { participant_count?: number };
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
          break;
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
        case 'participant_leave':
          if (message.data.participant_count) {
            setParticipantCount(message.data.participant_count);
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
      // Only disconnect on explicit unmount of the page
      if (unmountingRef.current && wsRef.current) {
        wsRef.current.disconnect();
        wsRef.current = null;
        setWs(null);
      }
    };
  }, [currentUser?.id, roomId]);


  const isHost = useMemo(() => {
    if (!currentUser || !room) return false;
    return currentUser.id === room.host_id;
  }, [currentUser, room]);

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

  const [activeTab, setActiveTab] = useState<'chat' | 'invite'>('chat');

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
      <AnimatePresence>
        {isDisbanding && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-xl"
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
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Container */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-x-hidden overflow-y-auto lg:overflow-hidden relative">
        
        {/* Stream Area */}
        <div className="w-full lg:flex-1 flex flex-col min-w-0 lg:h-full shrink-0">
          <div className="px-4 lg:px-6 py-3 bg-[#0B0B0F] border-b border-white/5 flex items-center justify-between">
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
          </div>

          <div className="w-full aspect-video lg:flex-1 lg:aspect-auto p-0 lg:p-6 overflow-hidden relative bg-black shrink-0">
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



            {/* Preparation & Loading Overlay (only if processing) */}
            {isVideoProcessing && (
              <div className="absolute inset-0 z-50 bg-[#0B0B0F] flex flex-col items-center justify-center p-12 text-center">
                <div className="relative mb-10">
                   <div className="absolute inset-0 bg-[var(--primary)]/10 blur-[120px] rounded-full" />
                   <div className="relative w-16 h-16 rounded-3xl bg-white/[0.02] border border-white/5 flex items-center justify-center animate-pulse">
                      <Play className="w-8 h-8 text-white/10" fill="currentColor" />
                   </div>
                </div>
                
                <div className="space-y-4 max-w-sm">
                   <h3 className="heading-section">
                     {isVideoProcessing ? "Optimizing content..." : "Waiting for playback"}
                   </h3>
                   <p className="text-body text-center">
                     {isVideoProcessing ? "Generating adaptive stream segments for high-fidelity playback." :
                      "Standby. The host will initiate the shared experience shortly."}
                   </p>
                </div>
              </div>
            )}


          </div>
        </div>

        {/* Sidebar (Chat & Tabs) */}
        <div className="w-full lg:w-[380px] bg-[#0B0B0F] border-t lg:border-t-0 lg:border-l border-white/5 flex flex-col lg:h-full shrink-0 min-h-[500px] lg:min-h-0">
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

          <div className="flex-1 overflow-hidden">
            {activeTab === 'chat' ? (
              <Chat 
                messages={messages}
                onSendMessage={handleSendMessage}
                currentUsername={currentUser.name}
                room={room}
                isHost={isHost}
              />
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
