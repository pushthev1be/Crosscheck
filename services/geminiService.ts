
import { GoogleGenAI } from "@google/genai";
import { ExtractedTopic, CheckSession, SessionTurnResponse, KnowledgeReport, TopicStatus, PersonalityProfile } from "../types";
import { buildPersonalityInstruction } from "./personalityService";

// Mode escalates as session progresses: Friend (0-25%) → Tutor (25-50%) → Instructor (50-75%) → Examiner (75-100%)
function getSessionMode(elapsedSeconds: number, totalSeconds: number): 'friend' | 'tutor' | 'instructor' | 'examiner' {
  const pct = totalSeconds > 0 ? elapsedSeconds / totalSeconds : 0;
  if (pct < 0.25) return 'friend';
  if (pct < 0.50) return 'tutor';
  if (pct < 0.75) return 'instructor';
  return 'examiner';
}

const MODE_INSTRUCTIONS: Record<'friend' | 'tutor' | 'instructor' | 'examiner', string> = {
  friend: `CURRENT MODE: Friend
You're a knowledgeable mate helping them warm up. Keep it casual and relaxed.
- Short, breezy questions. "So what's X about?" / "Give me the quick version of Y."
- React warmly when they're right: "Yeah exactly." / "Yep, that's it." / "Nice."
- When they're off: "Hmm, not quite — what do the notes say about that?"
- Keep questions under 12 words. One at a time. Zero pressure.`,

  tutor: `CURRENT MODE: Tutor
You're a patient tutor helping them build understanding. Still supportive, but more deliberate.
- Guide them toward deeper answers: "Good start — now what's the mechanism behind that?" / "Almost, what's the part you're missing?"
- Acknowledge effort: "Good thinking." / "You've got part of it." / "That's the right direction."
- If they're stuck, give a small nudge: "Think about what happens when X — does that help?"
- Questions should be clear and focused, one concept at a time.`,

  instructor: `CURRENT MODE: Instructor
You're a clear, authoritative instructor. Encouraging but expect more precision now.
- Acknowledge correct answers briefly then push further: "Correct. Now explain why." / "Right — and what's the implication of that?"
- No soft nudges for wrong answers: "That's not quite right. What does X actually mean?"
- Expect complete thoughts. A one-liner isn't enough for complex topics — follow up once.
- Questions are direct and purposeful. Still one question per turn.`,

  examiner: `CURRENT MODE: Examiner
You're a rigorous examiner in the final stretch. Precise, minimal small talk.
- Probe for depth: "Walk me through X." / "What's the relationship between X and Y?" / "Why does X lead to Y?"
- Minimal reactions — just "Correct." or "Incomplete — elaborate." then next question.
- Follow up once on weak or vague answers, then move on and mark it.
- Cover any remaining untested topics. This is the last window to assess everything.`
};

const BASE_RULES = `
RULES (apply in all modes):
1. One question per turn. Always. Never multi-part questions.
2. React briefly to the previous answer before asking the next question.
3. Cover all extracted topics before the session ends.
4. Assess each topic: strong / weak / revisit based on the quality of their answers.

PROFICIENCY LEVELS:
- strong: Explained it clearly, handled a follow-up
- weak: Shallow or couldn't elaborate when pushed
- revisit: Clear misconception or critical gap`;


function repairTruncatedJSON(s: string): string {
  let t = s.trimEnd();
  const stack: string[] = [];
  let inStr = false;
  let i = 0;

  // Walk the string tracking state properly, including escape sequences
  while (i < t.length) {
    const c = t[i];
    if (inStr) {
      if (c === '\\') { i += 2; continue; } // skip escaped char
      if (c === '"') inStr = false;
    } else {
      if (c === '"') inStr = true;
      else if (c === '{') stack.push('}');
      else if (c === '[') stack.push(']');
      else if (c === '}' || c === ']') stack.pop();
    }
    i++;
  }

  // If we ended inside a string, close it
  if (inStr) t += '"';

  // Remove trailing comma or incomplete key before closing
  t = t.replace(/,\s*$/, '');

  // Close all open structures
  return t + stack.reverse().join('');
}

