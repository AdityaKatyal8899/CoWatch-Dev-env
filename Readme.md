# CoWatch 🎬

CoWatch is a high-performance, real-time synchronized video streaming platform. Built to deliver a shared viewing experience, it allows users to create rooms, invite friends, and watch videos together with frame-perfect synchronization, accompanied by real-time chat.

---

## ✨ Features

- **Synchronized Playback:** Perfect host-viewer synchronization using real-time WebSockets and deterministic playback buffering.
- **Real-Time Chat:** Integrated themed chat system tailored for live rooms.
- **HLS Video Streaming:** Powered by `hls.js`, generating robust streaming segments for low latency and smooth playback.
- **Background Processing:** Video uploads are seamlessly processed into HLS streams asynchronously using Celery and Redis.
- **Responsive UI:** A beautiful, responsive interface crafted with Tailwind CSS and Next.js, ensuring an optimal experience on both desktop and mobile devices.

---

## 🏗 Architecture

CoWatch is built using a modern, scalable technology stack:

### Frontend
- **Framework:** Next.js (React)
- **Styling:** Tailwind CSS
- **Video Playback:** HLS.js embedded within customized HTML5 Video components.
- **State & Sync:** Custom React hooks for maintaining precise WebSocket connections and video timeline state.

### Backend
- **Core Framework:** FastAPI (Python) for rapid execution and async support.
- **Real-time Engine:** FastAPI WebSockets to maintain concurrent bidirectional streams.
- **Task Queue:** Celery for distributed task execution (video chunking & HLS generation).
- **Message Broker:** Redis for Celery coordination.
- **Database:** PostgreSQL (via SQLAlchemy) for user, room, and metadata management.

> *Note:* Video segments are currently processed and saved onto local storage, S3 integration is planned for the future.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- Python 3.10+
- Redis Server (Running locally or via Docker)
- PostgreSQL Database

### 1. Backend Setup

Navigate to the `backend` directory:
```bash
cd backend
```

Create a virtual environment and install dependencies:
```bash
python -m venv venv
source venv/bin/activate  # On Windows use: venv\Scripts\activate
pip install -r requirements.txt
```

Set up your `.env` variables (Database URL, Redis URL, etc.).

Start the FastAPI application:
```bash
uvicorn app.main:app --reload
```

Start the Celery worker (in a new terminal):
```bash
celery -A app.celery_app worker --loglevel=info --pool=solo
```

### 2. Frontend Setup

Navigate to the `project` directory:
```bash
cd project
```

Install dependencies:
```bash
npm install
```

Start the development server:
```bash
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000).

---

## 💡 How It Works

1. **Upload:** A user uploads a video file. The FastAPI backend dispatches a Celery task to chunk the video into an HLS format (`.m3u8` and `.ts` files).
2. **Room Creation:** Once processed, the host can initialize a CoWatch room. 
3. **Synchronization:** As the host scrubs, plays, or pauses the video, absolute state messages are broadcasted via WebSockets to all connected viewers.
4. **Playback Smoothing:** Viewer clients leverage buffer-gating, drift calculation, and dynamic playback rates to stay seamlessly in sync without intrusive hard-seeks.

---

## 📜 License
MIT License