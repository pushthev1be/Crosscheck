import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const NVIDIA_BASE = 'https://integrate.api.nvidia.com/v1/chat/completions';
const VISION_MODEL = 'meta/llama-3.2-90b-vision-instruct';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-nvidia-key',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { imageDataUrl, topics, previousQuestions } = await req.json();
    const apiKey = req.headers.get('x-nvidia-key');
    if (!apiKey) return new Response(JSON.stringify({ error: 'Missing NVIDIA API key' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (!imageDataUrl) return new Response(JSON.stringify({ error: 'Missing imageDataUrl' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const topicNames = (topics ?? []).map((t: any) => t.name).join(', ');
    const prevQList = (previousQuestions ?? []).map((q: string, i: number) => `${i + 1}. ${q}`).join('\n');

    const prompt = `You are a study quiz generator. Analyze this image and do two things:

1. Generate ONE exam-quality question about a concept shown in this image that a student should be able to answer from memory. The question must test understanding, not just recall of visible text.
   Topics to cover: ${topicNames || 'general content'}.
   ${prevQList ? `Already asked (do not repeat):\n${prevQList}` : ''}

2. Identify any text regions in the image that directly reveal the answer to your question — such as filled-in answers, answer keys, result labels, or solution text. Do NOT mark axis labels, titles, legends, or structural labels that are needed to understand the diagram.

Return ONLY a JSON object in this exact format, no markdown:
{
  "question": "your question here",
  "redact_regions": [
    {"x": leftPercent, "y": topPercent, "w": widthPercent, "h": heightPercent}
  ]
}

x, y, w, h are percentages (0–100) of image dimensions. Return an empty array for redact_regions if nothing needs to be hidden.`;

    const body = {
      model: VISION_MODEL,
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: imageDataUrl } },
          { type: 'text', text: prompt },
        ],
      }],
      max_tokens: 512,
      temperature: 0.4,
    };

    const nvidiaRes = await fetch(NVIDIA_BASE, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!nvidiaRes.ok) {
      const err = await nvidiaRes.text();
      return new Response(JSON.stringify({ error: `NVIDIA error ${nvidiaRes.status}: ${err}` }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const data = await nvidiaRes.json();
    const raw = data.choices?.[0]?.message?.content ?? '';

    // Strip markdown fences if present
    const cleaned = raw.replace(/^```(?:json)?\s*/im, '').replace(/\s*```\s*$/im, '').trim();

    let parsed: { question?: string; redact_regions?: any[] };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // Fallback: extract question via regex if JSON parse fails
      const qMatch = cleaned.match(/"question"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      parsed = { question: qMatch ? qMatch[1] : cleaned.slice(0, 300), redact_regions: [] };
    }

    if (!parsed.question) {
      return new Response(JSON.stringify({ error: 'No question in NVIDIA response' }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(
      JSON.stringify({ question: parsed.question, redact_regions: parsed.redact_regions ?? [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
