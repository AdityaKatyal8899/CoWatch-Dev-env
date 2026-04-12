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

  useEffect(() => {
    loadCollections();
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

    const progressInterval = setInterval(() => {
      setUploadProgress((prev: number) => {
        if (prev >= 95) {
          clearInterval(progressInterval);
          return 95;
        }
        return prev + 2;
      });
    }, 200);

    try {
      const video = await api.uploadVideo(file, title, description, selectedCollectionId || undefined);
      setUploadProgress(100);
      setProcessing(true);
      
      setTimeout(() => {
        setProcessing(false);
        setUploadComplete(true);
        setUploadedVideoId(video.video_id);
        setUploading(false);
        toast.success('Upload successful!');
      }, 1500);
      
    } catch (error: any) {
      console.error('[Upload] Error:', error);
      toast.error(error.message || 'Transmission failed.');
      setUploading(false);
    } finally {
      clearInterval(progressInterval);
    }
  };

  const resetUpload = () => {
    setFile(null);
    setTitle('');
    setDescription('');
    setSelectedCollectionId('');
    setUploadProgress(0);
    setUploadComplete(false);
    setUploadedVideoId(null);
    setUploading(false);
    setProcessing(false);
  };

  return (
    <DashboardLayout>
      <PageTransition>
        <div className="p-8 max-w-5xl mx-auto">
          {!uploadComplete ? (
            <>
              <div className="mb-10 text-center">
                <h1 className="text-4xl font-black text-white mb-2 tracking-tight">Upload <span className="text-[var(--primary)]">Content</span></h1>
                <p className="text-[var(--muted)] font-medium">Standard MP4, MKV or AVI. Up to 2GB.</p>
              </div>

              <div className="max-w-2xl mx-auto">
                {/* Drag & Drop Area */}
                <motion.div 
                  whileHover={!uploading && !file ? { scale: 1.01, borderColor: 'var(--primary)' } : {}}
                  className={`glass-card rounded-3xl border-2 border-dashed transition-all p-12 text-center mb-10 ${
                    dragActive ? 'border-[var(--primary)] bg-[var(--primary)]/5 scale-[1.01]' : 'border-white/5 bg-white/[0.02]'
                  } ${uploading || processing ? 'pointer-events-none opacity-80' : 'cursor-pointer'}`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => !uploading && !file && fileInputRef.current?.click()}
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
                        {dragActive ? 'Release to upload' : 'Select a recording'}
                      </h2>
                      <p className="text-[var(--muted)] mb-8 max-w-xs mx-auto text-sm font-medium">
                        Drag and drop your file here or click to browse.
                      </p>
                      <button className="btn-primary px-8 py-3 rounded-xl mx-auto w-fit flex items-center gap-2">
                        <Search className="w-4 h-4" />
                        Browse Storage
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

                      {(uploading || processing) && (
                        <div className="space-y-4 pt-4 border-t border-white/5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-widest text-white/40">
                              {processing ? 'Optimizing For Streaming...' : 'Transmitting to Deep Storage'}
                            </span>
                            <span className="text-xl font-black text-white">
                              {processing ? 'Processing' : `${uploadProgress}%`}
                            </span>
                          </div>
                          <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: processing ? '100%' : `${uploadProgress}%` }}
                              className="h-full bg-[var(--primary)] shadow-[0_0_20px_var(--primary)]"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>

                {/* Form Details (only if file selected and not finished) */}
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
                      onClick={handleUpload}
                      disabled={!title.trim() || uploading || processing}
                      className="btn-primary w-full py-6 text-sm font-bold uppercase tracking-widest shadow-xl shadow-[var(--primary)]/10"
                    >
                      {processing ? 'Finalizing Sync...' : (uploading ? 'Transmitting...' : 'Begin Transmission')}
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
