# CrossCheck

**CrossCheck** is a conversational knowledge audit tool. Upload your study notes, and CrossCheck runs you through an adaptive Q&A session to surface exactly what you know and what you don't — then gives you a structured breakdown of your gaps.

Built with React 19, TypeScript, Google Gemini 2.5 Flash, and Supabase.

---

## What it does

Most study tools quiz you passively. CrossCheck interrogates you the way an examiner would — conversationally, with follow-ups, and with escalating pressure as the session progresses.

1. **Upload notes** — PDF, plain text, or images (multi-page supported). Gemini Vision extracts and structures the content.
2. **AI extracts topics** — Key concepts are identified and mapped from the notes automatically.
3. **Live audit session** — A Gemini-powered examiner works through each topic in conversation. Mode escalates over the session:
   - **Friend** (0–25%) → relaxed warm-up
   - **Tutor** (25–50%) → guided understanding
   - **Instructor** (50–75%) → precise, no soft nudges
   - **Examiner** (75–100%) → rigorous, minimal reactions
4. **"I don't know"** — One tap gives you the correct answer with explanation, then continues with a simpler follow-up. Topic is marked weak automatically.
5. **Knowledge report** — After the session, every topic is classified as Strong / Weak / Needs Revisit with evidence. Weak topics expand to show the exact concepts to go back and study.
6. **Study again** — Re-run a session on the same notes in one click.

---

## Technical highlights

| Area | Detail |
|---|---|
| **AI** | Google Gemini 2.5 Flash via `@google/genai` SDK |
| **Streaming** | All Gemini calls use `generateContentStream` — bypasses SDK-level JSON validation that throws on truncated structured output |
| **JSON recovery** | 6-stage `safeParseJSON` pipeline: direct parse → clean (trailing commas, unquoted keys) → slice → repair truncated structures → truncation fallback → regex field extraction |
| **Vision** | Multi-image OCR via inline base64 in a single Gemini call |
| **Auth** | Supabase email + password auth |
| **Persistence** | Session reports stored in localStorage (last 20 sessions) |
| **Personality mode** | Optional feature: train a personality from exported chat logs (Gemini extracts speech patterns, phrases, humor style). Activates in Friend mode only. PIN + email gated. |
| **Theming** | Full light/dark CSS variable system |

---

## Stack

- **React 19** + **TypeScript** + **Vite**
- **Google Gemini 2.5 Flash** (text + vision)
- **Supabase** (auth + PostgreSQL)
- **pdfjs-dist** (client-side PDF text extraction)

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

## Deploy (Render / Vercel / Netlify)

**Build command:** `npm install && npm run build`  
**Publish directory:** `dist`

Add your `.env.local` variables as environment variables in your hosting dashboard.
