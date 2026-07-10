"use client";

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Upload as UploadIcon, X, Video, Play, Save, ChevronDown, Folder, CloudUpload, Search, Zap, Sparkles } from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { formatBytes } from '../lib/utils';
import { PageTransition } from '../components/ui/PageTransition';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import type { Collection } from '../lib/types';

export default function Upload() {
  const router = useRouter();

  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [uploadedVideoId, setUploadedVideoId] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<string | null>(null);
  const [isAndroidApp, setIsAndroidApp] = useState(false);
  const [uploadSpeed, setUploadSpeed] = useState<number>(0);
  const [uploadEta, setUploadEta] = useState<number | null>(null);
  const [uploadedBytes, setUploadedBytes] = useState<number>(0);
  const pollTimeoutRef = useRef<any>(null);

  useEffect(() => {
    loadCollections();

    if (typeof window !== 'undefined') {
      const bridgeExists = !!(window as any).AndroidUploadBridge;
      setIsAndroidApp(bridgeExists);

      // Register callback for Android native file selection
      (window as any).onAndroidFileSelected = (fileName: string, fileSize: number) => {
        setFile({ name: fileName, size: fileSize } as File);
        const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.')) || fileName;
        setTitle(nameWithoutExt);
      };

      // Register callback for Android native upload start
      (window as any).onAndroidUploadStarted = () => {
        setUploading(true);
        setUploadProgress(0);
        setUploadComplete(false);
        setUploadedVideoId(null);
      };

      // Register callback for Android native upload progress
      (window as any).onAndroidUploadProgress = (percent: number, speed: number, eta: number, bytes: number) => {
        setUploadProgress(percent);
        setUploadSpeed(speed);
        setUploadEta(eta);
        setUploadedBytes(bytes);
      };

      // Register callback for Android native upload completion
      (window as any).onAndroidUploadComplete = (videoId: string) => {
        setUploadProgress(100);
        setUploading(false);
        setUploadedVideoId(videoId);
        setUploadComplete(true);
        toast.success('Upload complete! Video is processing in background.');
      };
    }

    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }
    };
  }, []);

  const loadCollections = async () => {
    try {
      const data = await api.getCollections();
      setCollections(data || []);
    } catch (error) {
      console.error('[Upload] Failed to load collections:', error);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (selectedFile: File) => {
    const validTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-matroska', 'video/x-msvideo'];
    if (!selectedFile.type.startsWith('video/') && !selectedFile.name.endsWith('.mkv') && !selectedFile.name.endsWith('.avi')) {
       toast.error('Format unsupported. Use MP4, MKV, AVI, etc.');
       return;
    }

    if (selectedFile.size > 2 * 1024 * 1024 * 1024) {
      toast.error('File too large. Maximum size is 2GB.');
      return;
    }

    setFile(selectedFile);
    if (!title) {
      const nameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, '');
      setTitle(nameWithoutExt);
    }
  };

  const handleUpload = async () => {
    if (!file || !title.trim()) {
      toast.error('Title and file are required.');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    const startTime = Date.now();
    let lastTime = startTime;
    let lastLoaded = 0;

    const onProgress = (event: ProgressEvent) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded * 100) / event.total);
        setUploadProgress(percent);
        setUploadedBytes(event.loaded);

        const now = Date.now();
        const timeElapsed = (now - lastTime) / 1000;

        if (timeElapsed >= 0.5 || percent === 100) {
          const bytesUploaded = event.loaded - lastLoaded;
          const speed = timeElapsed > 0 ? bytesUploaded / timeElapsed : 0;
          setUploadSpeed(speed);

          const remainingBytes = event.total - event.loaded;
          const eta = speed > 0 ? Math.round(remainingBytes / speed) : null;
          setUploadEta(eta);

          lastTime = now;
          lastLoaded = event.loaded;
        }
      }
    };

    try {
      const video = await api.uploadVideo(
        file,
        title,
        description,
        selectedCollectionId || undefined,
        onProgress
      );
      setUploadProgress(100);
      setUploading(false);
      setUploadedVideoId(video.video_id);
      
      // Save to localStorage for background tracking
      try {
        const stored = localStorage.getItem('cowatch_pending_uploads');
        const pendingList = stored ? JSON.parse(stored) : [];
        pendingList.push({ id: video.video_id, title: title });
        localStorage.setItem('cowatch_pending_uploads', JSON.stringify(pendingList));
      } catch (e) {
        console.error('[Upload] Failed to save pending upload to localStorage:', e);
      }

      setUploadComplete(true);
      toast.success('Upload complete! Processing in background.');

    } catch (error: any) {
      console.error('[Upload] Error:', error);
      toast.error(error.message || 'Transmission failed.');
      setUploading(false);
      setProcessing(false);
      setProcessingStatus(null);
    }
  };

  const handleAndroidSelectVideo = () => {
    if (typeof window !== 'undefined' && (window as any).AndroidUploadBridge) {
      (window as any).AndroidUploadBridge.triggerNativeFilePicker();
    }
  };

  const handleAndroidUpload = () => {
    if (!title.trim()) {
      toast.error('Title is required.');
      return;
    }

    if (typeof window !== 'undefined' && (window as any).AndroidUploadBridge) {
      const cookieMatch = document.cookie.match(/(?:^|; )cowatch_auth=([^;]*)/);
      const token = cookieMatch ? decodeURIComponent(cookieMatch[1]) : '';
      const uploadUrl = `${window.location.origin}/api/videos/upload`;

      (window as any).AndroidUploadBridge.startNativeUpload(
        title,
        description,
        selectedCollectionId || '',
        token,
        uploadUrl
      );
    }
  };

  const resetUpload = () => {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
    setFile(null);
    setTitle('');
    setDescription('');
    setSelectedCollectionId('');
    setUploadProgress(0);
    setUploadComplete(false);
    setUploadedVideoId(null);
    setUploading(false);
    setProcessing(false);
    setProcessingStatus(null);
  };

  return (
    <DashboardLayout>
      <PageTransition>
        <div className="p-8 max-w-5xl mx-auto">
          {!uploadComplete ? (
            <>
              <div className="mb-10 text-center">
                <h1 className="text-4xl font-black text-white mb-2 tracking-tight">Upload <span className="text-[var(--primary)]">Content</span></h1>
                <p className="text-[var(--muted)] font-medium">Standard MP4, MKV or AVI. Up to 5GB.</p>
              </div>

              <div className="max-w-2xl mx-auto">
                {/* Drag & Drop Area / Select Card */}
                <motion.div 
                  whileHover={!uploading && !file ? { scale: 1.01, borderColor: 'var(--primary)' } : {}}
                  className={`glass-card rounded-3xl border-2 border-dashed transition-all p-12 text-center mb-10 ${
                    dragActive ? 'border-[var(--primary)] bg-[var(--primary)]/5 scale-[1.01]' : 'border-white/5 bg-white/[0.02]'
                  } ${uploading || processing ? 'pointer-events-none opacity-80' : 'cursor-pointer'}`}
                  onDragEnter={isAndroidApp ? undefined : handleDrag}
                  onDragLeave={isAndroidApp ? undefined : handleDrag}
                  onDragOver={isAndroidApp ? undefined : handleDrag}
                  onDrop={isAndroidApp ? undefined : handleDrop}
                  onClick={() => {
                    if (uploading || processing) return;
                    if (isAndroidApp) {
                      handleAndroidSelectVideo();
                    } else if (!file) {
                      fileInputRef.current?.click();
                    }
                  }}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileInput}
                    className="hidden"
                    accept="video/*"
                  />

                  {!file ? (
                    <>
                      <div className="mb-8">
                        <div className="w-24 h-24 rounded-3xl bg-white/5 flex items-center justify-center mx-auto transition-all duration-500">
                          <CloudUpload className={`w-10 h-10 transition-colors ${dragActive ? 'text-[var(--primary)]' : 'text-white/20'}`} />
                        </div>
                      </div>
                      <h2 className="text-2xl font-bold text-white mb-2">
                        {isAndroidApp 
                          ? 'Select a video' 
                          : (dragActive ? 'Release to upload' : 'Select a recording')}
                      </h2>
                      <p className="text-[var(--muted)] mb-8 max-w-xs mx-auto text-sm font-medium">
                        {isAndroidApp 
                          ? 'Tap here to browse your device files and begin background upload.' 
                          : 'Drag and drop your file here or click to browse.'}
                      </p>
                      <button className="btn-primary px-8 py-3 rounded-xl mx-auto w-fit flex items-center gap-2">
                        <Search className="w-4 h-4" />
                        {isAndroidApp ? 'Select Video' : 'Browse Storage'}
                      </button>
                    </>
                    ) : (
                      <div className="space-y-6">
                        <div className="flex items-center gap-6 p-4 text-left glass-card bg-white/5 border border-white/10 rounded-2xl">
                          <div className="w-16 h-16 rounded-xl bg-[var(--primary)]/20 flex items-center justify-center flex-shrink-0">
                            <Video className="w-8 h-8 text-[var(--primary)]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-white font-bold truncate">{file.name}</h3>
                            <p className="text-xs text-[var(--muted)] font-bold uppercase tracking-wider">{formatBytes(file.size)}</p>
                          </div>
                          {!uploading && !processing && (
                            <button onClick={(e) => { e.stopPropagation(); resetUpload(); }} className="p-2 hover:bg-white/10 rounded-lg">
                              <X className="w-5 h-5 text-white/40" />
                            </button>
                          )}
                        </div>

                        {(uploading || (processing && processingStatus !== 'failed')) && (
                          <div className="space-y-4 pt-4 border-t border-white/5">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black uppercase tracking-widest text-white/40">
                                {processing 
                                  ? (processingStatus === 'pending' 
                                      ? 'Queued in pipeline (Waiting for CPU allocation)...' 
                                      : processingStatus === 'processing' 
                                        ? 'Transcoding to adaptive HLS stream (FFmpeg)...' 
                                        : processingStatus === 'verifying'
                                          ? 'Verifying stream integrity and availability...'
                                          : 'Synchronizing segments to global CDN...')
                                  : 'Transmitting to Deep Storage'}
                              </span>
                              <span className="text-xl font-black text-white">
                                {processing 
                                  ? (processingStatus === 'pending' 
                                      ? 'Queued' 
                                      : processingStatus === 'processing' 
                                        ? 'Transcoding' 
                                        : processingStatus === 'verifying'
                                          ? 'Verifying'
                                          : 'Uploading')
                                  : `${uploadProgress}%`}
                              </span>
                            </div>
                            <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ 
                                  width: processing 
                                    ? (processingStatus === 'pending' 
                                        ? '15%' 
                                        : processingStatus === 'processing' 
                                          ? '50%' 
                                          : processingStatus === 'verifying'
                                            ? '95%'
                                            : '80%')
                                    : `${uploadProgress}%` 
                                }}
                                className="h-full bg-[var(--primary)] shadow-[0_0_20px_var(--primary)]"
                              />
                            </div>

                            {/* Upload Speed, ETA, & Progress Details */}
                            {!processing && uploading && (
                              <div className="flex items-center justify-between text-[11px] font-bold text-white/50 pt-2">
                                <span>
                                  {formatBytes(uploadedBytes)} / {formatBytes(file.size)}
                                </span>
                                <div className="flex items-center gap-3">
                                  <span>{formatSpeed(uploadSpeed)}</span>
                                  {uploadEta !== null && (
                                    <span className="text-[var(--primary)]">{formatEta(uploadEta)}</span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {processingStatus === 'failed' && (
                          <div className="space-y-4 pt-4 border-t border-red-500/20 text-left">
                            <h4 className="text-sm font-bold text-red-500">Processing Failed</h4>
                            <p className="text-xs text-[var(--muted)] leading-relaxed">
                              We were unable to prepare your video for streaming. This can happen if the video format is corrupted, unsupported, or if a backend error occurred.
                            </p>
                            <button 
                              onClick={(e) => { e.stopPropagation(); resetUpload(); }} 
                              className="bg-white/5 border border-white/10 hover:bg-white/10 text-white px-4 py-2 text-xs rounded-xl font-bold transition-all"
                            >
                              Reset & Try Again
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>

                {/* Form Details (only if file selected, and not completed) */}
                {file && !uploadComplete && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-card rounded-3xl p-8 border border-white/5 space-y-6 mb-10"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-1">Title</label>
                        <input
                          type="text"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          placeholder="Name this moment"
                          disabled={uploading || processing}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[var(--primary)]/40 transition-all font-medium"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-1">Collection</label>
                        <select
                          value={selectedCollectionId}
                          onChange={(e) => setSelectedCollectionId(e.target.value)}
                          disabled={uploading || processing}
                          className="w-full bg-[#0F0F0F] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[var(--primary)]/40 transition-all font-medium appearance-none"
                        >
                          <option value="">Library (General)</option>
                          {collections.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-1">Description (Optional)</label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="What's this experience about?"
                        rows={3}
                        disabled={uploading || processing}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[var(--primary)]/40 transition-all font-medium"
                      />
                    </div>

                    <Button
                      onClick={isAndroidApp ? handleAndroidUpload : handleUpload}
                      disabled={!title.trim() || uploading || processing}
                      className="btn-primary w-full py-6 text-sm font-bold uppercase tracking-widest shadow-xl shadow-[var(--primary)]/10"
                    >
                      {uploading ? 'Transmitting...' : 'Begin Transmission'}
                    </Button>
                  </motion.div>
                )}

                {/* Quick Tips */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="glass-card rounded-2xl p-6 border border-white/5 bg-white/[0.01]">
                    <div className="flex items-center gap-3 mb-4">
                      <Zap className="w-4 h-4 text-[var(--primary)]" />
                      <h3 className="text-xs font-black text-white uppercase tracking-wider">Cloud Processing</h3>
                    </div>
                    <p className="text-[10px] text-[var(--muted)] leading-relaxed font-medium">
                      Optimized for multi-device sync and adaptive bitrate.
                    </p>
                  </div>
                  <div className="glass-card rounded-2xl p-6 border border-white/5 bg-white/[0.01]">
                    <div className="flex items-center gap-3 mb-4">
                      <Sparkles className="w-4 h-4 text-[var(--primary)]" />
                      <h3 className="text-xs font-black text-white uppercase tracking-wider">Universal Formats</h3>
                    </div>
                    <p className="text-[10px] text-[var(--muted)] leading-relaxed font-medium">
                      Supports MP4, MKV, AVI, and major codecs.
                    </p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Upload Success */
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-xl mx-auto glass-card rounded-[3rem] p-16 text-center border border-white/10 shadow-3xl relative overflow-hidden"
            >
              <div className="absolute top-[-50px] left-[-50px] w-64 h-64 bg-[var(--primary)]/10 blur-[80px] rounded-full" />
              
              <div className="w-24 h-24 rounded-3xl bg-white flex items-center justify-center mx-auto mb-8 shadow-2xl rotate-3">
                <Play className="w-12 h-12 text-black ml-1" fill="black" />
              </div>
              
              <h2 className="text-4xl font-black text-white mb-4 tracking-tighter italic">Transmission Confirmed.</h2>
              <p className="text-white/30 font-bold mb-10 max-w-sm mx-auto uppercase tracking-widest text-[9px] leading-relaxed">
                Your recording has been successfully synchronized and is ready for collective viewing.
              </p>

              <div className="flex flex-col gap-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => router.push(`/create-stream?video=${uploadedVideoId}`)}
                  className="btn-primary py-4 text-xs"
                >
                  Stream Immediately
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => router.push('/collections')}
                  className="btn-secondary py-4 text-xs"
                >
                  View Library
                </motion.button>
              </div>

              <button
                onClick={resetUpload}
                className="mt-10 text-[10px] font-black uppercase tracking-widest text-white/20 hover:text-[var(--primary)] transition-colors"
              >
                Initialize Another Upload
              </button>
            </motion.div>
          )}
        </div>
      </PageTransition>
    </DashboardLayout>
  );
}

const formatSpeed = (bytesPerSec: number): string => {
  if (bytesPerSec <= 0) return '0 B/s';
  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  const exp = Math.floor(Math.log(bytesPerSec) / Math.log(1024));
  const val = bytesPerSec / Math.pow(1024, exp);
  return `${val.toFixed(1)} ${units[exp]}`;
};

const formatEta = (seconds: number | null): string => {
  if (seconds === null || seconds <= 0) return 'calculating...';
  if (seconds < 60) return `${seconds}s remaining`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s remaining`;
};