function cleanJSON(s: string): string {
  return s
    .replace(/,(\s*[}\]])/g, '$1')   // trailing commas before } or ]
    .replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3'); // unquoted keys
}

function safeParseJSON(text: string): any {
  // Strip markdown fences (```json ... ``` or ``` ... ```)
  const stripped = text
    .replace(/^```(?:json)?\s*/im, '')
    .replace(/\s*```\s*$/im, '')
    .trim();

  // Direct parse
  try { return JSON.parse(stripped); } catch (e1) {
    console.warn('[safeParseJSON] Direct parse failed:', (e1 as Error).message, '| raw:', stripped.slice(0, 200));
  }

  // After cleaning trailing commas / unquoted keys
  try { return JSON.parse(cleanJSON(stripped)); } catch {}

  const objStart = stripped.indexOf('{');
  const arrStart = stripped.indexOf('[');
  const start = objStart === -1 ? arrStart : arrStart === -1 ? objStart : Math.min(objStart, arrStart);
  if (start === -1) {
    // Model returned plain text (common in personality mode) — wrap it as the message
    const plainText = stripped.replace(/^["']|["']$/g, '').trim();
    if (plainText.length > 0) {
      console.warn('[safeParseJSON] No JSON found, wrapping plain text as message:', plainText.slice(0, 100));
      return { message: plainText, isFollowUp: false, currentTopicId: '', sessionShouldEnd: false, overtimeNeeded: false };
    }
    console.error('[safeParseJSON] No JSON structure found:', stripped.slice(0, 300));
    throw new SyntaxError('No JSON found in response');
  }

  const slice = stripped.slice(start);

  try { return JSON.parse(slice); } catch (e2) {
    console.warn('[safeParseJSON] Slice parse failed:', (e2 as Error).message);
  }

  try { return JSON.parse(cleanJSON(slice)); } catch {}

  try {
    const repaired = repairTruncatedJSON(slice);
    console.info('[safeParseJSON] Repair attempt, tail:', repaired.slice(-80));
    return JSON.parse(repaired);
  } catch (e3) {
    console.warn('[safeParseJSON] Repair parse failed:', (e3 as Error).message);
  }

  try { return JSON.parse(cleanJSON(repairTruncatedJSON(slice))); } catch {}

  // Last resort: truncate to last safe closed element
  try {
    let depth = 0, inStr = false, lastSafeEnd = -1;
    for (let i = 0; i < slice.length; i++) {
      const c = slice[i];
      if (inStr) {
        if (c === '\\') { i++; continue; }
        if (c === '"') inStr = false;
      } else {
        if (c === '"') inStr = true;
        else if (c === '{' || c === '[') depth++;
        else if (c === '}' || c === ']') { depth--; if (depth <= 1) lastSafeEnd = i; }
      }
    }
    if (lastSafeEnd > 0) {
      const truncated = repairTruncatedJSON(slice.slice(0, lastSafeEnd + 1));
      console.warn('[safeParseJSON] Using truncated fallback, kept', lastSafeEnd, 'of', slice.length, 'chars');
      return JSON.parse(truncated);
    }
  } catch (e4) {
    console.warn('[safeParseJSON] Truncation fallback failed:', (e4 as Error).message);
  }

  // Final fallback: extract any valid fields we can via regex, reconstruct minimal object
  try {
    const extract = (key: string, type: 'string' | 'bool' | 'obj') => {
      if (type === 'string') {
        const m = stripped.match(new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`));
        return m ? m[1] : null;
      }
      if (type === 'bool') {
        const m = stripped.match(new RegExp(`"${key}"\\s*:\\s*(true|false)`));
        return m ? m[1] === 'true' : null;
      }
      return null;
    };
    // Try to get a partial message string (may be truncated)
    const msgMatch = stripped.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    const partialMsg = msgMatch ? msgMatch[1].replace(/\\n/g, ' ').replace(/\\"/g, '"') : '';
    const result: any = {
      isFollowUp: extract('isFollowUp', 'bool') ?? false,
      currentTopicId: extract('currentTopicId', 'string') ?? '',
      sessionShouldEnd: extract('sessionShouldEnd', 'bool') ?? false,
      overtimeNeeded: extract('overtimeNeeded', 'bool') ?? false,
      message: partialMsg || 'Go on.',
    };
    console.warn('[safeParseJSON] Used regex fallback, recovered:', JSON.stringify(result).slice(0, 200));
    return result;
  } catch {}

  console.error('[safeParseJSON] All parse attempts failed. Full response:', stripped);
  throw new SyntaxError('Could not parse Gemini response as JSON');
}

async function retryWithBackoff<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const retryable = err?.status === 503 || err?.status === 429 || err?.message?.includes('overloaded');
      if (!retryable || i === maxRetries - 1) throw err;
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
    }
  }
  throw lastError;
}

async function imageToBase64(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(binary);
}

export async function extractTextFromImage(files: File | File[]): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY_1 || '' });
  const fileList = Array.isArray(files) ? files : [files];

  const parts: any[] = [];
  for (const file of fileList) {
    const base64 = await imageToBase64(file);
    parts.push({ inlineData: { mimeType: file.type, data: base64 } });
  }
  parts.push({
    text: fileList.length > 1
      ? `Extract all text from these ${fileList.length} images in order, preserving headings, bullet points, and structure. Separate each image's content with "--- Page X ---". Return only the extracted text.`
      : 'Extract all text from this image exactly as written. Preserve headings, bullet points, numbered lists, and structure. Return only the extracted text.'
  });

  return retryWithBackoff(async () => {
    const stream = await ai.models.generateContentStream({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts }],
      config: { maxOutputTokens: 8000, thinkingConfig: { thinkingBudget: 0 } }
    });
    let text = '';
    for await (const chunk of stream) {
      const part = chunk.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof part === 'string') text += part;
    }
    if (!text.trim()) throw new Error('No text found in image.');
    return text;
  });
}

export async function extractTopicsFromNotes(noteContent: string): Promise<{ title: string; topics: ExtractedTopic[] }> {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY_1 || '' });

  const prompt = `Analyze these study notes. Extract all major topics and their key concepts. Assign each topic a short snake_case id (e.g. "cardiac_physiology"). Identify the section or heading in the notes where each topic appears if possible.

NOTES:
${noteContent}`;

  return retryWithBackoff(async () => {
    const stream = await ai.models.generateContentStream({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        systemInstruction: `You are an expert academic analyst. Extract structured topic data from study notes.
RESPOND WITH ONLY RAW JSON — no markdown, no code fences, no explanation.
Format: {"title":"string","topics":[{"id":"snake_case","name":"string","concepts":["string"],"noteSection":"string"}]}
Start your response with { and end with }. Nothing else.`,
        maxOutputTokens: 8000,
        thinkingConfig: { thinkingBudget: 0 }
      }
    });

    let text = '';
    for await (const chunk of stream) {
      const part = chunk.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof part === 'string') text += part;
    }
    console.log('[extractTopicsFromNotes] streamed len:', text.length, '| preview:', text.slice(0, 100));
    if (!text.trim()) throw new Error("Empty response");
    const parsed = safeParseJSON(text);
    return { title: parsed.title || "Uploaded Notes", topics: parsed.topics || [] };
  });
}

