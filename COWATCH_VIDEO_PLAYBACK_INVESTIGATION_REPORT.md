# CoWatch Video Playback Investigation Report

**Date**: April 9, 2026  
**Investigator**: Senior QA Engineer  
**Issue**: Viewers not seeing video playback despite correct sync and backend functioning  

---

## Executive Summary

**Root Cause Identified**: `video.play()` is never called for viewers due to a readyState guard clause in VideoPlayer.tsx that creates a race condition between WebSocket sync events and video element readiness.

**Impact**: Complete playback failure for all viewers while host functionality remains operational.

**Severity**: Critical - Core functionality broken for viewer experience.

---

## Investigation Scope

- **Player Behavior Analysis**: HLS initialization, video element mounting, readyState progression
- **Playback State Flow**: isPlaying value tracing, WebSocket event handling
- **Autoplay Restrictions**: Browser behavior and policy compliance
- **Re-render Loop Detection**: Excessive API request analysis
- **Video Element State**: paused, currentTime, readyState, buffered status
- **Source Consistency**: Host vs viewer stream URL verification
- **WebSocket Events**: Message reception and processing
- **Edge Cases**: Viewer logic blocking scenarios

---

## Detailed Findings

### 1. Player Behavior Analysis

| Component | Status | Details |
|-----------|--------|---------|
| **HLS Initialization** | **PASS** | Correctly initialized once per viewer using Hls.js |
| **Video Element Mounting** | **PASS** | Properly mounted with React refs |
| **Video ReadyState Progression** | **PASS** | ReadyState reaches >= 2 after manifest parsing |
| **video.play() Call** | **FAIL** | **Never executed due to guard clause** |

**Critical Issue**: Line 194 in `VideoPlayer.tsx` contains:
```typescript
if (!video || video.readyState < 2) return;
```

This guard exits the sync useEffect before reaching the play logic.

### 2. Playback State Flow

**Backend Flow**: 
```
Host plays video -> Backend updates room state -> WebSocket broadcasts -> Frontend receives
```

**Frontend Flow**:
```
WebSocket message -> syncState update -> useEffect trigger -> readyState guard -> EARLY RETURN
```

**Timeline Issue**:
1. WebSocket sync events arrive immediately
2. Video readyState is still < 2 at that moment
3. useEffect returns early, never reaching play() logic
4. Video readyState reaches >= 2 later
5. No re-trigger mechanism exists

### 3. Autoplay Restrictions Analysis

| Browser Policy | Status | Mitigation |
|----------------|--------|------------|
| **Autoplay Policy** | **PASS** | Code includes muted fallback |
| **User Interaction** | **PASS** | Proper error handling with muted retry |
| **Cross-origin** | **PASS** | Stream URLs from same origin |

**Conclusion**: Autoplay restrictions are NOT the issue. The play() method is never reached.

### 4. Re-render Loop Investigation

**API Polling Behavior**:
- **Location**: `Room.tsx` lines 135-147
- **Trigger**: Video processing_status !== 'ready'
- **Frequency**: Every 5 seconds
- **Cleanup**: Properly cleared when video becomes ready

**Assessment**: Polling is legitimate and expected behavior for non-ready videos.

### 5. Video Element State Analysis

**Current State Tracking**:
```typescript
// Logged states show:
console.log('[VideoPlayer] Current video paused state:', video.paused);
// Always shows: true (never plays)
```

**Missing Logs**:
- `[VideoPlayer] calling video.play()` - **Never appears in viewer logs**
- `[VideoPlayer] Viewer received isPlaying: true` - **Appears but no action taken**

### 6. Source Consistency Verification

| Parameter | Host | Viewer | Status |
|-----------|------|--------|--------|
| **Stream URL** | Same .m3u8 | Same .m3u8 | **PASS** |
| **WebSocket Events** | Receives | Receives | **PASS** |
| **Sync State** | Updates | Updates | **PASS** |

### 7. WebSocket Events Analysis

**Message Flow**:
```typescript
// Backend sends:
{
  "type": "room_state",
  "is_playing": true,
  "offset": 123.45,
  "started_at": "2026-04-09T..."
}

// WebSocket correctly parses and forwards:
{
  "type": "room_state", 
  "data": {
    "isPlaying": true,
    "currentTime": 123.45,
    "startedAt": 1649500000000
  }
}
```

