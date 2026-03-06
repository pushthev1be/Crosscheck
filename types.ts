
export interface User {
  username: string;
  email: string;
  joinedAt: string;
}

export interface Flashcard {
  question: string;
  answer: string;
  interval?: number; // Days until next review
  easeFactor?: number; // Difficulty multiplier (default 2.5)
  nextReview?: number; // Unix timestamp for next review
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  subtopic?: string;
  type?: 'multiple-choice' | 'labeling' | 'matching';
  imageLabels?: Array<{ id?: string; label: string; position: { x: number; y: number } }>;
  matchingPairs?: Array<{ id?: string; left: string; right: string }>;
}

export interface StudyMaterial {
  title: string;
  summary: string;
  flashcards: Flashcard[];
  quiz: QuizQuestion[];
  unprocessedContent?: string;
  contentCoveragePercent?: number;
}

export interface QuestionStatus {
  id: number;
  isAnswered: boolean;
  isCorrect: boolean | null;
  selectedOption: number | null;
  isFlagged: boolean;
  showExplanation: boolean;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: 'Zap' | 'Star' | 'Award' | 'BookOpen' | 'Cpu' | 'Moon' | 'Flame' | 'Target';
  unlocked: boolean;
  requirement: number;
  currentValue: number;
  rarity?: 'gold' | 'silver' | 'bronze';
}

export interface StudyGoal {
  id: string;
  label: string;
  target: number;
  current: number;
}

export interface UserStats {
  totalUploads: number;
  totalQuizzesCompleted: number;
  totalFlashcardsViewed: number;
  perfectQuizzes: number;
  streakDays: number;
  currentPerfectStreak: number;
  lastActive: string;
}

export enum AppState {
  AUTH = 'AUTH',
  IDLE = 'IDLE',
  UPLOADING = 'UPLOADING',
  PROCESSING = 'PROCESSING',
  VIEWING = 'VIEWING',
  ERROR = 'ERROR'
}

export type StudyDomain = 'PA' | 'Nursing' | 'Medical' | 'GenEd';

export type ViewMode = 'summary' | 'flashcards' | 'quiz' | 'stats';

export interface QuizSession {
  id: string;
  topic: string;
  score: number;
  total: number;
  date: string;
  questions: QuizQuestion[];
  questionStates: QuestionStatus[];
  uploadId?: string;
}

export interface ProcessingState {
  totalContent: string;
  processedContent: string;
  unprocessedContent: string;
  fileName: string;
}

export interface SavedUpload {
  id: string;
  fileName: string;
  title: string;
  domain: StudyDomain;
  createdAt: string;
  material: StudyMaterial;
  sourceType: 'text' | 'pdf' | 'image';
  sourceText?: string;
  sourceDataUrl?: string;
  sourceMimeType?: string;
  sources?: Array<{ fileName?: string; sourceDataUrl?: string; sourceText?: string; sourceMimeType?: string }>;
}

// Theme types
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
