# CoWatch - Production-Ready Synchronized Video Streaming Platform

A stable, real-world streaming interface for synchronized video playback with HLS support, built for FastAPI backend compatibility.

## 🎯 Core Features

- **Rock-Solid Video Player**: Single initialization, no unexpected resets, zero buffering from frontend logic
- **HLS Streaming**: Adaptive quality streaming using hls.js
- **Smart Sync System**: Drift-based correction (only when drift > 1 second)
- **Real-Time Chat**: Live messaging between participants
- **Participant Management**: Host and viewer roles with proper permissions
- **Responsive Design**: Works seamlessly on desktop and mobile

## 🏗️ Architecture

### Technology Stack

- **React 18** with TypeScript for type safety
- **React Router 7** for navigation
- **hls.js** for HLS video streaming
- **Tailwind CSS v4** for styling
- **Lucide React** for icons
- **Sonner** for toast notifications

### Project Structure

```
src/
├── app/
│   ├── components/
│   │   ├── VideoPlayer.tsx      # Critical - Production-grade player
│   │   ├── Chat.tsx              # Real-time chat interface
│   │   ├── Participants.tsx      # User list management
│   │   └── TopBar.tsx            # Navigation bar
│   ├── pages/
│   │   ├── Home.tsx              # Landing page
│   │   └── Room.tsx              # Main streaming room
│   ├── lib/
│   │   ├── api.ts                # Mock API layer (FastAPI compatible)
│   │   ├── websocket.ts          # Mock WebSocket for sync
│   │   └── types.ts              # TypeScript interfaces
│   ├── routes.tsx                # Router configuration
│   └── App.tsx                   # Main application
└── styles/
    ├── theme.css                 # Dark theme with neon accents
    └── index.css                 # Global styles
```

## 🎬 Video Player Engineering

The VideoPlayer component follows strict production rules:

### 1. Single Initialization
```typescript
// HLS player initializes ONLY once
useEffect(() => {
  const hls = new Hls();
  hlsRef.current = hls;
  hls.loadSource(streamUrl);  // Called ONCE
  hls.attachMedia(video);
  
  return () => hls.destroy();
}, []); // Empty deps array
```

### 2. No Aggressive Seeking
```typescript
// Only correct if drift > 1 second
const drift = Math.abs(video.currentTime - expectedTime);
if (drift > 1.0 && !isSeekingRef.current) {
  video.currentTime = expectedTime;
}
```

### 3. Buffer Safety
```typescript
// Wait for readyState >= 2 before playing
video.addEventListener('canplay', handleCanPlay);
video.addEventListener('waiting', handleWaiting);
```

### 4. Player Isolation
- Minimal props passed to VideoPlayer
- Uses refs to maintain HLS instance
- Not dependent on global UI state
- No re-renders trigger player reloads

## 🔄 Synchronization System

### Client-Side Logic

The sync system receives state from the backend:
```typescript
interface SyncState {
  isPlaying: boolean;
  currentTime: number;
  startedAt: number | null;
}
```

### Sync Behavior

**On Join:**
- Set initial position ONCE
- Wait for video readyState >= 2

**During Playback:**
```typescript
// Calculate expected time
const elapsed = (Date.now() - startedAt) / 1000;
const expectedTime = currentTime + elapsed;

// Only correct if drift > 1 second
const drift = Math.abs(video.currentTime - expectedTime);
if (drift > 1.0) {
  video.currentTime = expectedTime;
}
```

**Role Permissions:**
- **Host**: Can play, pause, seek, control everything
- **Viewer**: Watch-only mode, synced to host's actions

## 🔌 Backend Integration

### API Endpoints (FastAPI Compatible)

```python
# Room Management
POST /api/rooms/create
POST /api/rooms/join
GET  /api/rooms/{room_id}

# Video Management
GET  /api/videos
POST /api/videos/upload
GET  /api/videos/{video_id}

# WebSocket
WS   /ws
```

### HLS Stream Format