**Status**: All WebSocket communication working correctly.

---

## Root Cause Analysis

### Primary Issue

**File**: `project/src/app/components/VideoPlayer.tsx`  
**Line**: 194  
**Code**: 
```typescript
if (!video || video.readyState < 2) return;
```

### Race Condition Details

1. **WebSocket Event Arrives**: `syncState` updates with `isPlaying: true`
2. **useEffect Triggers**: Sync logic runs immediately
3. **ReadyState Check**: `video.readyState` is still < 2
4. **Early Return**: Function exits before reaching play logic
5. **Video Becomes Ready**: readyState reaches >= 2
6. **No Re-trigger**: useEffect doesn't re-run with new readyState

### Missing Logic

The code needs either:
- **Wait Mechanism**: Delay sync processing until video is ready
- **Re-trigger Logic**: Re-process sync when video becomes ready
- **Separate Concerns**: Decouple readyState from sync event handling

---

## Component Failure Analysis

| Component | Failure Mode | Impact |
|-----------|-------------|--------|
| **VideoPlayer.tsx** | Guard clause prevents play() | **CRITICAL** |
| **WebSocket.tsx** | Working correctly | **PASS** |
| **Room.tsx** | Working correctly | **PASS** |
| **Backend WebSocket** | Working correctly | **PASS** |

---

## Test Evidence

### Console Log Analysis

**Viewer Logs Show**:
```
[VideoPlayer] Viewer received isPlaying: true
[VideoPlayer] Current video paused state: true
```

**Missing Critical Logs**:
```
[VideoPlayer] calling video.play()
[VideoPlayer] Play failed, trying muted...
[VideoPlayer] Muted play also failed:
```

### Network Request Analysis

**Expected Requests**:
- GET `/stream/video_id/stream.m3u8` - **Present**
- GET `/stream/video_id/seg_000.ts` - **Present**
- WebSocket connection - **Present**

**Unexpected Behavior**: No playback initiation despite successful resource loading.

---

## Impact Assessment

### User Experience Impact

| User Type | Impact | Severity |
|-----------|--------|----------|
| **Host** | Can play/pause/seek normally | **LOW** |
| **Viewer** | Cannot see video playback | **CRITICAL** |
| **System** | WebSocket sync works, but no visual playback | **HIGH** |

### Business Impact

- **Core Functionality**: Broken for majority of users (viewers)
- **User Retention**: Likely high abandonment rate
- **Feature Parity**: Host-only functionality creates poor UX

---

## Recommended Fix Strategy

### Immediate Fix Options

1. **Remove ReadyState Guard**: Remove line 194 guard clause
2. **Add ReadyState Listener**: Re-trigger sync when video becomes ready
3. **Delay Sync Processing**: Wait for video ready before processing sync

### Preferred Solution

Implement a readyState listener that re-processes the last sync state when video becomes ready:

```typescript
// Store last sync state
const lastSyncStateRef = useRef<SyncState | null>(null);

// When video becomes ready, re-process sync
const handleCanPlay = () => {
  if (lastSyncStateRef.current && !isHost) {
    processSyncState(lastSyncStateRef.current);
  }
};
```

---

## Testing Recommendations

### Regression Tests

1. **ReadyState Timing**: Test with various video load times
2. **Network Conditions**: Test with slow/poor connections
3. **Browser Compatibility**: Test across Chrome, Firefox, Safari
4. **Multiple Viewers**: Test with concurrent viewer joins

### Monitoring

1. **Playback Success Rate**: Track viewer play() success
2. **ReadyState Timing**: Monitor time to readyState >= 2
3. **Sync Event Latency**: Measure WebSocket to playback delay

---

## Conclusion

The investigation reveals a **single critical bug** preventing viewer playback: a readyState guard clause that creates a race condition with WebSocket sync events. The fix is straightforward and isolated to the VideoPlayer component.

**Next Steps**: Implement readyState-aware sync processing to ensure video.play() is called when viewers receive play events.

---

**Report Status**: **COMPLETE**  
**Root Cause**: **IDENTIFIED**  
**Fix Required**: **YES**  
**Priority**: **CRITICAL**
