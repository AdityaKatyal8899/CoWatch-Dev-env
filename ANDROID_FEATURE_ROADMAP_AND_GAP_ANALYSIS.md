# 🎬 CoWatch Platform Status & Android Feature Roadmap

> **Document Version:** 1.0.0  
> **Last Updated:** September 10, 2026  
> **Status:** Web Application Feature-Complete (100%) | Android App Hybrid Baseline (55%)

---

## 📌 Executive Summary

The **CoWatch Web Platform** has reached full operational maturity with real-time synchronized video streaming (HLS + YouTube dual-engine), low-latency LiveKit voice rooms, an Object-Oriented subscription and quota enforcement domain, bespoke Vibers gradient styling, automated email pipelines, and an audio SFX suite.

The **CoWatch Android App** (`cowatch-android`) currently functions as a **Hybrid Native WebView Wrapper** with background upload capabilities. While it renders the web experience and handles foreground video uploads, it lacks essential mobile-native UX patterns such as **Picture-in-Picture (PiP)**, **Push Notifications (FCM)**, **Lock-Screen Playback Controls**, and **Background Voice Streaming**.

This document outlines the exact feature parity matrix, details all current gaps, and provides the step-by-step technical implementation roadmap to bring the Android app to 100% native quality.

---

## 📊 Platform Feature Comparison Matrix

| Feature Area | Web Application | Android App | Status / Gap Description |
| :--- | :---: | :---: | :--- |
| **Real-time Stream Sync (HLS & YouTube)** | ✅ 100% | ✅ 100% | Rendered via WebView with drift correction (<0.5s). |
| **LiveKit Spatial Voice Chat** | ✅ 100% | ✅ 90% | Works in foreground; WebRTC permissions bridged. Drops when app is backgrounded. |
| **Background Video Uploads** | ✅ 100% | ✅ 100% | Native `UploadService.kt` with Android foreground notification progress bar. |
| **Bespoke Vibers Gradient Studio** | ✅ 100% | ✅ 100% | Touch-compatible 360° angle slider, 8-way compass, and CSS variables work in WebView. |
| **Audio Notification Suite** | ✅ 100% | ✅ 100% | `text.mp3`, `joined.mp3`, and `uploadDone.mp3` loaded via `/sounds/`. |
| **Picture-in-Picture (PiP)** | ❌ N/A (Desktop) | ❌ **Missing** | Stream stops when switching to other apps (WhatsApp/Discord). |
| **Push Notifications (FCM)** | ✅ (Email only) | ❌ **Missing** | No device push alerts when rooms start or videos finish transcoding. |
| **Lock-Screen Media Controls** | ❌ N/A | ❌ **Missing** | No `MediaSessionCompat` integration for Bluetooth/lock-screen controls. |
| **Background Audio / Voice** | ❌ N/A | ❌ **Missing** | Audio stops when the screen is turned off or locked. |
| **Auto-Rotate / Sensor Lock** | ❌ N/A | ❌ **Missing** | Does not auto-rotate into landscape on video fullscreen. |
| **Google Play In-App Billing** | ✅ (Razorpay/Stripe) | ❌ **Missing** | Uses web checkout instead of Google Play Billing API. |

---

## 🔍 Detailed Analysis of Android Feature Gaps

### 1. 🪟 Picture-in-Picture (PiP) Mode (Priority: High)
* **Current Behavior:** When a user presses the Home button or switches apps to chat on Discord/WhatsApp, the WebView pauses playback.
* **Target Experience:** The video smoothly shrinks into a floating mini-player at the corner of the screen so the user can continue watching and listening while multitasking.
* **Technical Requirement:**
  - Add `android:supportsPictureInPicture="true"` in `AndroidManifest.xml`.
  - Override `onUserLeaveHint()` in `MainActivity.kt` to trigger `enterPictureInPictureMode(params)`.
  - Update `WebChromeClient` to detect fullscreen video bounds and pass aspect ratio `Rational(16, 9)`.

---

### 2. 🔔 Push Notifications via Firebase Cloud Messaging (FCM) (Priority: High)
* **Current Behavior:** Users only receive updates via email (SMTP). If the app is closed, they have no real-time mobile push awareness.
* **Target Experience:**
  - *"Aditya started a Watch Party in 'Anime Night'! [Tap to Join]"*
  - *"🎬 Your video 'Inception_1080p.mp4' is ready to stream!"*
  - *"🎁 You received a Vibers VIP Gift Voucher!"*
* **Technical Requirement:**
  - Add `firebase-messaging` SDK to `cowatch-android/app/build.gradle`.
  - Implement `CoWatchFirebaseMessagingService.kt` to handle background token registration and heads-up notifications.
  - Add `fcm_token` column to `backend/app/database/models.py` (User model) and endpoint `POST /api/user/fcm-token`.

---