Videos should be served as:
```
/output/videos/{video_id}/stream.m3u8
```

### WebSocket Messages

```typescript
// Sync message
{
  type: 'sync',
  data: {
    isPlaying: boolean,
    currentTime: number,
    startedAt: number | null
  }
}

// Chat message
{
  type: 'chat',
  data: {
    id: string,
    userId: string,
    username: string,
    message: string,
    timestamp: string
  }
}

// Participant events
{
  type: 'participant_join' | 'participant_leave',
  data: { userId, username }
}
```

## 🎨 Design System

### Colors
- **Background**: Pure black (#0A0A0A)
- **Primary**: Neon green (#00FFB2)
- **Secondary**: Electric blue (#3B82F6)
- **Borders**: White with 10% opacity

### Typography
- Clean, modern font stack
- Consistent sizing and weights
- Optimized for readability

### Components
- Soft rounded corners (16px+)
- Subtle glow borders on accents
- Glassmorphism effects
- Smooth transitions

## 🚀 Getting Started

### Demo Usage

1. **Create a Room**
   - Enter your name
   - Set a room name
   - Select a demo video
   - Click "Create Room"

2. **Join a Room**
   - Enter your name
   - Enter the room ID
   - Click "Join Room"

3. **Watch Together**
   - Host controls playback
   - Viewers are synced automatically
   - Chat in real-time
   - See all participants

### Connecting to Real Backend

Replace mock implementations in `/src/app/lib/`:

1. **api.ts**: Replace mock functions with actual fetch calls
2. **websocket.ts**: Replace MockWebSocket with real WebSocket connection

Example:
```typescript
// Real API call
export const api = {
  async createRoom(name: string, videoId: string, hostUsername: string) {
    const response = await fetch('YOUR_API_URL/api/rooms/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, videoId, hostUsername })
    });
    return response.json();
  }
};

// Real WebSocket
const ws = new WebSocket('ws://YOUR_API_URL/ws');
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  // Handle sync, chat, etc.
};
```

## 🧪 Debug Logs

The player includes comprehensive logging:
- `[VideoPlayer]` - Player lifecycle events
- `[WebSocket]` - Connection and message events
- `[API]` - API call results
- `[Room]` - Room state changes

Check browser console for debug information.

## ⚡ Performance Optimizations

1. **Memoization**: Callbacks use `useCallback` to prevent re-renders
2. **Refs**: Player instance stored in ref, not state
3. **Lazy Updates**: UI updates only on actual state changes
4. **Efficient Sync**: Drift correction throttled to prevent jitter

## 🛡️ Error Handling

- Buffering state with visual indicator
- HLS error recovery
- WebSocket reconnection logic
- Toast notifications for user feedback
- Graceful fallbacks for missing data

## 📱 Responsive Design

- **Desktop**: Fixed sidebar with full controls
- **Tablet**: Collapsible sidebar
- **Mobile**: Full-width video, floating sidebar toggle

## 🔒 Production Considerations

### Security
- Validate room IDs and user inputs
- Implement proper authentication
- Use HTTPS for video streams
- Sanitize chat messages

### Performance
- CDN for video delivery
- Server-side HLS transcoding
- WebSocket connection pooling
- Database optimization for user data

### Monitoring
- Track video buffering events
- Monitor sync drift metrics
- Log WebSocket disconnections
- User engagement analytics

## 📝 Notes

- Currently uses demo HLS streams from public sources
- Mock WebSocket simulates backend behavior
- Session storage used for user persistence
- All animations and transitions are hardware-accelerated

## 🎯 Testing Checklist

- [ ] Video loads without errors
- [ ] Play/pause works for host
- [ ] Viewers cannot control playback
- [ ] Sync correction only happens when drift > 1s
- [ ] Chat messages appear in real-time
- [ ] Participants list updates correctly
- [ ] Fullscreen mode works
- [ ] Volume controls function properly
- [ ] Mobile sidebar is collapsible
- [ ] Room creation/joining flows work

---

Built with ❤️ for production-grade streaming experiences.
