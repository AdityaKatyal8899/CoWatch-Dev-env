export interface User {
  id: string;
  email: string;
  name: string;
  display_name?: string;
  age?: number;
  genres: string[];
  theme: string;
  profile_picture?: string;
  storage_used: number;
  storage_limit: number;
  created_at: string;
  isHost?: boolean; // Frontend-only role flag
  provider?: string;
}

export interface Room {
  id: number;
  room_id: string;
  title: string;
  host_id: string;
  video_id?: number | string;
  stream_url: string;
  stream_status: 'waiting' | 'preparing' | 'live' | 'paused' | 'ended';
  is_playing: boolean;
  offset: number;
  started_at?: string;
  updated_at?: string;
  created_at: string;
  participants: User[];
  host_name?: string;
  description?: string;
  thumbnail_url?: string;
}

export interface Video {
  id: number;
  video_id: string;
  title: string;
  description: string;
  stream_url: string;
  processing_status: 'pending' | 'processing' | 'ready' | 'failed';
  thumbnail_url?: string;
  duration?: number; // Optional until backend supports it
  file_size: number;
  user_id: string;
  created_at: string;
}

export interface Collection {
  id: number;
  name: string;
  description?: string;
  user_id: string;
  videos: Video[];
  created_at: string;
}

export interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  message: string;
  timestamp: string;
}

export interface SyncState {
  streamStatus: 'waiting' | 'preparing' | 'live' | 'paused' | 'ended';
  isPlaying: boolean;
  currentTime: number;
  startedAt: number | null;
  updatedAt?: string;
}

export interface WebSocketMessage {
  type: 'room_state' | 'chat' | 'play' | 'pause' | 'seek' | 'sync_report' | 'sync' | 'participant_join' | 'participant_leave' | 'ROOM_ENDED';
  data?: any;
  [key: string]: any; // Allow arbitrary keys for the WS payload
}

export interface UserStats {
  storageUsed: number;
  storageLimit: number;
  totalUploads: number;
  activeStreams: number;
}

export interface StreamSchedule {
  id: string;
  title: string;
  video_title: string;
  scheduled_at: string;
  status: 'upcoming' | 'starting' | 'live';
}