export async function runSessionTurn(
  session: CheckSession,
  userMessage: string | null,
  elapsedSeconds: number,
  isFirstTurn: boolean,
  personality?: PersonalityProfile
): Promise<SessionTurnResponse> {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY_1 || '' });

  const totalSeconds = session.duration * 60;
  const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);
  const remainingMinutes = Math.ceil(remainingSeconds / 60);
  const mode = session.isOvertimeActive ? 'examiner' : getSessionMode(elapsedSeconds, totalSeconds);

  const topicSummary = session.topics.map(t => {
    const perf = session.topicPerformances[t.id];
    const status = perf ? perf.status : 'untested';
    return `- ${t.name} (id: ${t.id}) [${status}] — concepts: ${t.concepts.slice(0, 4).join(', ')}`;
  }).join('\n');

  const conversationHistory = session.messages.slice(-20).map(m => ({
    role: m.role === 'ai' ? 'model' as const : 'user' as const,
    parts: [{ text: m.content }]
  }));

  const systemContext = `
NOTES TITLE: ${session.uploadTitle}
SESSION DURATION: ${session.duration} minutes
TIME REMAINING: ~${remainingMinutes} minute(s)
IS OVERTIME: ${session.isOvertimeActive}

TOPICS TO COVER:
${topicSummary}

NOTES CONTENT (excerpt):
${session.noteContent.slice(0, 3000)}${session.noteContent.length > 3000 ? '\n[...notes truncated...]' : ''}

${isFirstTurn ? `This is the first turn. You are in Friend mode. Open casually — one short sentence to kick things off ("Alright, let's see what you've got." / "Cool, let's dig in."), then your first question. Two sentences max.` : `Current mode: ${mode.toUpperCase()}.`}
${session.isOvertimeActive ? 'OVERTIME ACTIVE: Focus only on weak/revisit topics. End the session once those are resolved.' : ''}
${remainingMinutes <= 3 && !session.isOvertimeActive ? 'TIME IS RUNNING LOW: Prioritize any untested or weak topics.' : ''}`;

  const contents = isFirstTurn
    ? [{ role: 'user' as const, parts: [{ text: '[Session starting. Begin the audit.]' }] }]
    : [...conversationHistory];

  const isDontKnow = !isFirstTurn && (
    /^(i\s+don'?t\s+know|idk|no\s+idea|not\s+sure|i\s+have\s+no\s+idea)$/i.test(userMessage?.trim() ?? '')
  );

  const DONT_KNOW_OVERRIDE = isDontKnow ? `
STUDENT SAID "I DON'T KNOW":
- Give a clear, brief explanation of the correct answer (2-3 sentences max) directly in "message".
- Then ask ONE easier follow-up about the same topic to check basic understanding.
- Mark the topic as "weak" in topicUpdate.
- Keep the whole message under 40 words.
- Do NOT scold or be negative. Just explain and move on.` : '';

  const JSON_FORMAT_INSTRUCTION = `OUTPUT RULES — MUST FOLLOW EXACTLY:
- Respond with ONLY a single raw JSON object. No markdown, no code fences, no preamble.
- Put "message" FIRST in the JSON — before all other fields.
- "message": ${isDontKnow ? 'Brief explanation (2-3 sentences) + one easy follow-up question. Max 40 words.' : 'ONE reaction (≤6 words) + ONE question (≤10 words). Absolute max: 16 words.'}
- Required JSON shape (message must come first):
  {"message":"string","isFollowUp":bool,"currentTopicId":"string","sessionShouldEnd":bool,"overtimeNeeded":bool}
- topicUpdate (add only when you're confident about a topic rating):
  {"topicId":"string","status":"strong|weak|revisit","evidence":"string"}
- Start response with { — nothing before it.${DONT_KNOW_OVERRIDE}`;

  const systemInstruction = mode === 'friend' && personality
    ? `${JSON_FORMAT_INSTRUCTION}\n\n${buildPersonalityInstruction(personality.name, personality.style)}\n\n${BASE_RULES}\n\n${systemContext}`
    : `${JSON_FORMAT_INSTRUCTION}\n\nYou are CrossCheck, a knowledge audit tool.\n\n${MODE_INSTRUCTIONS[mode]}\n\n${BASE_RULES}\n\n${systemContext}`;

  return retryWithBackoff(async () => {
    // Use streaming to bypass SDK-level JSON validation that throws on truncated responses
    const stream = await ai.models.generateContentStream({
      model: 'gemini-2.5-flash',
      contents,
      config: {
        systemInstruction,
        maxOutputTokens: isDontKnow ? 800 : 500,
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 0 }
      }
    });

    let text = '';
    for await (const chunk of stream) {
      const part = chunk.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof part === 'string') text += part;
    }

    console.log('[runSessionTurn] streamed len:', text.length, '| full:', text);
    if (!text.trim()) throw new Error("Empty response from Gemini");
    return safeParseJSON(text) as SessionTurnResponse;
  });
}

