"use client";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, Video as VideoIcon, Play, Search, Folder, Clock, Sparkles } from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { api } from '../lib/api';
import { PageTransition } from '../components/ui/PageTransition';
import { motion, AnimatePresence } from 'motion/react';
import { formatDuration } from '../lib/utils';
import type { Video, Collection } from '../lib/types';
import { useAuth } from '../lib/auth';
import { toast } from 'sonner';
import { VideoCardSkeleton } from '../components/ui/Skeletons';

export default function CreateStream() {
  const router = useRouter();
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const preselectedVideoId = searchParams.get('video');

  const [streamType, setStreamType] = useState<'library' | 'youtube'>('library');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [videos, setVideos] = useState<Video[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('all');
  const [selectedVideoId, setSelectedVideoId] = useState<string>('');
  const [streamTitle, setStreamTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (preselectedVideoId && videos.length > 0) {
      setSelectedVideoId(preselectedVideoId);
      const video = videos.find((v: Video) => v.video_id === preselectedVideoId);
      if (video) {
        setStreamTitle(`${video.title} - Watch Party`);
      }
    }
  }, [preselectedVideoId, videos]);

  const loadData = async () => {
    setLoading(true);
    try {

      const [videosData, collectionsData] = await Promise.all([
        api.getVideos(),
        api.getCollections()
      ]);

      
      setVideos(videosData || []);
      setCollections(collectionsData || []);
      
      if (videosData?.length > 0 && !preselectedVideoId) {
        setSelectedVideoId(videosData[0].video_id);
        setStreamTitle(`${videosData[0].title} - Watch Party`);
      }
    } catch (error: any) {
      console.error('[CreateStream] Load error:', error);
      toast.error('Authentication failure: Could not load your library.');
      setVideos([]);
      setCollections([]);
    } finally {
      setLoading(false);
    }
  };

  // When a collection is chosen, default the selected episode to its first ready video
  const selectCollection = (id: string) => {
    setSelectedCollectionId(id);
    if (id === 'all') return;
    const collection = collections.find((c: Collection) => String(c.id) === id);
    const cVideos = collection?.videos || [];
    const ready = cVideos.filter((v: Video) => v.processing_status === 'ready');
    if (ready.length > 0 && !ready.some((v: Video) => v.video_id === selectedVideoId)) {
      setSelectedVideoId(ready[0].video_id);
      setStreamTitle(`${ready[0].title} - Watch Party`);
    }
  };

  const handleStartStream = async () => {
    if (!user) {
      toast.error('Access Denied: You must be fully authenticated to initialize rooms.');
      return;
    }

    setCreating(true);
    try {
      if (streamType === 'youtube') {
        const match = youtubeUrl.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
        if (!match) {
          toast.error('Please enter a valid YouTube video URL.');
          setCreating(false);
          return;
        }
        const room = await api.createRoom(streamTitle || "YouTube Watch Party", undefined, user.id, youtubeUrl);
        toast.success('YouTube Session Ready!');
        router.push(`/room/${room.room_id}`);
      } else {
        if (!selectedVideoId) {
          toast.error('Choose a video to continue.');
          setCreating(false);
          return;
        }

        if (videos.length === 0) {
          toast.error('Library missing metadata. Room initialization blocked.');
          setCreating(false);
          return;
        }

        const selectedVideo = videos.find((v: Video) => v.video_id === selectedVideoId);
        if (!selectedVideo) {
          setCreating(false);
          return;
        }

        // Collection-bound room: pass the collection and ensure the start video is a member
        const collectionId = selectedCollectionId !== 'all' ? Number(selectedCollectionId) : undefined;
        let vidToUse = selectedVideoId;
        let titleToUse = streamTitle || selectedVideo.title;
        if (collectionId) {
          const coll = collections.find((c: Collection) => c.id === collectionId);
          const cVideos = coll?.videos || [];
          const chosen = cVideos.find((v: Video) => v.video_id === vidToUse)
            || cVideos.find((v: Video) => v.processing_status === 'ready')
            || cVideos[0];
          if (chosen) {
            vidToUse = chosen.video_id;
            titleToUse = streamTitle || `${chosen.title} - Watch Party`;
          }
        }

        const room = await api.createRoom(titleToUse, vidToUse, user.id, undefined, collectionId);
        toast.success('Ready to stream!');
        router.push(`/room/${room.room_id}`);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to initialize stream.');
    } finally {
      setCreating(false);
    }
  };

  const getYoutubeThumbnail = (url: string) => {
    const match = url.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
    if (match && match[1]) {
      return `https://img.youtube.com/vi/${match[1]}/mqdefault.jpg`;
    }
    return null;
  };

  const filteredVideos = selectedCollectionId === 'all' 
    ? videos 
    : videos.filter(v => {
        const collection = collections.find(c => String(c.id) === selectedCollectionId);
        return collection?.videos?.some(cv => cv.video_id === v.video_id);
      });

  const selectedVideo = videos.find((v: Video) => v.video_id === selectedVideoId);
  const isYoutubeFormValid = streamType === 'youtube' && youtubeUrl.trim().length > 0;
  const isLibraryFormValid = streamType === 'library' && selectedVideoId.length > 0;

  return (
    <DashboardLayout>
      <PageTransition>
        <div className="p-8 max-w-7xl mx-auto">
          <div className="mb-10 text-center flex flex-col items-center">
            <h1 className="text-4xl font-black text-white mb-2 tracking-tight">Create <span className="text-[var(--primary)]">Session</span></h1>
            <p className="text-[var(--muted)] font-medium mb-8">Initialize a private room for synchronized viewing.</p>

            {/* Stream Type Tabs */}
            <div className="flex bg-white/5 border border-white/5 p-1 rounded-2xl w-full max-w-md">
              <button
                type="button"
                onClick={() => { 
                  setStreamType('library'); 
                  setStreamTitle(selectedVideo ? `${selectedVideo.title} - Watch Party` : ''); 
                }}
                className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest rounded-xl transition-all ${
                  streamType === 'library' ? 'bg-white text-black shadow-lg' : 'text-white/40 hover:text-white'
                }`}
              >
                My Library
              </button>
              <button
                type="button"
                onClick={() => { 
                  setStreamType('youtube'); 
                  setStreamTitle('YouTube Watch Party'); 
                }}
                className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest rounded-xl transition-all ${
                  streamType === 'youtube' ? 'bg-white text-black shadow-lg' : 'text-white/40 hover:text-white'
                }`}
              >
                YouTube Video
              </button>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {[...Array(6)].map((_, i) => <VideoCardSkeleton key={i} />)}
            </div>
          ) : streamType === 'library' && videos.length === 0 ? (
            <div className="glass-card rounded-[2.5rem] p-20 text-center border-dashed border-2 border-white/5">
              <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-6">
                 <VideoIcon className="w-8 h-8 text-white/20" />
              </div>
              <h3 className="heading-card mb-2">Your library is empty</h3>
              <p className="text-white/40 max-w-xs mx-auto mb-8 text-xs font-medium">
                Upload a video to begin your first synchronized session.
              </p>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => router.push('/upload')}
                className="btn-primary mx-auto w-fit"
              >
                Upload Video
              </motion.button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              {/* Left Column: Selection */}
              <div className="lg:col-span-8 space-y-8">
                {streamType === 'library' ? (
                  <>
                    <div className="flex items-center justify-between">
                       <div className="flex items-center gap-3">
                         <Folder className="w-5 h-5 text-white/20" />
                         <h2 className="heading-section">Choose Content</h2>
                       </div>
                       <div className="flex gap-2">
                          <button
                            onClick={() => selectCollection('all')}
                            className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all border ${
                              selectedCollectionId === 'all' ? 'bg-white text-black border-white' : 'bg-white/5 text-white/40 border-white/5 hover:border-white/10'
                            }`}
                          >
                            All
                          </button>
                          {collections.map(c => (
                            <button
                              key={c.id}
                              onClick={() => selectCollection(String(c.id))}
                              className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all border ${
                                selectedCollectionId === String(c.id) ? 'bg-white text-black border-white' : 'bg-white/5 text-white/40 border-white/5 hover:border-white/10'
                              }`}
                            >
                              {c.name}
                            </button>
                          ))}
                       </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 max-h-[500px] overflow-y-auto pr-2 scrollbar-thin">
                       {filteredVideos.map((video, idx) => (
                         <motion.button 
                            key={video.video_id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.03 }}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => {
                              setSelectedVideoId(video.video_id);
                              setStreamTitle(`${video.title} - Watch Party`);
                            }}
                            className={`glass-card rounded-2xl overflow-hidden group border transition-all text-left relative ${
                              selectedVideoId === video.video_id ? 'border-[var(--primary)] ring-1 ring-[var(--primary)]/20 shadow-xl' : 'border-white/5 hover:border-white/20'
                            }`}
                         >
                           <div className="aspect-video bg-[#080808] relative overflow-hidden">
                              {video.thumbnail_url ? (
                                <img src={api.getStreamUrl(video.thumbnail_url)} className="w-full h-full object-cover opacity-80" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-white/5 font-black uppercase italic tracking-tighter text-3xl">Co</div>
                              )}
                              <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/60 backdrop-blur-md rounded text-[9px] font-black text-white uppercase tracking-widest">
                                {formatDuration(video.duration || 0)}
                              </div>
                              {selectedVideoId === video.video_id && (
                                <div className="absolute inset-0 bg-[var(--primary)]/10 flex items-center justify-center">
                                   <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-2xl">
                                      <Check className="w-5 h-5 text-black stroke-[4px]" />
                                   </div>
                                </div>
                              )}
                           </div>
                           <div className="p-4">
                              <h4 className={`text-xs font-bold truncate ${selectedVideoId === video.video_id ? 'text-white' : 'text-white/40'}`}>
                                {video.title}
                              </h4>
                           </div>
                         </motion.button>
                       ))}
                    </div>
                  </>
                ) : (
                  <div className="glass-card rounded-[2.5rem] p-10 border border-white/5 bg-white/[0.01] space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
                        <svg className="w-5 h-5 text-red-500" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.107C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.388.511a3.002 3.002 0 0 0-2.11 2.107C0 8.051 0 12 0 12s0 3.949.502 5.837a3.002 3.002 0 0 0 2.11 2.107C4.495 20.455 12 20.455 12 20.455s7.505 0 9.388-.511a3.002 3.002 0 0 0 2.11-2.107c.502-1.888.502-5.837.502-5.837s0-3.949-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                        </svg>
                      </div>
                      <h2 className="heading-section">YouTube Watch Together</h2>
                    </div>
                    <p className="text-xs text-white/40 leading-relaxed max-w-md">
                      Paste any public YouTube video link. We'll synchronize the playback in real-time across all guests.
                    </p>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-white/20 ml-1">YouTube URL</label>
                      <input 
                         type="text"
                         value={youtubeUrl}
                         onChange={(e) => {
                           setYoutubeUrl(e.target.value);
                           const ytMatch = e.target.value.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
                           if (ytMatch && streamTitle === 'YouTube Watch Party') {
                             setStreamTitle("YouTube Session");
                           }
                         }}
                         className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-white focus:border-red-500/40 outline-none transition-all font-bold"
                         placeholder="https://www.youtube.com/watch?v=..."
                      />
                    </div>
                  </div>
                )}

                <div className="glass-card rounded-[2.5rem] p-10 border border-white/5 bg-white/[0.01]">
                   <h3 className="heading-section mb-6">Room Configuration</h3>
                   <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-white/20 ml-1">Stream Name</label>
                        <input 
                           type="text"
                           value={streamTitle}
                           onChange={(e) => setStreamTitle(e.target.value)}
                           className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-white focus:border-[var(--primary)]/40 outline-none transition-all font-bold"
                           placeholder="Party Title..."
                        />
                      </div>
                   </div>
                </div>
              </div>

              {/* Right Column: Launch */}
              <div className="lg:col-span-4 space-y-6">
                 <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="glass-card rounded-[2.5rem] p-8 border border-white/5 bg-white/[0.01] sticky top-4"
                 >
                    <div className="aspect-video rounded-3xl bg-[#080808] border border-white/5 overflow-hidden relative mb-8">
                       {streamType === 'youtube' ? (
                         getYoutubeThumbnail(youtubeUrl) ? (
                           <img src={getYoutubeThumbnail(youtubeUrl)!} className="w-full h-full object-cover opacity-60 shadow-2xl" />
                         ) : (
                           <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-red-600/10 text-red-500 p-6 text-center select-none border border-red-500/10 rounded-3xl">
                             <svg className="w-8 h-8 opacity-40 animate-pulse" viewBox="0 0 24 24" fill="currentColor">
                               <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.107C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.388.511a3.002 3.002 0 0 0-2.11 2.107C0 8.051 0 12 0 12s0 3.949.502 5.837a3.002 3.002 0 0 0 2.11 2.107C4.495 20.455 12 20.455 12 20.455s7.505 0 9.388-.511a3.002 3.002 0 0 0 2.11-2.107c.502-1.888.502-5.837.502-5.837s0-3.949-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                             </svg>
                             <span className="text-[10px] font-black uppercase tracking-wider opacity-60">Paste Link to Load Preview</span>
                           </div>
                         )
                       ) : selectedVideo?.thumbnail_url ? (
                         <img src={api.getStreamUrl(selectedVideo.thumbnail_url)} className="w-full h-full object-cover opacity-40 shadow-2xl" />
                       ) : (
                         <VideoIcon className="w-10 h-10 text-white/5 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" />
                       )}
                       {/* Overlay info */}
                       {(streamType !== 'youtube' || getYoutubeThumbnail(youtubeUrl)) && (
                         <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black to-transparent">
                            <h3 className="text-xl font-bold text-white truncate mb-1">
                              {streamTitle || 'Unnamed Session'}
                            </h3>
                            <div className="flex items-center gap-2">
                               <div className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] animate-pulse shadow-[0_0_8px_var(--primary)]" />
                               <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Live Node Ready</span>
                            </div>
                         </div>
                       )}
                    </div>

                    <div className="space-y-6 pt-4">
                       <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-white/20">
                          <span>Codec Support</span>
                          <span className="text-white/60">{streamType === 'youtube' ? 'YouTube Stream' : 'HLS Adaptive'}</span>
                       </div>
                       <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-white/20">
                          <span>Latency</span>
                          <span className="text-[var(--primary)] font-black">{streamType === 'youtube' ? 'API Direct' : 'Ultra Low'}</span>
                       </div>

                       <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleStartStream}
                        disabled={creating || !(isYoutubeFormValid || isLibraryFormValid)}
                        className="btn-primary w-full py-5 text-sm uppercase tracking-widest font-black shadow-2xl shadow-[var(--primary)]/20"
                       >
                         {creating ? (
                            <div className="flex items-center justify-center gap-3">
                               <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                               Initializing...
                            </div>
                         ) : (
                           <div className="flex items-center justify-center gap-3">
                              <Play className="w-4 h-4" fill="currentColor" />
                              Initialize Room
                           </div>
                         )}
                       </motion.button>
                       <p className="text-[9px] font-bold text-white/10 text-center uppercase tracking-[0.2em] leading-relaxed">
                          By starting, you agree to generate a high-availability sync terminal accessible via invite.
                       </p>
                    </div>
                 </motion.div>
              </div>
            </div>
          )}
        </div>
      </PageTransition>
    </DashboardLayout>
  );
}
