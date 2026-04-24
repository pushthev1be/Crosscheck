
import { supabase } from './supabaseClient';
import { CheckSession } from '../types';

export interface PersistedSession extends CheckSession {
  elapsedSeconds: number;
}

function toRow(session: CheckSession, userId: string, elapsedSeconds: number) {
  return {
    id: session.id,
    user_id: userId,
    upload_title: session.uploadTitle,
    note_content: session.noteContent,
    topics: session.topics,
    messages: session.messages,
    duration: session.duration,
    start_time: session.startTime,
    end_time: session.endTime ?? null,
    is_overtime_active: session.isOvertimeActive,
    topic_performances: session.topicPerformances,
    status: session.status,
    report: session.report ?? null,
    // strip imageDataUrl — base64 images are not persisted
    diagram_questions: session.diagramQuestions.map(({ imageDataUrl: _omit, ...q }) => q),
    diagram_questions_enabled: session.diagramQuestionsEnabled,
    elapsed_seconds: elapsedSeconds,
    updated_at: new Date().toISOString(),
  };
}

function fromRow(row: any): PersistedSession {
  return {
    id: row.id,
    uploadTitle: row.upload_title,
    noteContent: row.note_content,
    topics: row.topics ?? [],
    messages: row.messages ?? [],
    duration: row.duration,
    startTime: row.start_time,
    endTime: row.end_time ?? undefined,
    isOvertimeActive: row.is_overtime_active ?? false,
    topicPerformances: row.topic_performances ?? {},
    status: row.status,
    report: row.report ?? undefined,
    extractedImages: [],      // never persisted
    diagramQuestions: row.diagram_questions ?? [],
    diagramQuestionsEnabled: row.diagram_questions_enabled ?? false,
    elapsedSeconds: row.elapsed_seconds ?? 0,
  };
}

export async function upsertSession(
  session: CheckSession,
  userId: string,
  elapsedSeconds: number,
): Promise<void> {
  const { error } = await supabase
    .from('sessions')
    .upsert(toRow(session, userId, elapsedSeconds));
  if (error) console.error('[sessionService] upsert error:', error.message);
}

export async function getUserSessions(userId: string): Promise<PersistedSession[]> {
  const result = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  const { data, error } = result;
  if (error || !data) return [];
  return (data as any[]).map(fromRow);
}