export async function detectTextRegions(imageDataUrl: string, question: string): Promise<Array<{x: number; y: number; w: number; h: number}>> {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY_1 || '' });
  const base64 = imageDataUrl.replace(/^data:image\/[a-z+]+;base64,/, '');
  const mimeType = (imageDataUrl.match(/^data:(image\/[a-z+]+);/) ?? [])[1] ?? 'image/jpeg';

  const stream = await ai.models.generateContentStream({
    model: 'gemini-2.5-flash',
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType, data: base64 } },
        { text: `A student will be asked this question about this image:
"${question}"

Your job: identify ONLY the text regions that directly reveal the answer to that question. This includes filled-in answers, answer keys, solution labels, result values, or any text that gives away what the student should figure out themselves.

DO NOT redact: axis labels, category names, diagram titles, scale indicators, or any text needed to understand and interpret the diagram — only redact text that GIVES AWAY the answer.

For each region to redact, return its bounding box as percentages of image dimensions with 4px of extra padding.

Return ONLY a JSON array. Each item: {"x": leftEdge%, "y": topEdge%, "w": width%, "h": height%}
Values are 0–100. Return [] if nothing needs to be hidden. No explanation, no markdown — just the JSON array.` }
      ]
    }],
    config: { maxOutputTokens: 1500, thinkingConfig: { thinkingBudget: 0 } }
  });

  let text = '';
  for await (const chunk of stream) {
    const part = chunk.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof part === 'string') text += part;
  }

  try {
    const regions = safeParseJSON(text);
    if (!Array.isArray(regions)) return [];
    return regions.filter((r: any) =>
      typeof r.x === 'number' && typeof r.y === 'number' &&
      typeof r.w === 'number' && typeof r.h === 'number'
    );
  } catch {
    console.warn('[detectTextRegions] parse failed:', text.slice(0, 200));
    return [];
  }
}

