# CoWatch — Content Moderation Policy & Enforcement Plan

Status: **Draft spec (2026-08-12).** Concrete enough to build from. Policy wording and any
legal-liability language must be reviewed by counsel before launch — see "Legal notes" below.

This document covers both the *policy* (what is and isn't allowed) and the *enforcement model*
(how the platform detects, blocks, and reports). It supersedes the rough 4-point guidelines
discussed on 2026-08-12.

---

## 1. Policy tiers

### Tier 1 — Zero tolerance (auto-detect + human review + report)
- Child sexual abuse material (CSAM), sex trafficking, and terrorism / violent extremist content.
- **Platform response:** immediate takedown, account ban, preservation of evidence, and a report
  submitted to the appropriate authority (e.g., NCMEC CyberTipline in the US; regional equivalents
  in EU/UK). This is a legal obligation, not a discretionary policy.
- No warnings. No appeals for Tier 1 (appeals cover false-positive *detection*, handled via the
  report-review queue, not a public appeal button).

### Tier 2 — Chat abuse / prohibited speech (automated filter + host tools)
- Prohibited in chat: slurs, targeted harassment, and severe profanity (configurable word list).
- **Platform response:** server-side filter on the WebSocket chat handler (never trust the client).
  Default action = **warn + repeat-mute** (silent-drop is too aggressive for a social watch party).
  Slurs/harassment are treated as hate speech from day one (do not defer hate-speech coverage — see
  "Open decisions").
- Hosts additionally get kick / mute / ban via the existing LiveKit admin grant (UI unbuilt — see
  backend plan).

### Tier 3 — Adult content (gated, not banned)
- Rooms/videos containing adult (18+) material are **permitted only when explicitly flagged 18+ by
  the host** and only for age-verified viewers (see §2).
- Unflagged adult content detected by monitoring is **auto-cancelled** and the host receives a
  **warning** (see §3). Repeated offenses escalate to Tier 1-style account action.

### Tier 4 — General community conduct
- Spam, scams, non-consensual imagery, copyright-infringing streams → report-driven takedown.

---

## 2. Age verification (18+ gating)

**Goal:** a viewer cannot enter an 18+ room unless the platform has a verified signal that they are
≥ 18. Under-aged or unverified users see: *"You can't join right now — this is an 18+ room."*

### How verification works (concrete)
1. **Primary signal — self-declared date of birth at signup.** Captured on Google OAuth signup
   (or later in profile). Stored as `users.date_of_birth` + derived `age_verified` flag.
   - *Why self-declared first:* Google OAuth's standard `userinfo` does **not** return a birthdate.
     The deprecated `birthday.read` scope returns partial/empty data for most accounts, and Google's
     regional Age Verification program is not broadly available. So we cannot rely on Google for age.
2. **OAuth signal (best-effort):** if Google returns any age/age-range/verification signal via an
   approved scope, store it as `age_verification_method = "google"` and trust it when present.
3. **Robust verification (where legally required):** for markets under UK OSA / EU DSA / strict US
   state laws, integrate a third-party age-verification provider (Yoti, Persona, Veriff, Shufti) as
   `age_verification_method = "kyc"`. Self-declared DOB is not "robust" under those regimes.
4. **Gate logic:** on join to a room where `rooms.is_adult = true`:
   - `user.age_verified AND age >= 18` → allow.
   - else → block with the 18+ message; do not reveal room contents.

### Data touched
- `users.date_of_birth` (nullable), `users.age_verified` (bool), `users.age_verification_method`
  (enum: `self_declared` | `google` | `kyc` | `none`).

---

## 3. Host responsibility & monitoring (adult rooms)

- **Host obligation:** the host MUST flag a room as 18+ at creation/join time if the content is
  adult. This is surfaced in the create-room flow (`CreateRoomRequest.is_adult`).
- **Platform monitoring:** a review process (manual queue initially; automated classifiers later)
  scans active rooms for unflagged adult content.
- **Enforcement on detection of unflagged adult room:**
  1. **Auto-cancel** the room (disconnect all participants, mark `rooms.status = 'cancelled'`).
  2. Issue the host a **warning** (stored in `moderation_warnings`).
  3. Third offense (or egregious first offense) → account review / ban.
- **Liability framing:** the host is responsible for correctly flagging; running unflagged adult
  content exposes the host to liability. The platform's operational response is cancel + warn. Any
  "you can be sued" language belongs in the **Terms of Service**, reviewed by counsel — not in app
  copy. (See Legal notes.)

---

## 4. Reporting & appeals

- **Report button:** every room and chat message gets a "Report" action → creates a
  `moderation_reports` row (reporter, target, reason, evidence snapshot, timestamp).
- **Review queue:** internal endpoint/UI to triage reports → action (takedown / warn / ban / dismiss).
- **Appeals:** for warnings and bans (excluding confirmed Tier 1), a user can submit an appeal;
  tracked in `moderation_appeals`.

---

## 5. Backend implementation plan

### 5.1 New/changed models (`backend/app/database/models.py`)
- `User`: add `date_of_birth` (Date, nullable), `age_verified` (Boolean, default False),
  `age_verification_method` (String/Enum, default `"none"`).
- `Room`: add `is_adult` (Boolean, default False), `status` (String/Enum: `active` | `cancelled`,
  default `active`).
- New table `ModerationWarning { id, user_id (FK), room_id (nullable FK), reason, created_at }`.
- New table `ModerationReport { id, reporter_id (FK), target_type, target_id, reason,
  evidence_json, status (open|reviewed|dismissed|actioned), created_at }`.
- New table `ModerationAppeal { id, user_id (FK), report_or_warning_id, status, created_at }`.
- CSAM/report audit log: `ModerationReport` above + an immutable export path for authority reports.

### 5.2 Auth / profile (`backend/app/auth/routes.py`, `user/routes.py`)
- On Google signup, request DOB (UI prompt) and store `date_of_birth` + `age_verification_method`.
- Merge any Google age signal if present.
- Profile endpoint allows setting/updating `date_of_birth`; recompute `age_verified`.

### 5.3 Room create/join gating (`backend/app/rooms/routes.py`, `rooms/websockets.py`)
- `CreateRoomRequest.is_adult` (bool) → sets `Room.is_adult`.
- Join (HTTP + WS) checks: if `room.is_adult` and not `(user.age_verified and age>=18)` →
  reject with `403 ADULT_AGE_REQUIRED` and the 18+ copy.
- Monitoring task: scan active `is_adult=false` rooms; on suspected unflagged adult → cancel +
  `ModerationWarning`.

### 5.4 Chat filter (`backend/app/rooms/websockets.py` chat handler)
- Server-side normalization (strip spaces/leetspeak) + prohibited-word list (config-driven).
- Action: warn + repeat-mute. Slurs/harassment → also raise a `ModerationReport` candidate.

### 5.5 Host moderation tools (LiveKit admin grant — currently no UI/route)
- New `rooms` routes: `POST /rooms/{id}/moderate/kick`, `/mute`, `/ban` (host-only, checks host
  identity via `get_current_user` — folds into Tier 2 backlog item #1, auth-aware `create_room`).

### 5.6 Reporting/appeals routes (new `backend/app/moderation/routes.py`)
- `POST /api/moderation/report`, `GET /api/moderation/reports` (staff),
  `POST /api/moderation/appeals`. Register in `main.py` at `/api`.

### 5.7 Migration (`backend/scratch/migrate_db.py` — IPv6 gotcha applies)
```sql
ALTER TABLE users ADD COLUMN date_of_birth DATE NULL;
ALTER TABLE users ADD COLUMN age_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN age_verification_method VARCHAR(32) NOT NULL DEFAULT 'none';
ALTER TABLE rooms ADD COLUMN is_adult BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE rooms ADD COLUMN status VARCHAR(32) NOT NULL DEFAULT 'active';
CREATE TABLE moderation_warnings (...);
CREATE TABLE moderation_reports (...);
CREATE TABLE moderation_appeals (...);
```
Run on **Windows / Supabase SQL editor** (WSL cannot reach IPv6-only Supabase), then restart backend.

---

## 6. Open decisions still pending
- **Hate speech scope:** decided — cover slurs/harassment in Tier 2 from day one; "maybe later" only
  applies to *policy refinement*, not absence of coverage.
- **Monitoring method:** manual queue first; automated classifiers later (cost/accuracy tradeoff).
- **Third-party KYC:** required only for regulated markets; default path is self-declared DOB.
- **Chat filter strictness:** warn+repeat-mute default; confirm before shipping a hard block.

## 7. Legal notes (not legal advice)
- I am not a lawyer. The "host can be sued" framing, ToS liability clauses, and CSAM reporting
  obligations must be reviewed by qualified counsel for each operating jurisdiction.
- CSAM/terrorism reporting is a statutory duty in most regions — wire the reporting pipeline before
  any user-generated content goes live, independent of the rest of this plan.
- Age-verification legal thresholds differ by country (UK OSA, EU DSA, US state laws). Confirm which
  apply before relying on self-declared DOB alone.

---

## 8. Verification & testing strategy (no real explicit content)

**Principle:** test the *enforcement logic and plumbing*, never the *detection of real illegal
content*. You **never create, source, or store** CSAM / explicit material — not even synthetic — for
testing. Possessing or generating such material is itself illegal; the law-abiding path is to
delegate detection to authority-provided resources and test only your *response* to a trigger.

### 8.1 Age gate (Tier 3 join logic) — fully testable with data, zero content
Create fixture users: `u_minor` (DOB → age 15, `age_verified=false`),
`u_adult_unverified` (age 30, `age_verified=false`), `u_adult_verified` (age 30,
`age_verified=true`). Create an `is_adult=true` room. Assert:
- minor → `403 ADULT_AGE_REQUIRED` + the 18+ copy.
- unverified adult → `403`.
- verified adult → allowed.
- `is_adult=false` room → all three allowed (negative test).

### 8.2 Host flag + monitoring auto-cancel (Tier 3 enforcement)
Use a **dev-only** trigger `simulate_unflagged_adult(room_id)` that invokes the *same* cancel +
warning code path the monitor would. Assert: `rooms.status='cancelled'`, participants disconnected,
`ModerationWarning` row created for host. No actual adult content involved — you trigger the
*response*, not the detection.

### 8.3 Chat filter (Tier 2)
Unit-test the normalizer + word list against benign strings containing prohibited words / leetspeak /
spaced variants. Assert warn + repeat-mute. No harm content needed.

### 8.4 Tier 1 (CSAM / trafficking / terrorism) response pipeline
- **Do NOT** test with any real or synthetic illegal content. Detection is delegated to
  authority-provided hash lists (e.g., NCMEC / PhotoDNA) you do not build or host test copies of.
- Test only the *response machinery*: a dev-only `simulate_tier1_match(target_user_id)` runs the
  same takedown + ban + evidence-preserve + report-export code the real matcher calls. Assert:
  account banned, content flagged, evidence snapshot written, `ModerationReport` row created, export
  produces the authority-format file.
- Separately verify the hash-list *ingestion* path is wired (matcher loads the authority list and
  compares) using a known-safe dummy hash — never a real CSAM hash you generated.

### 8.5 No email verification — current state & handling
- Auth is **Google OAuth**, so the identity is already email-verified *by Google* — you have a
  baseline trusted identity even without your own email verification. Self-declared `date_of_birth`
  is the age signal.
- Add a lightweight email-verification step later (Supabase Auth confirm or your own token) to raise
  account trust; not blocking for the age gate's v1.
- For 18+ room access, a lying minor can game self-declared DOB. v1 accepts this as a baseline
  "reasonable step" (ToS puts liability on the user); plan KYC for regulated markets. Optionally
  require Google's age signal (if present) as a stronger check before allowing 18+ room *creation*.

---

## 9. Implementation status (2026-08-12)

### 9.1 Backend changes landed
- **Models** (`app/database/models.py`):
  - `User.date_of_birth` (Date), `User.age_verified` (bool), `User.age_verification_method`
    (`none|self_declared|google|kyc`), `User.terms_accepted_at` (timestamptz), `User.is_banned`,
    `User.banned_reason`.
  - `Room.is_adult` (bool), `Room.status` (`active|canceled`).
  - New tables: `moderation_warnings`, `moderation_reports`, `moderation_appeals`.
- **Moderation module** (`app/moderation/`): `config.py` (profanity list + `moderate_message()` +
  `is_age_verified()`), `routes.py` (accept-terms, report, appeals, dev-only sim endpoints).
  Registered at `/api/moderation` in `main.py`.
- **Age gate**: enforced on `POST /api/rooms/join` (HTTP) and the `/ws/rooms/{id}/{uid}` socket —
  adult rooms reject unverified/under-aged/guest users with `ADULT_AGE_REQUIRED`. 18+ rooms can only
  be created by age-verified (>=18) hosts. Cancelled rooms reject join/connect.
- **Chat filter**: server-side `moderate_message()` on every WS `chat` message; first violations warn
  the sender, the `CHAT_WARN_THRESHOLD`-th (3rd) violation mutes them for `CHAT_MUTE_SECONDS` (5 min,
  auto-expiring — on expiry the mute clears and the violation count resets). In-memory; state resets on
  backend restart. Client shows `chat_warning` toast.
- **Banned users**: `get_current_user` rejects `is_banned` accounts with 403.
- **Onboarding**: now captures `date_of_birth` (ISO), computes `age` + `age_verified` server-side.

### 9.2 Frontend changes landed
- `User` type + `api` client: `acceptTerms()`, `reportContent()`, `submitAppeal()`.
- **Post-login guard** (`lib/auth.tsx`): terms acceptance is the first gate → `/guidelines`; then
  onboarding → dashboard.
- **`/guidelines` page**: scrollable guidelines + must-accept checkbox; Accept calls `acceptTerms()`
  then routes to onboarding (new users) or dashboard (returning). Added to middleware protected paths.
- **Room page**: handles `chat_warning` (moderation toast).
- **Onboarding**: age input replaced with Date of Birth capture.
- **Create Stream** (`pages/CreateStream.tsx`): added an 18+ toggle in Room Configuration that sets
  `is_adult` on room creation. Disabled (with a hint) unless the host is `age_verified`.

### 9.3 Migration (IPv6 gotcha applies)
`scratch/migrate_db.py` adds the new `users`/`rooms` columns (idempotent). The three new moderation
tables are auto-created by `Base.metadata.create_all` on backend startup. **Run the migration on
Windows or the Supabase SQL editor, then restart the backend.**

### 9.4 Verification runbook (no real explicit content)
1. **Age gate**: create fixture users — minor (DOB → age 15, `age_verified=false`),
   unverified adult (age 30, `age_verified=false`), verified adult (age 30, `age_verified=true`).
   Flag a room `is_adult=true`. Assert: minor → `403 ADULT_AGE_REQUIRED`, unverified → blocked,
   verified → allowed. Non-adult room → all allowed.
2. **Host flag + auto-cancel**: `POST /api/moderation/_dev/sim-unflagged-adult {room_id}` → room
   `status=cancelled`, host gets a `moderation_warnings` row, participants disconnected. (Dev-only;
   disabled when `ENVIRONMENT=production`.)
3. **Chat filter**: send a message containing a profanity term → sender gets `chat_warning`, message
   not broadcast; 3rd violation → muted.
4. **Tier 1 response**: `POST /api/moderation/_dev/sim-tier1 {user_id}` → user `is_banned=true`,
   `moderation_reports` row created, authority-export step stubbed. (Dev-only.)
5. **Terms gate**: log in as a user with `terms_accepted_at=null` → redirected to `/guidelines`;
   Accept → routed onward.

> These dev-sim endpoints trigger the *same* enforcement code paths production uses, with synthetic
> state only. They never process real or synthetic illegal content.
