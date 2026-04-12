"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Folder, Plus, Video as VideoIcon, Play, Trash2, Grid3x3, List, Search, CheckSquare, Square, X } from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { api } from '../lib/api';
import type { Video, Collection } from '../lib/types';
import { VideoCardSkeleton, ListItemSkeleton, Skeleton, CollectionRowSkeleton } from '../components/ui/Skeletons';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Loader } from '../components/ui/Loader';
import { ConfirmModal } from '../components/ui/modal';
import { PageTransition } from '../components/ui/PageTransition';
import { motion } from 'motion/react';
import { formatBytes, formatDuration } from '../lib/utils';

type ViewMode = 'grid' | 'list';

export default function Collections() {
  const router = useRouter();

  const [videos, setVideos] = useState<Video[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showCreateCollection, setShowCreateCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [selectedVideoIds, setSelectedVideoIds] = useState<string[]>([]);

  // Modal States
  const [modalType, setModalType] = useState<'none' | 'deleteCollection' | 'deleteVideo' | 'bulkDelete'>('none');
  const [itemToDelete, setItemToDelete] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [videosData, collectionsData] = await Promise.all([
        api.getVideos(),
        api.getCollections(),
      ]);
      setVideos(videosData || []);
      setCollections(collectionsData || []);
    } catch (error) {
      console.error('[Collections] Load error:', error);
      toast.error('Failed to load collections');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) {
      toast.error('Please enter a collection name');
      return;
    }

    setCreating(true);
    try {
      await api.createCollection(newCollectionName);
      toast.success('Collection created!');
      setShowCreateCollection(false);
      setNewCollectionName('');
      loadData();
    } catch (error) {
      toast.error('Failed to create collection');
    } finally {
      setCreating(false);
    }
  };

  const confirmDeleteVideo = (video: Video) => {
    setItemToDelete(video);
    setModalType('deleteVideo');
  };

  const confirmDeleteCollection = (collection: Collection) => {
    setItemToDelete(collection);
    setModalType('deleteCollection');
  };

  const confirmBulkDelete = () => {
    setModalType('bulkDelete');
  };

  const handleDeleteVideo = async () => {
    if (!itemToDelete) return;

    setDeleting(true);
    try {
      await api.deleteVideo(String(itemToDelete.video_id));
      toast.success('Video deleted');
      setModalType('none');
      setItemToDelete(null);
      loadData();
    } catch (error) {
      toast.error('Failed to delete video');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCollection = async () => {
    if (!itemToDelete) return;

    setDeleting(true);
    try {
      await api.deleteCollection(itemToDelete.id);
      toast.success('Collection deleted');
      if (selectedCollection === String(itemToDelete.id)) {
        setSelectedCollection(null);
      }
      setModalType('none');
      setItemToDelete(null);
      loadData();
    } catch (error) {
      toast.error('Failed to delete collection');
    } finally {
      setDeleting(false);
    }
  };

  const toggleSelectVideo = (videoId: string) => {
    setSelectedVideoIds(prev => 
      prev.includes(videoId) 
        ? prev.filter(id => id !== videoId) 
        : [...prev, videoId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedVideoIds.length === filteredVideos.length) {
      setSelectedVideoIds([]);
    } else {
      setSelectedVideoIds(filteredVideos.map(v => v.video_id));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedVideoIds.length === 0) return;
    
    const count = selectedVideoIds.length;
    const toastId = toast.loading(`Deleting ${count} videos...`);
    setDeleting(true);
    try {
      await api.bulkDeleteVideos(selectedVideoIds);
      toast.success(`Successfully deleted ${count} videos`, { id: toastId });
      setSelectedVideoIds([]);
      setModalType('none');
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete videos', { id: toastId });
    } finally {
      setDeleting(false);
    }
  };

  // Filter videos
  const activeCollection = selectedCollection !== null 
    ? collections.find((c: Collection) => String(c.id) === selectedCollection) 
    : null;

  let filteredVideos = selectedCollection !== null 
    ? (activeCollection?.videos || []) 
    : videos;
  
  if (searchQuery) {
    filteredVideos = filteredVideos.filter((v: Video) => 
      v.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  return (
    <DashboardLayout>
      <PageTransition>
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 border-b border-white/5 pb-10">
              <div>
                <h1 className="heading-page mb-1">Collections</h1>
                <p className="text-body font-medium">Manage and organize your synchronized library.</p>
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowCreateCollection(true)}
                className="btn-primary flex items-center justify-center gap-2 w-full sm:w-auto min-h-[44px]"
              >
                <Plus className="w-4 h-4" />
                New Collection
              </motion.button>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="flex-1 relative group w-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-[var(--primary)] transition-colors" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search recordings..."
                  className="w-full pl-11 pr-4 py-2.5 min-h-[44px] bg-white/[0.03] border border-white/5 rounded-xl text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[var(--primary)]/40 transition-all"
                />
              </div>

              <div className="flex gap-1 p-1 bg-white/[0.03] border border-white/5 rounded-xl">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-lg transition-all ${
                    viewMode === 'grid'
                      ? 'bg-white/10 text-white shadow-sm'
                      : 'text-white/30 hover:text-white/60'
                  }`}
                >
                  <Grid3x3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-lg transition-all ${
                    viewMode === 'list'
                      ? 'bg-white/10 text-white shadow-sm'
                      : 'text-white/30 hover:text-white/60'
                  }`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Collections Horizontal Tabs */}
          <div className="mb-10">
            <div className="flex items-center gap-2 overflow-x-auto pb-4 scrollbar-thin">
              <button
                onClick={() => setSelectedCollection(null)}
                className={`px-5 py-2.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border ${
                  selectedCollection === null
                    ? 'bg-white text-black border-white'
                    : 'bg-white/5 text-white/40 border-white/5 hover:border-white/10 hover:text-white/60'
                }`}
              >
                All Reality ({videos.length})
              </button>

              {loading ? (
                 [...Array(3)].map((_, i) => (
                   <Skeleton key={i} className="w-32 h-10 rounded-full shrink-0" />
                 ))
              ) : (
                collections.map((collection: Collection) => (
                  <div key={collection.id} className="relative group shrink-0">
                    <button
                      onClick={() => setSelectedCollection(String(collection.id))}
                      className={`px-5 py-2.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border flex items-center gap-3 ${
                        selectedCollection === String(collection.id)
                          ? 'bg-white text-black border-white'
                          : 'bg-white/5 text-white/40 border-white/5 hover:border-white/10 hover:text-white/60'
                      }`}
                    >
                      {collection.name}
                      <span className="opacity-40">{collection.videos?.length || 0}</span>
                    </button>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        confirmDeleteCollection(collection);
                      }}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Videos Grid/List */}
          <div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <h2 className="heading-section">
                {selectedCollection
                  ? collections.find((c: Collection) => String(c.id) === selectedCollection)?.name
                  : 'All Recordings'}
                <span className="ml-3 text-white/20 text-xs font-medium">{filteredVideos.length}</span>
              </h2>
              
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors text-white/40 hover:text-white"
              >
                {selectedVideoIds.length === filteredVideos.length && filteredVideos.length > 0 ? (
                  <CheckSquare className="w-4 h-4 text-[var(--primary)]" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
                <span className="text-[10px] font-bold uppercase tracking-widest">Select All</span>
              </button>
            </div>

            {loading ? (
              <div className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" : "space-y-3"}>
                {[...Array(8)].map((_, i) => (
                  viewMode === 'grid' ? <VideoCardSkeleton key={i} /> : <ListItemSkeleton key={i} />
                ))}
              </div>
            ) : filteredVideos.length === 0 ? (
              <div className="glass-card rounded-2xl p-20 text-center border-dashed border-2 border-white/5">
                <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-6">
                  <VideoIcon className="w-8 h-8 text-white/20" />
                </div>
                <h3 className="heading-card mb-2">No recordings found</h3>
                <p className="text-white/40 max-w-xs mx-auto mb-8 text-xs">
                  {searchQuery ? 'Try a different search term.' : 'Start your journey by uploading your first video.'}
                </p>
                {!searchQuery && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => router.push('/upload')}
                    className="btn-primary mx-auto w-fit"
                  >
                    Upload Video
                  </motion.button>
                )}
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredVideos.map((video: Video, idx: number) => (
                  <motion.div
                    key={video.video_id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.03 }}
                    whileHover={{ y: -5, borderColor: 'var(--primary)' }}
                    className={`glass-card rounded-2xl overflow-hidden group border border-white/5 hover:border-white/10 transition-all cursor-pointer relative ${
                      selectedVideoIds.includes(video.video_id) ? 'ring-1 ring-[var(--primary)]' : ''
                    }`}
                    onClick={() => toggleSelectVideo(video.video_id)}
                  >
                    <div className="aspect-video bg-[#121212] flex items-center justify-center relative overflow-hidden">
                      {video.thumbnail_url ? (
                        <img 
                          src={api.getStreamUrl(video.thumbnail_url)} 
                          alt={video.title} 
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                        />
                      ) : (
                        <VideoIcon className="w-8 h-8 text-white/5" />
                      )}
                      
                      <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/60 backdrop-blur-md rounded text-[10px] font-bold text-white uppercase tracking-widest">
                        {formatDuration(video.duration || 0)}
                      </div>
  
                      <div 
                        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/create-stream?video=${video.video_id}`);
                        }}
                      >
                        <motion.div 
                          whileHover={{ scale: 1.2 }}
                          className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shadow-xl transition-transform"
                        >
                          <Play className="w-5 h-5 text-black ml-0.5" fill="black" />
                        </motion.div>
                      </div>
                    </div>
  
                    <div className="p-4">
                      <h3 className="text-white font-medium text-sm truncate mb-3 tracking-tight">
                        {video.title}
                      </h3>
                      <div className="flex items-center justify-between">
                         <span className="text-[10px] font-bold tracking-widest text-white/20 uppercase">{formatBytes(video.file_size)}</span>
                         <button
                          onClick={(e) => {
                            e.stopPropagation();
                            confirmDeleteVideo(video);
                          }}
                          className="p-2 hover:bg-red-500/10 rounded-lg transition-all group/del"
                        >
                          <Trash2 className="w-4 h-4 text-white/10 group-hover/del:text-red-400" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredVideos.map((video: Video, idx: number) => (
                  <motion.div
                    key={video.video_id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.02 }}
                    className={`glass-card rounded-2xl p-3 sm:p-4 flex items-center gap-3 sm:gap-5 border border-white/5 hover:border-[var(--primary)]/30 transition-all cursor-pointer group ${
                      selectedVideoIds.includes(video.video_id) ? 'bg-[var(--primary)]/5 border-[var(--primary)]/30' : ''
                    }`}
                    onClick={() => toggleSelectVideo(video.video_id)}
                  >
                    <div 
                      className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all flex-shrink-0 ${
                        selectedVideoIds.includes(video.video_id)
                          ? 'bg-[var(--primary)] border-[var(--primary)]'
                          : 'bg-white/5 border-white/10'
                      }`}
                    >
                      {selectedVideoIds.includes(video.video_id) && <CheckSquare className="w-4 h-4 text-white" />}
                    </div>
  
                    <div className="w-24 h-16 sm:w-32 sm:h-20 rounded-xl bg-[#1a1a1a] flex items-center justify-center overflow-hidden flex-shrink-0 border border-white/5">
                      {video.thumbnail_url ? (
                        <img src={api.getStreamUrl(video.thumbnail_url)} alt={video.title} className="w-full h-full object-cover" />
                      ) : (
                        <VideoIcon className="w-8 h-8 text-white/10" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white text-xs sm:text-sm font-bold mb-1 truncate group-hover:text-[var(--primary)] transition-colors">
                        {video.title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-[9px] sm:text-[10px] font-black tracking-widest text-white/20 uppercase">
                        <span className="text-white/40">{formatDuration(video.duration || 0)}</span>
                        <span className="hidden sm:inline">•</span>
                        <span>{formatBytes(video.file_size)}</span>
                        <span className="hidden sm:inline">•</span>
                        <span>{new Date(video.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
  
                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/create-stream?video=${video.video_id}`);
                        }}
                        className="p-2 sm:p-3 min-w-[36px] min-h-[36px] sm:min-w-[44px] sm:min-h-[44px] flex items-center justify-center bg-white text-black rounded-xl hover:bg-[var(--primary)] hover:text-[var(--bg)] transition-all shadow-xl shadow-black/20"
                      >
                        <Play className="w-3 h-3 sm:w-4 sm:h-4 ml-0.5" fill="currentColor" />
                      </motion.button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          confirmDeleteVideo(video);
                        }}
                        className="p-3 bg-white/5 hover:bg-red-500/10 border border-white/5 hover:border-red-500/20 rounded-xl text-white/20 hover:text-red-400 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </PageTransition>

      {/* Modals & Overlays */}
      
      {/* Create Collection Modal */}
      {showCreateCollection && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[110] p-6 animate-in fade-in duration-300">
          <div className="glass-card rounded-3xl p-8 max-w-md w-full border border-white/10 shadow-2xl relative">
            <button 
              onClick={() => setShowCreateCollection(false)}
              className="absolute top-6 right-6 p-2 hover:bg-white/5 rounded-xl transition-colors text-white/20 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-2xl font-black text-white mb-6 tracking-tight">New Collection</h2>
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-white/30 mb-2">Collection Identity</label>
                <input
                  type="text"
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  placeholder="e.g. Midnight Memories"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-white placeholder:text-white/20 focus:outline-none focus:border-[var(--primary)]/40 focus:ring-4 focus:ring-[var(--primary)]/10 transition-all font-bold"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateCollection()}
                />
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => setShowCreateCollection(false)}
                  className="flex-1 px-6 py-4 bg-white/5 border border-white/10 rounded-xl text-white font-black uppercase tracking-widest text-[10px] hover:bg-white/10 transition-all"
                >
                  Cancel
                </button>
                <Button
                  onClick={handleCreateCollection}
                  loading={creating}
                  className="flex-1 px-6 py-4 bg-white text-black rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-[var(--primary)] hover:text-[var(--bg)] transition-all shadow-xl shadow-[var(--primary)]/20"
                >
                  Initialize
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modals */}
      <ConfirmModal
        isOpen={modalType === 'deleteVideo'}
        onClose={() => setModalType('none')}
        onConfirm={handleDeleteVideo}
        title="Erase Recording?"
        description={`This will permanently remove "${itemToDelete?.title}" from existence. This action cannot be reversed.`}
        confirmLabel="Erase"
        variant="destructive"
        isLoading={deleting}
      />

      <ConfirmModal
        isOpen={modalType === 'deleteCollection'}
        onClose={() => setModalType('none')}
        onConfirm={handleDeleteCollection}
        title="Dissolve Collection?"
        description={`The collection "${itemToDelete?.name}" will be deleted. The videos inside will remain available in your primary library.`}
        confirmLabel="Dissolve"
        variant="destructive"
        isLoading={deleting}
      />

      <ConfirmModal
        isOpen={modalType === 'bulkDelete'}
        onClose={() => setModalType('none')}
        onConfirm={handleBulkDelete}
        title="Mass Erasure"
        description={`You are about to delete ${selectedVideoIds.length} recordings. Are you absolutely certain you want to proceed?`}
        confirmLabel="Erase All"
        variant="destructive"
        isLoading={deleting}
      />

      {/* Batch Action Bar */}
      {selectedVideoIds.length > 0 && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-10 duration-500">
          <div className="bg-white text-black border border-white/20 rounded-2xl p-2 pl-8 pr-2 flex items-center gap-12 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)]">
            <div className="flex items-center gap-4">
              <span className="font-black text-2xl tracking-tighter">{selectedVideoIds.length}</span>
              <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Videos Selected</span>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedVideoIds([])}
                className="px-6 py-3 hover:bg-black/5 rounded-xl transition-colors font-black uppercase tracking-widest text-[10px]"
              >
                Cancel
              </button>
              <Button
                onClick={confirmBulkDelete}
                loading={deleting}
                className="flex items-center gap-3 px-8 py-3 bg-black text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-[var(--primary)] hover:text-[var(--bg)] transition-all shadow-xl shadow-black/10"
              >
                <Trash2 className="w-4 h-4" />
                Erase Selection
              </Button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
