import type { WebSocketMessage, SyncState, ChatMessage } from './types';

const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';

type MessageHandler = (message: WebSocketMessage) => void;
const socketCache: Map<string, RealWebSocket> = new Map();

export class RealWebSocket {
  private ws: WebSocket | null = null;
  private handlers: Set<MessageHandler> = new Set();
  private roomId: string;
  private userId: string;
  private isHost: boolean;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private roomInvalid = false;

  constructor(roomId: string, userId: string, isHost: boolean) {
    this.roomId = roomId;
    this.userId = userId;
    this.isHost = isHost;
    this.connect();
  }

  private connect() {
    // 1. WebSocket Persistence Guard
    if (this.roomInvalid) return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    // Use raw userId to ensure consistent identity for reconnection/grace hooks
    const url = `${WS_BASE_URL}/ws/rooms/${this.roomId}/${this.userId}`;
    

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {

      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleInboundMessage(message);
      } catch (error) {
      // Silently ignore parse errors in production

      }
    };

    this.ws.onclose = (event) => {

      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
        setTimeout(() => this.connect(), delay);
      }
    };

    this.ws.onerror = (error) => {
      // WebSocket error handler

    };
  }

  private handleInboundMessage(message: any) {
    // Standardize backend messages to frontend WebSocketMessage type
    if (message.type === 'room_state' || message.type === 'seek') {
      const syncData: SyncState & { participant_count?: number } = {
        isPlaying: message.is_playing,
        currentTime: message.currentTime,
        startedAt: message.startedAt ? new Date(message.startedAt).getTime() : null,
        updatedAt: message.updatedAt || null,
        streamStatus: message.stream_status || (message.is_playing ? 'live' : 'waiting'),
        participant_count: message.participant_count
      };
      
      this.handlers.forEach(handler => handler({
        type: message.type as any, // Preserve 'seek' or 'room_state'
        data: syncData
      }));
    } else if (message.type === 'sync') {
      // Backend sync message
      this.handlers.forEach(handler => handler({
        type: 'sync',
        data: { currentTime: message.timestamp }
      }));
    } else if (message.type === 'chat') {
      this.handlers.forEach(handler => handler({
        type: 'chat',
        data: message.data
      }));
    } else if (message.type === 'error' && message.code === 'ROOM_NOT_FOUND') {
      this.roomInvalid = true;
      this.disconnect();
      this.handlers.forEach(handler => handler(message));
    } else {
      // Generic fallback
      this.handlers.forEach(handler => handler(message));
    }
  }

  onMessage(handler: MessageHandler) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  sendHostControl(action: 'play' | 'pause' | 'seek', data?: any) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const payload = {
      type: action,
      event_type: "control",
      source: this.isHost ? "host" : "viewer",
      timestamp: data?.currentTime ?? data?.timestamp,
    };

    this.ws.send(JSON.stringify(payload));
  }

  sendSyncReport(currentTime: number) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.isHost) return;

    const payload = {
      type: 'sync_report',
      event_type: "control",
      source: "host",
      timestamp: currentTime,
    };

    this.ws.send(JSON.stringify(payload));
  }

  sendChatMessage(message: string, username: string, theme?: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const payload = {
      type: 'chat',
      event_type: "chat",
      source: this.isHost ? "host" : "viewer",
      data: {
        id: Math.random().toString(36).substring(2),
        userId: this.userId,
        username,
        theme,
        message,
        timestamp: new Date().toISOString(),
      }
    };

    this.ws.send(JSON.stringify(payload));
  }

  sendEndRoom() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.isHost) return;
    this.ws.send(JSON.stringify({ 
      type: 'end_room',
      event_type: "control",
      source: "host"
    }));
  }

  sendType(type: string, data: any) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ 
      type,
      data,
      source: this.isHost ? "host" : "viewer"
    }));
  }

  disconnect() {
    // Only disconnect if explicitly called from ROOM_ENDED or Room destruction
    // We actually keep it alive in the cache for re-mounts.
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.handlers.clear();
    socketCache.delete(this.roomId);
  }

  isConnected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  getRoomId() {
    return this.roomId;
  }
}

export function createWebSocket(roomId: string, userId: string, isHost: boolean): RealWebSocket {
  const cacheKey = `${roomId}`;
  const cached = socketCache.get(cacheKey);
  
  if (cached && cached.isConnected()) {
    return cached;
  }
  
  // If we have a dead socket in cache, clean it up
  if (cached) {
    cached.disconnect();
  }

  const socket = new RealWebSocket(roomId, userId, isHost);
  socketCache.set(cacheKey, socket);
  return socket;
}
