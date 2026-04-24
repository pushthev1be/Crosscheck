# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server at http://localhost:5173
npm run build     # tsc + vite build → outputs to dist/
npm run preview   # Preview production build locally
```

There is no linter and no test runner configured.

## Environment Variables

Create `.env.local` with:
```
VITE_GEMINI_API_KEY_1=<gemini_key>
VITE_SUPABASE_URL=<supabase_url>
VITE_SUPABASE_ANON_KEY=<supabase_anon_key>
VITE_NVIDIA_API_KEY=<nvidia_nim_key>   # from build.nvidia.com — required for diagram questions
```

Supabase falls back to a chainable no-op mock if the URL is not configured. The NVIDIA key is optional; if absent, diagram question generation fails gracefully (skipped per page with an error log entry).

## Architecture

CrossCheck is a single-page React app with no client-side router. Screen navigation is driven by `activeScreen` state in [App.tsx](App.tsx), which acts as both the state machine and top-level orchestrator. All complex logic lives in App.tsx — do not push more orchestration logic into components.

**Screens:** `home` → `setup` → `session` → `report`, controlled by `setActiveScreen()` calls.

**Services layer** ([services/](services/)) is the only place that touches external APIs:
- [geminiService.ts](services/geminiService.ts) — all Gemini calls (topic extraction, session turns, report generation, image OCR)
- [personalityService.ts](services/personalityService.ts) — personality extraction from chat logs + system instruction builder
- [supabaseClient.ts](services/supabaseClient.ts) — Supabase client init with mock fallback

**Types** are centralized in [types.ts](types.ts) — `AppState`, `CheckSession`, `SessionTurnResponse`, `KnowledgeReport`, `PersonalityProfile`, etc. Add new types here.

## Key Implementation Details

### Gemini Integration
All Gemini calls use `generateContentStream()` rather than `generateContent()`. Streaming sidesteps Gemini's structured output validation, which throws on truncated JSON. Never switch back to non-streaming for calls that return JSON.

### JSON Recovery (`safeParseJSON`)
`geminiService.ts` contains a 6-stage fallback pipeline for malformed AI output: direct parse → clean markdown/trailing commas → slice to last valid brace → repair truncated arrays → truncate to last safe element → regex field extraction. Do not simplify or remove stages — each handles a real failure mode.

### Session Escalation
AI tone auto-escalates based on elapsed % of session duration:
- 0–25%: Friend (warm, short questions)
- 25–50%: Tutor (encouraging nudges)
- 50–75%: Instructor (expects depth)
- 75–100%: Examiner (rigorous, minimal feedback)

When Personality Mode is active, it overrides the Friend phase only. The system instruction for each phase is built in `geminiService.ts`.

### "I Don't Know" Detection
A regex in App.tsx detects "I don't know" / "idk" / "not sure" in user input and injects override instructions into the next Gemini call: brief explanation, simpler follow-up, mark topic weak, ≤40 words.

### Overtime Mode
After session time expires, if any topics are weak or untested, the session continues in Overtime (Examiner mode only, focused on gaps). This logic lives in the timer `useEffect` in App.tsx.

### Persistence
- Past reports: `localStorage` key `crosscheck-reports` (capped at 20)
- Theme: `localStorage` key `crosscheck-theme`
- Personality profile: `localStorage` key `crosscheck-personality`, gated by PIN + email

### Theme System
5 themes (light, dark, pink, ocean, emerald) defined as CSS variable sets in [index.css](index.css). Theme class is applied to `<html>`. All colors must use `--color-*` variables — no hardcoded colors.

### Client-Side Document Processing
- PDF: `pdfjs-dist`, page-by-page, no server upload
- Images: Gemini Vision with inline base64
- DOCX: `mammoth`
- All processing happens in-browser; nothing is uploaded to a backend.

### Retry Logic
`retryWithBackoff()` in geminiService.ts retries on 503/429 with exponential backoff (1s → 2s → 4s, max 3 attempts).

## Diagram Questions

PDF uploads render each page to a `<canvas>` via `pdfjs-dist` and store as `ExtractedImage[]` in App.tsx state (in-memory only — never persisted). In SetupView, users select which pages to use, then `nvidiaService.generateDiagramQuestion()` calls the NVIDIA NIM vision model (`meta/llama-3.2-11b-vision-instruct`) for each selected page. Generated questions are reviewed/approved before the session starts.

During a session, every 4th AI message triggers injection of a `DiagramQuestion` as an additional AI message with `tag: 'diagram'` and `imageId` set. SessionView renders the page image above the question bubble when `imageDataUrl` is available. Gemini evaluates the user's answer to diagram questions the same as any other turn.

## Session Persistence

All sessions are saved to Supabase (`sessions` table) on start, after every turn, and on completion. `services/sessionService.ts` handles upsert/load. `ExtractedImage.dataUrl` and `DiagramQuestion.imageDataUrl` are stripped before DB writes — images are in-memory only.

HomeView shows incomplete sessions (status `active` | `overtime`) with a **Resume** button. `handleResumeSession` in App.tsx restores `session`, `elapsedSeconds`, `noteContent`, `extractedTopics`, and navigates to the session screen. The Supabase `sessions` table has RLS policies — users can only access their own rows.