### 3. ⏯️ Lock-Screen & Bluetooth MediaSession Controls (Priority: Medium)
* **Current Behavior:** The Android operating system treats the WebView as a browser tab. The device lock screen and connected Bluetooth headphones cannot play/pause the video.
* **Target Experience:** A native media notification card with video title, thumbnail, play/pause buttons, and Bluetooth earphone single-tap control.
* **Technical Requirement:**
  - Implement `MediaSessionCompat` and `MediaSessionConnector`.
  - Bridge WebView play/pause state changes via JavaScript Interface to update `PlaybackStateCompat`.

---

### 4. 🎧 Background Audio & Voice Persistence (Priority: Medium)
* **Current Behavior:** When the user locks their phone, the Android OS puts the WebView to sleep, killing the LiveKit voice room connection and stream audio.
* **Target Experience:** Voice chat and video audio continue streaming in the background with minimal battery drain.
* **Technical Requirement:**
  - Create a lightweight `AudioStreamService.kt` background service with a persistent notification while inside a watch room.

---

### 5. 🔄 Fullscreen Auto-Rotation & Sensor Control (Priority: Low)
* **Current Behavior:** When a user taps the fullscreen button on the video player, it stays constrained by the current device orientation lock.
* **Target Experience:** Tapping fullscreen automatically rotates the activity to `ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE` and reverts to `SCREEN_ORIENTATION_PORTRAIT` upon exiting.

---

### 6. 💳 Google Play In-App Billing (IAP) (Priority: Future Phase)
* **Current Behavior:** Plan subscriptions are handled via Razorpay web checkout or Redeem Coupons.
* **Target Experience:** One-tap native Android subscriptions (Free Trial, Pro, Pro+, Vibers VIP) billed directly through Google Play accounts.
* **Technical Requirement:**
  - Integrate `com.android.billingclient:billing-ktx:6.2.0+`.
  - Add backend receipt verification route in `backend/app/payments/`.

---

## 🛠️ Step-by-Step Technical Implementation Plan

```
┌─────────────────────────────────────────────────────────────┐
│                       ROADMAP PHASES                        │
├─────────────────┬───────────────────────────┬───────────────┤
│ Phase 1: UX     │ Picture-in-Picture (PiP)  │ 1 - 2 Days    │
│                 │ Auto-Rotate Fullscreen    │               │
├─────────────────┼───────────────────────────┼───────────────┤
│ Phase 2: Push   │ Firebase Cloud Messaging  │ 2 - 3 Days    │
│                 │ Backend FCM Dispatcher    │               │
├─────────────────┼───────────────────────────┼───────────────┤
│ Phase 3: Media  │ MediaSession Lock-Screen  │ 2 - 3 Days    │
│                 │ Background Audio Service  │               │
├─────────────────┼───────────────────────────┼───────────────┤
│ Phase 4: Store  │ Google Play Billing IAP   │ 3 - 4 Days    │
│                 │ App Store Packaging       │               │
└─────────────────┴───────────────────────────┴───────────────┘
```

---

### Phase 1: Picture-in-Picture (PiP) Implementation Blueprint

#### 1. `AndroidManifest.xml` Configuration
```xml
<activity
    android:name=".MainActivity"
    android:exported="true"
    android:configChanges="screenSize|smallestScreenSize|screenLayout|orientation"
    android:supportsPictureInPicture="true">
</activity>
```

#### 2. `MainActivity.kt` PiP Trigger
```kotlin
override fun onUserLeaveHint() {
    super.onUserLeaveHint()
    // Trigger PiP only when user is inside an active room
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && isInsideWatchRoom) {
        val aspectRatio = Rational(16, 9)
        val pipParams = PictureInPictureParams.Builder()
            .setAspectRatio(aspectRatio)
            .build()
        enterPictureInPictureMode(pipParams)
    }
}
```

---

### Phase 2: Push Notifications (FCM) Blueprint

#### 1. `CoWatchFirebaseMessagingService.kt`
```kotlin
class CoWatchFirebaseMessagingService : FirebaseMessagingService() {
    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        val title = remoteMessage.notification?.title ?: "CoWatch"
        val body = remoteMessage.notification?.body ?: ""
        val deepLink = remoteMessage.data["deep_link"] ?: "https://cowatch-theta.vercel.app/dashboard"
        
        showNotification(title, body, deepLink)
    }

    override fun onNewToken(token: String) {
        // Post token to backend /api/user/fcm-token
    }
}
```

---

## 🎯 Conclusion & Next Steps

The web platform is in prime condition with complete feature coverage, stable single-stream HLS streaming, and robust subscription enforcement. 

When you are ready to resume development on the Android app, **Phase 1 (Picture-in-Picture & Fullscreen Auto-Rotate)** is the highest ROI starting point to deliver an immediate, dramatic upgrade in mobile watch party usability.
