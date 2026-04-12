"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Video as VideoIcon, Play, HardDrive, Folder, Clock, Sparkles, Trash2, AlertCircle, ChevronRight, Calendar, Archive } from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { cn } from '../lib/utils';
import type { Video, UserStats, StreamSchedule } from '../lib/types';
import { VideoCardSkeleton, Skeleton, CollectionRowSkeleton, ListItemSkeleton } from '../components/ui/Skeletons';
import { toast } from 'sonner';
import { ConfirmModal } from '../components/ui/modal';
import { PageTransition } from '../components/ui/PageTransition';
import { motion } from 'motion/react';
import { formatBytes, formatDuration } from '../lib/utils';

export default function Dashboard() {
  const router = useRouter();
  const { user } = useAuth();

  const [stats, setStats] = useState<UserStats | null>(null);
  const [recentVideos, setRecentVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal States
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [videoToDelete, setVideoToDelete] = useState<Video | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Active Rooms State
  const [activeRooms, setActiveRooms] = useState<any[]>([]);
  const [isDisbandModalOpen, setIsDisbandModalOpen] = useState(false);
  const [roomToDisband, setRoomToDisband] = useState<any | null>(null);

  useEffect(() => {
    // Initial load
    loadDashboardData();

    // Set up real-time polling for stats (every 30 seconds)
    const statsInterval = setInterval(async () => {
      try {
        const statsData = await api.getUserStats();
        setStats(statsData);
        
        // Poll active rooms too
        const activeRoomsData = await api.getActiveRooms();
        setActiveRooms(activeRoomsData);
      } catch (error) {

      }
    }, 30000);

    return () => clearInterval(statsInterval);
  }, []);

  const loadDashboardData = async () => {
    try {
      const [statsData, videosData, activeRoomsData] = await Promise.all([
        api.getUserStats(),
        api.getVideos(),
        api.getActiveRooms().catch(() => [])
      ]);
      setStats(statsData);
      setRecentVideos(videosData.slice(0, 4));
      setActiveRooms(activeRoomsData);
    } catch (error) {

      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, video: Video) => {
    e.stopPropagation();
    setVideoToDelete(video);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!videoToDelete) return;

    setIsDeleting(true);
    try {
      await api.deleteVideo(videoToDelete.video_id);
      toast.success('Video recording successfully erased.');
      setIsDeleteModalOpen(false);
      setVideoToDelete(null);
      loadDashboardData();
    } catch (err) {
      toast.error('Failed to erase recording.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDisbandClick = (e: React.MouseEvent, room: any) => {
    e.stopPropagation();
    setRoomToDisband(room);
    setIsDisbandModalOpen(true);
  };

  const handleConfirmDisband = async () => {
    if (!roomToDisband) return;

    setIsDeleting(true);
    try {
      await api.disbandRoom(roomToDisband.room_id);
      toast.success('Room disbanded successfully.');
      setIsDisbandModalOpen(false);
      setRoomToDisband(null);
      loadDashboardData();
    } catch (err) {
      toast.error('Failed to disband room.');
    } finally {
      setIsDeleting(false);
    }
  };

  const storagePercent = stats ? (stats.storageUsed / stats.storageLimit) * 100 : 0;

  return (
    <DashboardLayout>
      <PageTransition>
        <div className="p-8 max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/5 pb-10">
            <div>
              <h1 className="heading-page mb-1">Dashboard</h1>
              <p className="text-body">Manage your library and synchronized sessions.</p>
            </div>
            
            <div className="flex items-center gap-3">
               <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => router.push('/upload')}
                  className="btn-primary flex items-center gap-2"
               >
                 <Upload className="w-4 h-4" />
                 Upload Video
               </motion.button>
               <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => router.push('/create-stream')}
                  className="btn-secondary"
               >
                 <Play className="w-4 h-4" />
                 Create Room
               </motion.button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
            {loading ? (
              <>
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="glass-card rounded-2xl p-6">
                    <Skeleton className="w-10 h-10 rounded-xl mb-4" />
                    <Skeleton className="h-4 w-1/2 mb-2" />
                    <Skeleton className="h-8 w-3/4" />
                  </div>
                ))}
              </>
            ) : (
              <>
                {/* Storage Card */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="glass-card rounded-2xl p-6 border border-white/5 bg-white/[0.02]"
                >
                  <div className="flex items-center gap-3 mb-4 text-white/40">
                    <HardDrive className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Storage</span>
                  </div>
                  <p className="text-2xl font-semibold text-white tracking-tight">
                    {formatBytes(stats?.storageUsed || 0)} <span className="text-xs text-white/30 font-medium">used</span>
                  </p>
                  <div className="w-full h-1 bg-white/5 rounded-full mt-4 overflow-hidden">
                    <div 
                      className="h-full bg-white/20 transition-all duration-700"
                      style={{ width: `${Math.min(storagePercent, 100)}%` }}
                    />
                  </div>
                </motion.div>

                {/* Total Uploads */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="glass-card rounded-2xl p-6 border border-white/5 bg-white/[0.02]"
                >
                  <div className="flex items-center gap-3 mb-4 text-white/40">
                    <VideoIcon className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Videos</span>
                  </div>
                  <p className="text-2xl font-semibold text-white tracking-tight">{stats?.totalUploads || 0}</p>
                  <p className="text-[10px] text-white/20 font-medium uppercase tracking-wider mt-1">Total recordings</p>
                </motion.div>

                {/* Active Streams */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="glass-card rounded-2xl p-6 border border-white/5 bg-white/[0.02]"
                >
                  <div className="flex items-center gap-3 mb-4 text-white/40">
                    <Sparkles className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Live</span>
                  </div>
                  <p className="text-2xl font-semibold text-white tracking-tight">{stats?.activeStreams || 0}</p>
                  <p className="text-[10px] text-white/20 font-medium uppercase tracking-wider mt-1">Active rooms</p>
                </motion.div>
                {/* Quick Join */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="glass-card rounded-2xl p-6 border border-white/5 bg-white/[0.02]"
                >
                  <div className="flex items-center gap-3 mb-4 text-white/40">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Enter Room</span>
                  </div>
                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget);
                      const rawInput = formData.get('roomId')?.toString().trim();
                      if (!rawInput) return;
                      
                      // Extract room ID from full URL or use raw string if standalone
                      const roomId = rawInput.includes('/room/') 
                        ? rawInput.split('/room/').pop()?.split('?')[0] 
                        : rawInput;

                      if (roomId) router.push(`/room/${roomId}`);
                    }}
                    className="flex gap-2"
                  >
                    <input 
                      type="text" 
                      name="roomId"
                      placeholder="Room ID or Invite link" 
                      className="w-full bg-[#1A1A1A] text-white text-sm rounded-xl px-4 py-3 outline-none border border-white/5 focus:border-[var(--primary)]/50 focus:bg-white/5 transition-all"
                    />
                    <button 
                      type="submit"
                      className="px-4 bg-[var(--primary)] text-white rounded-xl hover:bg-[var(--primary-hover)] transition-all flex items-center justify-center shrink-0"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </form>
                </motion.div>
              </>
            )}
          </div>

          {/* Recent Videos & Scheduled Streams */}
          <div className="grid grid-cols-1 gap-12">
            {/* Recent Videos */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Folder className="w-5 h-5 text-white/20" />
                  <h2 className="heading-section">Recent Videos</h2>
                </div>
                <button
                  onClick={() => router.push('/collections')}
                  className="link-primary"
                >
                  View Library
                </button>
              </div>

              {loading ? (
                <div className="space-y-3">
                  {[...Array(4)].map((_, i) => (
                    <ListItemSkeleton key={i} />
                  ))}
                </div>
              ) : recentVideos.length === 0 ? (
                <div className="glass-card rounded-2xl p-12 text-center border-dashed border-2 border-white/5">
                  <VideoIcon className="w-12 h-12 text-white/10 mx-auto mb-4" />
                  <p className="text-white/40 text-xs font-medium mb-6">No videos found.</p>
                  <button
                    onClick={() => router.push('/upload')}
                    className="btn-primary mx-auto w-fit"
                  >
                    Upload your first video
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentVideos.map((video: Video, idx: number) => (
                    <motion.div
                      key={video.video_id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      whileHover={{ scale: 1.01, backgroundColor: 'rgba(255,255,255,0.04)' }}
                      whileTap={{ scale: 0.99 }}
                      className="flex items-center gap-4 p-3 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 hover:bg-white/[0.04] transition-all cursor-pointer group"
                      onClick={() => router.push(`/create-stream?video=${video.video_id}`)}
                    >
                      <div className="w-24 h-14 rounded-xl bg-[#121212] flex items-center justify-center overflow-hidden border border-white/5 relative">
                        {video.thumbnail_url ? (
                          <img src={api.getStreamUrl(video.thumbnail_url)} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                        ) : (
                          <VideoIcon className="w-6 h-6 text-white/5" />
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                           <Play className="w-4 h-4 text-white" fill="white" />
                        </div>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-medium text-sm truncate tracking-tight">
                          {video.title}
                        </h3>
                        <div className="flex items-center gap-3 mt-1 underline-offset-4">
                          <span className="text-[10px] font-bold text-[var(--primary)] uppercase tracking-widest">{formatDuration(video.duration || 0)}</span>
                          <span className="text-[10px] font-medium text-white/20 uppercase tracking-widest">{formatBytes(video.file_size)} GB</span>
                        </div>
                      </div>
                      
                      <button
                        onClick={(e) => handleDeleteClick(e, video)}
                        className="p-3 text-white/10 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </PageTransition>

      <ConfirmModal 
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Erase Final Recording?"
        description={`The archive "${videoToDelete?.title}" and all its HLS segments will be purged from the deep storage. This synchronized moment cannot be reconstructed.`}
        confirmLabel="Erase Archive"
        variant="destructive"
        isLoading={isDeleting}
      />

      <ConfirmModal 
        isOpen={isDisbandModalOpen}
        onClose={() => setIsDisbandModalOpen(false)}
        onConfirm={handleConfirmDisband}
        title="Disband Active Room?"
        description={`This will forcefully close "${roomToDisband?.title}" and disconnect all ${roomToDisband?.participant_count} active viewers.`}
        confirmLabel="Disband Room"
        variant="destructive"
        isLoading={isDeleting}
      />
    </DashboardLayout>
  );
}
