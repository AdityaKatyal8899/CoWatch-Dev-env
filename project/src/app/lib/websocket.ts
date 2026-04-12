import type { WebSocketMessage, SyncState, ChatMessage } from './types';

const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';

type MessageHandler = (message: WebSocketMessage) => void;

export class RealWebSocket {
  private ws: WebSocket | null = null;
  private handlers: Set<MessageHandler> = new Set();
  private roomId: string;
  private userId: string;
  private isHost: boolean;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(roomId: string, userId: string, isHost: boolean) {
    this.roomId = roomId;
    this.userId = userId;
    this.isHost = isHost;
    this.connect();
  }

  private connect() {
    // Add host prefix if needed for special backend logic, 
    // though backend usually checks by ID.
    const effectiveUserId = this.isHost ? `host_${this.userId}` : this.userId;
    const url = `${WS_BASE_URL}/ws/rooms/${this.roomId}/${effectiveUserId}`;
    

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

    // Backend expects specific types: "play", "pause", "seek"
    const payload = {
      type: action,
      timestamp: data?.currentTime ?? data?.timestamp,
    };


    this.ws.send(JSON.stringify(payload));
  }

  sendSyncReport(currentTime: number) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.isHost) return;

    const payload = {
      type: 'sync_report',
      timestamp: currentTime,
    };

    this.ws.send(JSON.stringify(payload));
  }

  sendChatMessage(message: string, username: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const payload = {
      type: 'chat',
      data: {
        id: Math.random().toString(36).substring(2),
        userId: this.userId,
        username,
        message,
        timestamp: new Date().toISOString(),
      }
    };

    this.ws.send(JSON.stringify(payload));
  }

  sendEndRoom() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.isHost) return;
    this.ws.send(JSON.stringify({ type: 'end_room' }));
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.handlers.clear();
  }

  isConnected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export function createWebSocket(roomId: string, userId: string, isHost: boolean): RealWebSocket {
  return new RealWebSocket(roomId, userId, isHost);
}
