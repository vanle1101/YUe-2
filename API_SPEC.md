# Yue2 Reverse-Engineered API & Frontend Spec

Target: `https://yue.noizai.net/` (Meet Yue2 / NoizAI)

## 1. Frontend Architecture (`frontend/`)

- `index.html`: Static shell, EN/ZH toggle, Text-to-Music composer + Cover workspace + Showcase.
- `app.js`: Text-to-Music flow, polling every 3000ms, `AudioContext` waveform renderer, `localStorage` (`meet-yue2-history-v1`), `sessionStorage` (`meet-yue2-pending-v1`).
- `cover.js`: Cover song upload, Whisper/ASR lyrics recognition, SheetSage + YuE2 cover generation polling every 3000ms.
- `quota.js`: Client-side quota sync via `/api/quota` + `yue2_visitor` cookie.
- `showcase.js` / `showcase-data.js`: Static demo tracks.
- `analytics.js`: Outbound tracking / GA4 wrapper.

## 2. Endpoints

### `GET /api/quota`
Response `200`:
```json
{ "remaining": 999999 }
```

### `POST /api/jobs` (Text-to-Music)
Headers: `Idempotency-Key: <key>`, `Content-Type: application/json`
Response `200`:
```json
{
  "id": "job_...",
  "kind": "group",
  "status": "queued",
  "created_at": 1700000000.0,
  "completed_count": 0,
  "remaining": 999999,
  "request": { "...": "..." },
  "candidates": [
    { "id": "job_...-0", "status": "queued", "stage": "queued", "seed": 1234 },
    { "id": "job_...-1", "status": "queued", "stage": "queued", "seed": 1235 }
  ]
}
```

### `GET /api/jobs/{job_id}`
Polled every 3s until `status` is in `{"succeeded", "truncated", "partial_failed", "failed", "cancelled"}`.
Each succeeded candidate contains:
```json
{
  "id": "job_...-0",
  "status": "succeeded",
  "stage": "done",
  "seed": 1234,
  "result": {
    "audio_url": "/api/audio/...",
    "duration": 30.0
  }
}
```

### `POST /api/cover/sources`
Headers: `Content-Type: audio/*`, `X-Audio-Extension: mp3|wav|flac|m4a|aac|ogg`
Body: Raw binary audio bytes.
Response `200`:
```json
{ "source_id": "src_..." }
```

### `POST /api/cover/recognize-lyrics`
Headers: `Idempotency-Key: lyrics-...`, `Content-Type: application/json`
Body: `{ "source_id": "src_..." }`
Response `200`:
```json
{
  "has_vocals": true,
  "lyrics": "[Verse]\n...",
  "remaining": 999999
}
```

### `POST /api/cover/jobs`
Headers: `Idempotency-Key: cover-...`, `Content-Type: application/json`
Body:
```json
{
  "source_id": "src_...",
  "lyrics": "...",
  "music_description": "...",
  "style": "Pop, Electronic",
  "melody_adherence": 0.5,
  "vocal_gender": "female"
}
```
Response `200`:
```json
{
  "id": "cover_...",
  "status": "queued",
  "stage": "score_pending",
  "remaining": 999999
}
```

### `GET /api/cover/jobs/{job_id}`
Stages: `score_pending` -> `transcribing_score` -> `submitting_generation` -> `waiting_for_capacity` -> `generating` -> `done`.
Terminal statuses: `completed` | `failed`.
On `completed`:
```json
{
  "id": "cover_...",
  "status": "completed",
  "stage": "done",
  "remaining": 999999,
  "request": { "...": "..." },
  "candidates": [
    { "id": "cover_...-0", "result": { "audio_url": "/api/audio/..." } },
    { "id": "cover_...-1", "result": { "audio_url": "/api/audio/..." } }
  ]
}
```