export async function generateKnowledgeReport(session: CheckSession): Promise<KnowledgeReport> {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY_1 || '' });

  const conversationSummary = session.messages
    .map(m => `${m.role === 'ai' ? 'EXAMINER' : 'STUDENT'}: ${m.content}`)
    .join('\n\n');

  const existingAssessments = Object.values(session.topicPerformances)
    .map(p => `${p.topicName}: ${p.status} — ${p.evidence}`)
    .join('\n');

  const prompt = `Generate a final knowledge breakdown report for this audit session.

NOTES TITLE: ${session.uploadTitle}
TOPICS EXTRACTED:
${session.topics.map(t => `- ${t.name} (id: ${t.id}, section: ${t.noteSection || 'N/A'})`).join('\n')}

EXISTING TOPIC ASSESSMENTS:
${existingAssessments || 'None recorded during session.'}

FULL CONVERSATION:
${conversationSummary.slice(0, 8000)}

Classify each topic as strong/weak/revisit/untested. For any weak or revisit topics, add specific concepts to the revisitList with references to the note section where possible.`;

  return retryWithBackoff(async () => {
    const stream = await ai.models.generateContentStream({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        systemInstruction: `You are CrossCheck. Generate an accurate, evidence-based knowledge breakdown report.
RESPOND WITH ONLY RAW JSON — no markdown, no code fences, no explanation.
Format: {"topics":[{"topicId":"string","topicName":"string","status":"strong|weak|revisit|untested","evidence":"string","noteSection":"string"}],"revisitList":[{"concept":"string","topicName":"string","noteSection":"string"}]}
Start your response with { and end with }. Nothing else.`,
        maxOutputTokens: 4000,
        thinkingConfig: { thinkingBudget: 0 }
      }
    });

    let text = '';
    for await (const chunk of stream) {
      const part = chunk.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof part === 'string') text += part;
    }
    console.log('[generateKnowledgeReport] streamed len:', text.length, '| preview:', text.slice(0, 100));
    if (!text) throw new Error("Empty response");
    const parsed = safeParseJSON(text);

    const actualMinutes = session.endTime
      ? Math.round((session.endTime - session.startTime) / 60000)
      : session.duration;

    return {
      sessionId: session.id,
      date: new Date().toISOString(),
      uploadTitle: session.uploadTitle,
      durationMinutes: session.duration,
      actualDurationMinutes: actualMinutes,
      topics: (parsed.topics || []).map((t: any) => ({
        ...t,
        concepts: session.topics.find(st => st.id === t.topicId)?.concepts || []
      })),
      revisitList: parsed.revisitList || [],
      overtimeUsed: session.isOvertimeActive
    } as KnowledgeReport;
  });
}
