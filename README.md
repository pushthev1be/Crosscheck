# CrossCheck

> AI-powered knowledge audit tool — conversational, adaptive, brutally honest about your gaps.

CrossCheck lets you upload study notes and runs you through a live Q&A session that escalates in pressure as you progress, then produces a structured breakdown of exactly what you know and what you don't. Built as a full-stack solo project in React 19 + TypeScript, powered by Gemini 2.5 Flash, NVIDIA NIM vision models, and Supabase.

<img width="719" height="621" alt="Image" src="https://github.com/user-attachments/assets/85f114e3-032d-4690-8706-ce3ce9cfc1be" />

---

## Live demo
https://youtu.be/QDo0nn68ewU


**[crosscheck-j4vf.onrender.com](https://crosscheck-j4vf.onrender.com)**

| Upload notes | Live audit | Diagram questions | Knowledge report |
|---|---|---|---|
| PDF, image, or plain text | Conversational examiner, adaptive pressure | Visual challenges from your diagrams | Strong / Weak / Needs Revisit per topic |

---

## How it works

Most study tools quiz you passively. CrossCheck interrogates you the way an examiner would — conversationally, with follow-ups, escalating difficulty, and no hand-holding.

1. **Upload notes** — PDF, plain text, or images. Client-side extraction via `pdfjs-dist` + Gemini Vision.
2. **Topic extraction** — Gemini maps key concepts from the notes automatically.
3. **Adaptive audit session** — The AI examiner shifts mode as the session progresses:
   - **Friend** (0–25%) → warm, relaxed warm-up
   - **Tutor** (25–50%) → guided understanding
   - **Instructor** (50–75%) → precise, no soft nudges
   - **Examiner** (75–100%) → rigorous, minimal reactions
4. **Diagram questions** — Select pages with diagrams in your PDF. NVIDIA NIM (`llama-3.2-11b-vision-instruct`) generates 3 visual challenge questions per page — function, relationship, and process angles. Text labels are redacted from the image using pdfjs exact text coordinates before being shown to the student. Questions are injected every 4th AI turn with a blur-to-reveal image card and fullscreen lightbox.
5. **"I don't know"** — One tap delivers the correct answer, marks the topic weak, and continues with a simpler follow-up.
6. **Overtime mode** — If weak or untested topics remain when time expires, the session continues in Examiner mode focused only on those gaps.
7. **Knowledge report** — Every topic scored Strong / Weak / Needs Revisit with supporting evidence. Weak topics expand to show specific concepts to revisit.
8. **Session persistence** — All sessions are saved to Supabase. Resume any incomplete session from the home screen exactly where you left off.
9. **Personality mode** — Upload exported chat logs and Gemini extracts speech patterns, phrases, and humor style to build a custom AI persona that quizzes you in someone's voice. PIN + email gated.

---

## Engineering highlights

### Streaming-first AI pipeline
All Gemini calls use `generateContentStream` rather than `generateContent`. The SDK throws on structured JSON output that gets truncated before the closing brace — streaming and consuming chunks manually sidesteps the validation entirely.

### Resilient JSON recovery
Gemini's structured output can return malformed JSON under token pressure. A 6-stage `safeParseJSON` pipeline handles it without crashing:

1. Direct parse
2. Clean (trailing commas, unquoted keys)
3. Slice to last valid closing brace
4. Repair truncated arrays/objects
5. Truncation fallback — extract whatever completed before the cutoff
6. Regex field extraction as last resort

### Diagram question pipeline
PDF pages are rendered to `<canvas>` via `pdfjs-dist`. Text positions are extracted from the PDF's text layer (exact pixel coordinates, no OCR guessing) and painted over on a second canvas to produce a label-free copy for the student. The original labeled image is sent to NVIDIA NIM via a Supabase Edge Function proxy (to avoid CORS) which generates targeted visual questions. Three questions per page are generated with rotating angles (function → relationship → process) so no two questions test the same dimension of understanding.

### Session persistence and resume
Every session is upserted to Supabase after each turn. The resume flow restores full state — topics, messages, elapsed time, note content, and any in-memory diagram questions. Base64 image data is stripped before DB writes so storage stays lean.

### Personality extraction
Conversation logs (WhatsApp, iMessage, Discord) are analyzed by Gemini to extract a `PersonalityStyle` schema: speech patterns, phrase vocabulary, emoji frequency, humor type, reaction style. The result is injected as a system instruction, transforming the examiner's tone in the Friend phase only.

### Client-side document processing
All document processing runs in the browser — no backend file upload, no server storage. PDFs are processed page-by-page, images are passed as inline base64, DOCX files via `mammoth`. The NVIDIA API call is the only one that routes through a backend (Supabase Edge Function) to avoid CORS.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite |
| AI — session | Google Gemini 2.5 Flash (`@google/genai`) |
| AI — diagrams | NVIDIA NIM `llama-3.2-11b-vision-instruct` |
| Auth + DB | Supabase (email auth, PostgreSQL, Edge Functions) |
| PDF parsing | pdfjs-dist (client-side render + text extraction) |
| Styling | Inline styles + CSS variables (5 themes: light, dark, pink, ocean, emerald) |

---

## Local setup

```bash
npm install
npm run dev
```

Create `.env.local`:

```
VITE_GEMINI_API_KEY_1=your_gemini_key
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_NVIDIA_API_KEY=your_nvidia_nim_key   # from build.nvidia.com — required for diagram questions
```

Supabase falls back to a no-op mock if the URL is not set. The NVIDIA key is optional — diagram question generation fails gracefully (pages are skipped with a logged error) if absent.

### Supabase Edge Function

The NVIDIA vision calls are proxied through a Supabase Edge Function (`supabase/functions/nvidia-vision/`) to avoid CORS. Deploy it once:

```bash
supabase functions deploy nvidia-vision
```

---

## Deploy

A `render.yaml` is included for one-click Render static site deployment with correct MIME types and SPA routing. For other hosts:

**Build command:** `npm run build`  
**Publish directory:** `dist`

Add the `.env.local` variables as environment variables in your hosting dashboard.

---

Built by [push](https://oracleai.live) — also check out [oracleai.live](https://oracleai.live).
