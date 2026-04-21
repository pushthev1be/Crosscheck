# CrossCheck

> AI-powered knowledge audit tool — conversational, adaptive, brutally honest about your gaps.

CrossCheck lets you upload study notes and runs you through a live Q&A session that escalates in pressure as you progress, then produces a structured breakdown of exactly what you know and what you don't. Built as a full-stack solo project in React 19 + TypeScript, with Gemini 2.5 Flash handling all AI logic.

<img width="719" height="621" alt="Image" src="https://github.com/user-attachments/assets/85f114e3-032d-4690-8706-ce3ce9cfc1be" />
---

## Live demo

**[crosscheck-j4vf.onrender.com](https://crosscheck-j4vf.onrender.com)**

| Upload notes | Live audit | Knowledge report |
|---|---|---|
| PDF, image, or plain text | Conversational examiner, adaptive pressure | Strong / Weak / Needs Revisit per topic |

---

## How it works

Most study tools quiz you passively. CrossCheck interrogates you the way an examiner would — conversationally, with follow-ups, escalating difficulty, and no hand-holding.

1. **Upload notes** — PDF, plain text, or images. Client-side extraction via `pdfjs-dist` + Gemini Vision (multi-page, inline base64 in a single API call).
2. **Topic extraction** — Gemini maps key concepts from the notes automatically.
3. **Adaptive audit session** — The AI examiner shifts mode as the session progresses:
   - **Friend** (0–25%) → warm, relaxed warm-up
   - **Tutor** (25–50%) → guided understanding
   - **Instructor** (50–75%) → precise, no soft nudges
   - **Examiner** (75–100%) → rigorous, minimal reactions
4. **"I don't know"** — One tap delivers the correct answer with explanation, marks the topic weak, and continues with a simpler follow-up.
5. **Knowledge report** — Every topic scored Strong / Weak / Needs Revisit with supporting evidence. Weak topics expand to show the specific concepts to revisit.
6. **Personality mode** — Optional: upload exported chat logs and Gemini extracts speech patterns, phrases, and humor style to build a custom AI persona that quizzes you in someone's voice. PIN + email gated.

---

## Engineering highlights

### Streaming-first AI pipeline
All Gemini calls use `generateContentStream` rather than `generateContent`. The SDK throws on structured JSON output that gets truncated before the closing brace — switching to streaming and consuming chunks manually sidesteps the validation entirely.

### Resilient JSON recovery
Gemini's structured output can still return malformed JSON under token pressure. Built a 6-stage `safeParseJSON` pipeline that handles it gracefully:

1. Direct parse
2. Clean (trailing commas, unquoted keys, escaped quotes)
3. Slice to last valid closing brace
4. Repair truncated arrays/objects
5. Truncation fallback (extract whatever completed before the cutoff)
6. Regex field extraction as last resort

Zero crashes in production from malformed AI output.

### Personality extraction
Conversation logs (WhatsApp, iMessage, Discord) are analyzed by Gemini to extract a `PersonalityStyle` schema: speech patterns, phrase vocabulary, emoji frequency, humor type, reaction style. The result is injected as a system instruction, transforming the examiner's tone in real time.

### Client-side document processing
PDF text extraction and image OCR run entirely in the browser — no backend file upload, no server storage. Large PDFs are chunked and processed page-by-page via `pdfjs-dist` before being passed to Gemini Vision.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite |
| AI | Google Gemini 2.5 Flash (`@google/genai`) |
| Auth + DB | Supabase (email auth + PostgreSQL) |
| PDF parsing | pdfjs-dist (client-side) |
| Animations | Framer Motion |
| Styling | CSS variables (full light/dark theming) |

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
```

---

## Deploy

**Build command:** `npm run build`  
**Publish directory:** `dist`

Works on Vercel, Netlify, or Render. Add the `.env.local` variables as environment variables in your hosting dashboard.
