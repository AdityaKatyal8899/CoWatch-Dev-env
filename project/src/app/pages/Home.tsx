"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Play, Users, Sparkles, Crown } from 'lucide-react';
import { api } from '../lib/api';
import type { Video } from '../lib/types';
import { toast } from 'sonner';

export default function Home() {
  const router = useRouter();

  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'create' | 'join' | null>(null);
  
  // Form state
  const [username, setUsername] = useState('');
  const [roomName, setRoomName] = useState('');
  const [selectedVideoId, setSelectedVideoId] = useState('');
  const [joinRoomId, setJoinRoomId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadVideos();
  }, []);

  const loadVideos = async () => {
    try {
      const videoList = await api.getVideos();
      setVideos(videoList);
      if (videoList.length > 0) {
        setSelectedVideoId(String(videoList[0].id));
      }
    } catch (error) {

      toast.error('Failed to load videos');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !roomName.trim() || !selectedVideoId) {
      toast.error('Please fill in all fields');
      return;
    }

    setSubmitting(true);
    try {
      // Generate a unique identity for guest hosts if they aren't logged in
      const guestId = `guest_${Math.random().toString(36).substring(2, 11)}`;
      const room = await api.createRoom(roomName, selectedVideoId, guestId);
      
      const user = {
        id: guestId,
        name: username,
        isHost: true,
        genres: [],
        theme: 'default-dark',
        storage_used: 0,
        storage_limit: 0,
        created_at: new Date().toISOString(),
        email: ''
      };
      sessionStorage.setItem('currentUser', JSON.stringify(user));
      
      toast.success('Room created!');
      router.push(`/room/${room.room_id}`);
    } catch (error) {

      toast.error('Failed to create room');
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !joinRoomId.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    setSubmitting(true);
    try {
      const guestId = `guest_${Math.random().toString(36).substring(2, 11)}`;
      const response = await api.joinRoom(joinRoomId, guestId, username);
      
      if (!response.success) {
        toast.error(response.message || 'Failed to join room');
        return;
      }

      const { room } = response;
      const user = {
        id: guestId,
        name: username,
        isHost: false,
        genres: [],
        theme: 'default-dark',
        storage_used: 0,
        storage_limit: 0,
        created_at: new Date().toISOString(),
        email: ''
      };
      
      sessionStorage.setItem('currentUser', JSON.stringify(user));
      
      toast.success('Joined room!');
      router.push(`/room/${room.room_id}`);
    } catch (error) {

      toast.error('Failed to join room');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-[#0A0A0A] flex items-center justify-center p-6">
      <div className="w-full max-w-4xl">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-[#00FFB2] to-[#3B82F6] rounded-2xl flex items-center justify-center shadow-lg shadow-[#00FFB2]/20">
              <Play className="w-8 h-8 text-black" fill="currentColor" />
            </div>
          </div>
          <h1 className="text-5xl font-bold text-white mb-4">
            Co<span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00FFB2] to-[#3B82F6]">Watch</span>
          </h1>
          <p className="text-white/60 text-lg max-w-2xl mx-auto">
            Watch videos together in perfect sync. Create a room or join your friends for a shared streaming experience.
          </p>
        </div>

        {/* Mode Selection or Forms */}
        {!mode ? (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Create Room Card */}
            <button
              onClick={() => setMode('create')}
              className="group relative p-8 bg-gradient-to-br from-white/5 to-white/0 border border-white/10 rounded-2xl hover:border-[#00FFB2]/50 transition-all duration-300 text-left overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[#00FFB2]/0 to-[#00FFB2]/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative">
                <div className="w-14 h-14 bg-gradient-to-br from-[#00FFB2] to-[#3B82F6] rounded-xl flex items-center justify-center mb-4">
                  <Crown className="w-7 h-7 text-black" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Create Room</h3>
                <p className="text-white/60 mb-4">
                  Start a new watch party as the host. Choose a video and invite others to join.
                </p>
                <div className="flex items-center gap-2 text-[#00FFB2] font-medium">
                  <span>Get Started</span>
                  <Sparkles className="w-4 h-4" />
                </div>
              </div>
            </button>

            {/* Join Room Card */}
            <button
              onClick={() => setMode('join')}
              className="group relative p-8 bg-gradient-to-br from-white/5 to-white/0 border border-white/10 rounded-2xl hover:border-[#3B82F6]/50 transition-all duration-300 text-left overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[#3B82F6]/0 to-[#3B82F6]/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative">
                <div className="w-14 h-14 bg-gradient-to-br from-[#3B82F6] to-[#00FFB2] rounded-xl flex items-center justify-center mb-4">
                  <Users className="w-7 h-7 text-black" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Join Room</h3>
                <p className="text-white/60 mb-4">
                  Have a room code? Join an existing watch party and start streaming together.
                </p>
                <div className="flex items-center gap-2 text-[#3B82F6] font-medium">
                  <span>Join Now</span>
                  <Sparkles className="w-4 h-4" />
                </div>
              </div>
            </button>
          </div>
        ) : (
          <div className="max-w-md mx-auto">
            <div className="bg-gradient-to-br from-white/5 to-white/0 border border-white/10 rounded-2xl p-8">
              {/* Back Button */}
              <button
                onClick={() => setMode(null)}
                className="text-white/60 hover:text-white text-sm mb-6 transition-colors"
              >
                ← Back
              </button>

              {mode === 'create' ? (
                <form onSubmit={handleCreateRoom} className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-2">Create Room</h2>
                    <p className="text-white/60 text-sm">Set up your watch party</p>
                  </div>

                  <div>
                    <label className="block text-white/80 text-sm font-medium mb-2">
                      Your Name
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter your name"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-[#00FFB2] focus:ring-2 focus:ring-[#00FFB2]/20 transition-all"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-white/80 text-sm font-medium mb-2">
                      Room Name
                    </label>
                    <input
                      type="text"
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                      placeholder="e.g., Friday Movie Night"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-[#00FFB2] focus:ring-2 focus:ring-[#00FFB2]/20 transition-all"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-white/80 text-sm font-medium mb-2">
                      Select Video
                    </label>
                    {loading ? (
                      <div className="text-white/60 text-sm">Loading videos...</div>
                    ) : (
                      <select
                        value={selectedVideoId}
                        onChange={(e) => setSelectedVideoId(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#00FFB2] focus:ring-2 focus:ring-[#00FFB2]/20 transition-all"
                        required
                      >
                        {videos.map((video: Video) => (
                          <option key={video.id} value={video.id}>
                            {video.title}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3 bg-gradient-to-r from-[#00FFB2] to-[#3B82F6] rounded-lg text-black font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Creating...' : 'Create Room'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleJoinRoom} className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-2">Join Room</h2>
                    <p className="text-white/60 text-sm">Enter room details to join</p>
                  </div>

                  <div>
                    <label className="block text-white/80 text-sm font-medium mb-2">
                      Your Name
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter your name"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20 transition-all"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-white/80 text-sm font-medium mb-2">
                      Room ID
                    </label>
                    <input
                      type="text"
                      value={joinRoomId}
                      onChange={(e) => setJoinRoomId(e.target.value)}
                      placeholder="Enter room ID"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20 transition-all"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3 bg-gradient-to-r from-[#3B82F6] to-[#00FFB2] rounded-lg text-black font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Joining...' : 'Join Room'}
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* Features */}
        {!mode && (
          <div className="mt-16 grid md:grid-cols-3 gap-6 text-center">
            <div className="p-6">
              <div className="w-12 h-12 bg-[#00FFB2]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Play className="w-6 h-6 text-[#00FFB2]" />
              </div>
              <h4 className="text-white font-semibold mb-2">Perfect Sync</h4>
              <p className="text-white/50 text-sm">
                Watch together in real-time with millisecond precision
              </p>
            </div>
            <div className="p-6">
              <div className="w-12 h-12 bg-[#3B82F6]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-6 h-6 text-[#3B82F6]" />
              </div>
              <h4 className="text-white font-semibold mb-2">Live Chat</h4>
              <p className="text-white/50 text-sm">
                React and discuss with friends while watching
              </p>
            </div>
            <div className="p-6">
              <div className="w-12 h-12 bg-[#00FFB2]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-6 h-6 text-[#00FFB2]" />
              </div>
              <h4 className="text-white font-semibold mb-2">HLS Streaming</h4>
              <p className="text-white/50 text-sm">
                Adaptive quality for smooth playback on any device
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
