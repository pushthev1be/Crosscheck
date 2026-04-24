
import { ExtractedTopic } from '../types';

const EDGE_FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nvidia-vision`;

export async function generateDiagramQuestion(
  imageDataUrl: string,
  topics: ExtractedTopic[],
  previousQuestions: string[]
): Promise<string> {
  const apiKey = import.meta.env.VITE_NVIDIA_API_KEY;
  if (!apiKey) throw new Error('NVIDIA API key not configured (VITE_NVIDIA_API_KEY)');

  const response = await fetch(EDGE_FN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-nvidia-key': apiKey,
    },
    body: JSON.stringify({ imageDataUrl, topics, previousQuestions }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(err.error || `Edge function error ${response.status}`);
  }

  const data = await response.json();
  if (!data.question) throw new Error('No question returned from edge function');
  return data.question as string;
}
