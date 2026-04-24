
export interface User {
  id?: string;
  username: string;
  email: string;
  joinedAt: string;
}

export type SessionDuration = 15 | 30 | 45 | 60;
export type TopicStatus = 'strong' | 'weak' | 'revisit' | 'untested';

export interface ExtractedTopic {
  id: string;
  name: string;
  concepts: string[];
  noteSection?: string;
}

export interface ExtractedImage {
  id: string;
  pageNumber: number;
  dataUrl: string;       // in-memory only — never persisted to DB
  maskedDataUrl?: string; // text labels painted over — shown to student in chat
}

export interface DiagramQuestion {
  id: string;
  pageNumber: number;
  question: string;
  used: boolean;
  imageDataUrl?: string; // in-memory only — stripped before DB save
}

export interface QAMessage {
  id: string;
  role: 'ai' | 'user';
  content: string;
  topicId?: string;
  tag?: 'question' | 'followup' | 'diagram';
  imageId?: string; // links to a DiagramQuestion
  timestamp: number;
}

export interface TopicPerformance {
  topicId: string;
  topicName: string;
  status: TopicStatus;
  evidence: string;
  noteSection?: string;
  concepts: string[];
}

export interface RevisitItem {
  concept: string;
  topicName: string;
  noteSection?: string;
}

export interface KnowledgeReport {
  sessionId: string;
  date: string;
  uploadTitle: string;
  durationMinutes: number;
  actualDurationMinutes: number;
  topics: TopicPerformance[];
  revisitList: RevisitItem[];
  overtimeUsed: boolean;
}

export interface CheckSession {
  id: string;
  uploadTitle: string;
  noteContent: string;
  topics: ExtractedTopic[];
  messages: QAMessage[];
  duration: SessionDuration;
  startTime: number;
  endTime?: number;
  isOvertimeActive: boolean;
  topicPerformances: Record<string, TopicPerformance>;
  report?: KnowledgeReport;
  status: 'setup' | 'active' | 'overtime' | 'complete';
  extractedImages: ExtractedImage[];     // in-memory only
  diagramQuestions: DiagramQuestion[];   // persisted without imageDataUrl
  diagramQuestionsEnabled: boolean;
}

export interface SessionTurnResponse {
  message: string;
  isFollowUp: boolean;
  currentTopicId: string;
  topicUpdate?: {
    topicId: string;
    status: 'strong' | 'weak' | 'revisit';
    evidence: string;
  };
  sessionShouldEnd: boolean;
  overtimeNeeded: boolean;
}

export interface PersonalityStyle {
  rawDescription: string;
  phrases: string[];
  emojiUsage: 'none' | 'rare' | 'moderate' | 'frequent';
  humor: string;
  encouragement: string;
  corrections: string;
}

export interface PersonalityProfile {
  id: string;
  name: string;
  pfpDataUrl: string;
  pin: string;
  authorizedEmail: string;
  style: PersonalityStyle;
  createdAt: string;
}

export enum AppState {
  AUTH = 'AUTH',
  IDLE = 'IDLE',
  UPLOADING = 'UPLOADING',
  PROCESSING = 'PROCESSING',
  SESSION_SETUP = 'SESSION_SETUP',
  SESSION_ACTIVE = 'SESSION_ACTIVE',
  REPORT = 'REPORT',
  ERROR = 'ERROR'
}

export type ThemeColor = 'light' | 'dark' | 'pink' | 'ocean' | 'emerald';

export interface ThemeConfig {
  id: ThemeColor;
  name: string;
  icon: string;
  preview: {
    primary: string;
    secondary: string;
    accent: string;
  };
}
