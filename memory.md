---
name: cowatch-session-record
description: "Full record of the 2026-08-11 session — CoWatch subscription plans, coupon system, owner lifetime access, and the Tier 2 backlog"
metadata: 
  node_type: memory
  type: project
  originSessionId: b61ae809-b998-4b8e-9716-e8116b51d278
  modified: 2026-08-11T11:15:13.190Z
---

# CoWatch — Session Record (2026-08-11)

Comprehensive working memory so a fresh session can continue without re-deriving anything.

## Project at a glance
CoWatch is a **real-time synchronized video streaming ("watch together") platform**. Monorepo:
- `backend/` — FastAPI + SQLAlchemy (Postgres on **Supabase**), Celery + Redis for async HLS transcoding, S3 for storage, **LiveKit for audio-only voice chat**, WebSockets (`rooms/websockets.py`) for frame-sync playback, `slowapi` for rate limits.
- `project/` — Next.js frontend (design system: dark `#0B0B0F`, purple `--primary: #9333EA`, `glass-card`, `motion` from `motion/react`, lucide-react icons, `btn-primary`/`btn-secondary`, `DashboardLayout` + `PageTransition` + `heading-page`/`text-body`).
- `cowatch-android/` — very early Kotlin app (MainActivity + UploadService only).

## Business direction (from earlier discussion)
- Monetize **engineering capabilities**, not just the consumer platform. Two tracks:
  1. **Consumer subscriptions** on the platform (what we're building now).
  2. **BYOC / self-hosted SDK** — package the video pipeline (transcode→HLS/ABR→deliver) as a containerized SDK startups run on their own cloud, charged as a per-deployment license (free dev tier → ~$3–8k/yr production license). Keep the sync engine as the premium upsell. **Not yet started.**

## Subscription plan model (refined + implemented)
Four tiers. Values in `backend/app/subscriptions/plans.py` are the **single source of truth**:

| | Free $0 | Pro $4.99 | Pro+ $8.99 | Vibers $12.99 |
|---|---|---|---|---|
| Storage | 2 GB | 10 GB | 20 GB | 50 GB |
| Max upload quality | 720p | 1080p | 1080p | 4K (2160) |
| Room capacity (host+guests) | 6 | 16 | 31 | 500 (effectively unlimited) |
| YT rooms | 20/month | unlimited | unlimited | unlimited |
| Collections | ✗ | ✓ | ✓ | ✓ |
| Voice chat | ✗ | ✓ | ✓ | ✓ |
| Theme customization | ✗ (locked to `default-dark`) | ✓ | ✓ | ✓ |
| Priority transcoding | ✗ | ✓ | ✓ | always |
| Branding / moderation / analytics / API | — | — | — | ✓ (all unbuilt) |
| Watermark | ✗ (dropped from cards) | — | — | — |

- Annual pricing: $49 / $89 / $129 (2 months free). Billing toggle already in the Plans UI.
- **Pricing philosophy agreed with user:** price the *capability* (4K pipeline, capacity, voice), not the bytes — storage is nearly free, so Vibers is ~$13 because of 4K + capacity, not 50GB.

## What was built this session

### Frontend (`project/`)
- **`src/app/pages/Plans.tsx`** — animated pricing cards (4 tiers). Big fonts, monthly/annual toggle, count-up price (`useCountUp`), staggered entrance, hover lift, flagship Vibers gets rotating conic-gradient border (`co-spin`) + pulsing glow (`co-pulse`, both keyframes added to `src/styles/index.css`), per-plan icons (Users/Rocket/Zap/Crown). Reads `user.plan` for the Current-Plan badge. CTA buttons are stubs (`toast "checkout coming soon"`).
- **`src/app/plans/page.tsx`** — route wrapper. Nav item added to `DashboardLayout.tsx` (Gem icon, `/plans`). `/plans` added to `src/middleware.ts` protected paths. `User.plan?` added to `src/app/lib/types.ts`.

### Backend (`backend/app/`)
- **`subscriptions/plans.py`** (new) — `PLAN_CONFIG`, `DEFAULT_PLAN=free`, `DEFAULT_THEME="default-dark"`, helpers: `get_plan_config`, `get_user_plan`, `get_effective_plan` (owner→vibers; expired→free), `is_owner` (via `OWNER_EMAILS` env, case-insensitive), `plan_allows`, `user_allows`, `get_user_plan_config`.
- **`database/models.py`** — `User.plan` (default `free`), `User.plan_expires_at` (None = free/lifetime); new `Coupon` + `CouponRedemption` tables.
- **`videos/routes.py`** — upload enforces plan-based storage quota (413) instead of the column.
- **`user/routes.py`** — `/user/stats` returns plan-based `storageLimit`; onboarding forces free→`default-dark`; `update_profile` rejects theme changes for free (403).
- **`collections/routes.py`** — create_collection 403 for free.
- **`livekit/token_route.py`** — voice chat gated on **room host's effective plan** (guests inherit host tier).
- **`auth/routes.py`** — every Google sign-in syncs plan + `storage_limit`; owner email → `plan=vibers` + lifetime.
- **`coupons/routes.py`** (new) — `POST /api/coupons` (owner only, generate), `GET /api/coupons` (owner), `DELETE /api/coupons/{code}` (owner), `POST /api/coupons/redeem` (any authed user). Codes like `XXXX-XXXX` via `secrets`. Same user can't reuse a code (unique constraint). `duration_days` None = lifetime; `plan_expires_at` auto-reverts expired grants to Free. Registered in `main.py` at `/api`.

### Migrations
- **`scratch/migrate_db.py`** — adds `users.plan` and `users.plan_expires_at` columns (idempotent). New tables (`coupons`, `coupon_redemptions`) are auto-created by `create_all` on backend startup.

## Environment gotchas (IMPORTANT)
- **Supabase DB is IPv6-only** (`db.uupaxthhmzmsjxvxvqlj.supabase.co` has AAAA but NO A record). This WSL shell has no IPv6 route, so **migrations CANNOT run from WSL** — they must run on Windows (where the backend runs) or via the **Supabase dashboard SQL editor**.
- Backend runs on **Windows**, not in WSL. No uvicorn/celery visible in WSL `ps`.
- `migrate_db.py` prints the full DSN **including the DB password** — avoid pasting its output into public logs.
- `OWNER_EMAILS` placeholder added to `backend/.env` — **must be filled with the owner's email** for owner lifetime access + owner coupon endpoints to work.

## Migration status (as of end of session)
- ✅ `users.plan` column applied to Supabase (user did this).
- ⏳ `users.plan_expires_at` column + coupon tables: user still needs to run `scratch/migrate_db.py` on Windows (or SQL editor) and restart the backend. The backend running at end of session is still pre-coupon code.

## Tier 2 backlog (next up)
1. **Auth-aware `create_room`** — currently `rooms/routes.py` accepts an arbitrary `host_id` (guests bypass all gates). This unblocks YT-room counting and hard gating. Use `get_current_user_optional` to preserve guest rooms.
2. **Participant cap** — check `len(active_connections[room_id])` vs host's `max_participants` on WS join in `rooms/websockets.py` (room capacity is host-bound).
3. **YT-room monthly counter** — Redis key `yt_rooms:{user_id}:{YYYY-MM}` incremented on YouTube room creation; Free=20, paid=unlimited.
4. **Quality selection** — pass plan's `max_quality` into `process_video_to_hls` (`hls_worker.py` FFmpeg args); pipeline currently emits a single fixed rendition (no ABR).

## Deferred / unbuilt (heavy)
Priority transcoding queue (single flat Celery queue today), scheduled rooms (`scheduled_time` field is dead — "Remove scheduling logic" comment), moderation (kick/mute/ban/roles/chat-mod — LiveKit admin grant exists but no UI/route), custom branding (vanity links, room theming), creator analytics + productized API access.

## Open decisions still pending
- **3 vs 4 tiers** — Pro+ (Pro: 16 guests vs Pro+: 31) is a thin gap; collapse to Free/Pro/Vibers if it feels thin once built.
- **YT rooms on Free** — agreed to a monthly cap (~20/mo) so the viral invite loop survives while power users hit a conversion wall. Cap placement final.
- **"Dark Minimal" naming** — the codebase's default theme is `default-dark` (UI label "Original Dark"); no preset named "Dark Minimal". Free users are currently locked to the default entirely (strict interpretation). Alternative if desired: let Free users pick among the 5 presets, block only custom colors (one-line change in `user/routes.py`).
- **Webcam vs audio**: LiveKit is **audio-only** voice chat. Webcam presence is out of scope for plans.

## User notes
- Owner/founder of CoWatch. Wants: coupons to grant free subscriptions, owner's own lifetime free access, storage limits, and eventually the BYOC/SDK licensing play.
- Prefers fast, tiered, grounded implementation. Wanted bigger fonts + more animation on the plan cards (done). Prefers monetizing capabilities over raw resources.
