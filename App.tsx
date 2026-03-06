
import React, { useState, useEffect } from 'react';
import { Upload, FileText, BrainCircuit, Layout, Loader2, AlertCircle, Sparkles, Trophy, Target, X, LogOut, Flame, Moon, BookOpen, Star, Award, Zap, Heart, Stethoscope, History, Home } from 'lucide-react';
import { AppState, StudyMaterial, ViewMode, Achievement, StudyGoal, UserStats, User, ProcessingState, StudyDomain, QuizSession, SavedUpload } from './types';
import { processStudyContent, extendQuiz, generateQuestionForFailure, generateAdditionalFlashcards } from './services/geminiService';
import { supabase } from './services/supabaseClient';
import { SummaryView } from './components/SummaryView';
import { FlashcardView } from './components/FlashcardView';
import { QuizView } from './components/QuizView';
import { AchievementsView } from './components/AchievementsView';
import { SessionList } from './components/SessionList';
import { AuthView } from './components/AuthView';
import { ThemeProvider } from './components/ThemeContext';
import { ThemeSwitcher } from './components/ThemeSwitcher';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.mjs?url';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

const INITIAL_ACHIEVEMENTS: Achievement[] = [
  { id: 'first_upload', title: 'Quick Starter', description: 'Upload your first study document.', icon: 'Zap', unlocked: false, requirement: 1, currentValue: 0 },
  { id: 'quiz_master', title: 'Quiz Master', description: 'Complete 5 practice quizzes.', icon: 'Star', unlocked: false, requirement: 5, currentValue: 0 },
  { id: 'perfectionist', title: 'Perfectionist', description: 'Get 100% on any practice quiz.', icon: 'Award', unlocked: false, requirement: 1, currentValue: 0 },
  { id: 'reviewer', title: 'Diligent Student', description: 'Review 50 flashcards across your notes.', icon: 'BookOpen', unlocked: false, requirement: 50, currentValue: 0 },
  { id: 'power_user', title: 'Study Genius', description: 'Generate 10 different study materials.', icon: 'Cpu', unlocked: false, requirement: 10, currentValue: 0 },
  { id: 'night_owl', title: 'Night Owl', description: 'Study after midnight.', icon: 'Moon', unlocked: false, requirement: 1, currentValue: 0 },
  { id: 'on_fire', title: 'On Fire', description: 'Maintain a 3-day study streak.', icon: 'Flame', unlocked: false, requirement: 3, currentValue: 0 },
  { id: 'goal_getter', title: 'Goal Getter', description: 'Complete 10 daily goals.', icon: 'Target', unlocked: false, requirement: 10, currentValue: 0 },
];

const INITIAL_GOALS: StudyGoal[] = [
  { id: 'daily_quizzes', label: 'Complete 3 Quizzes', target: 3, current: 0 },
  { id: 'daily_cards', label: 'Review 20 Flashcards', target: 20, current: 0 },
];

const INITIAL_STATS: UserStats = {
  totalUploads: 0,
  totalQuizzesCompleted: 0,
  totalFlashcardsViewed: 0,
  perfectQuizzes: 0,
  streakDays: 0,
  currentPerfectStreak: 0,
  lastActive: new Date().toISOString()
};

// SM-2 Spaced Repetition Algorithm
const calculateNextReview = (quality: number, interval: number = 0, easeFactor: number = 2.5) => {
  let newInterval = interval;
  let newEaseFactor = easeFactor;

  if (quality >= 3) {
    // Correct - increase interval
    if (interval === 0) newInterval = 1;
    else if (interval === 1) newInterval = 3;
    else newInterval = Math.round(interval * easeFactor);
  } else {
    // Incorrect - reset interval
    newInterval = 1;
  }

  // Adjust ease factor
  newEaseFactor = Math.max(1.3, easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));

  return {
    interval: newInterval,
    easeFactor: newEaseFactor,
    nextReview: Date.now() + newInterval * 24 * 60 * 60 * 1000
  };
};

const LOADING_STEPS = [
  "Extracting text from document...",
  "Identifying clinical indicators...",
  "Synthesizing PANCE-style vignettes...",
  "Drafting diagnostic-choice questions...",
  "Refining medical explanations...",
  "Ready for Board Review!"
];

const MAX_CHAR_COUNT = 100000; // ~25,000 tokens, plenty for study notes
const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [state, setState] = useState<AppState>(AppState.AUTH);
  const [material, setMaterial] = useState<StudyMaterial | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('summary');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isExtending, setIsExtending] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [processedChars, setProcessedChars] = useState(0);
  const [processingState, setProcessingState] = useState<ProcessingState | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<StudyDomain>('PA');

  const [stats, setStats] = useState<UserStats>(INITIAL_STATS);
  const [achievements, setAchievements] = useState<Achievement[]>(INITIAL_ACHIEVEMENTS);
  const [goals, setGoals] = useState<StudyGoal[]>(INITIAL_GOALS);
  const [showNotification, setShowNotification] = useState<string | null>(null);
  const [quizSessions, setQuizSessions] = useState<QuizSession[]>([]);
  const [savedUploads, setSavedUploads] = useState<SavedUpload[]>([]);
  const [activeUploadId, setActiveUploadId] = useState<string | null>(null);
  const [quizResetKey, setQuizResetKey] = useState<string>('');

  useEffect(() => {
    let interval: number;
    if (state === AppState.PROCESSING) {
      interval = window.setInterval(() => {
        setLoadingStep(prev => (prev < LOADING_STEPS.length - 1 ? prev + 1 : prev));
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [state]);

  useEffect(() => {
    const savedUser = localStorage.getItem('sg_user');
    const savedStats = localStorage.getItem('sg_stats');
    const savedAchievements = localStorage.getItem('sg_achievements');
    const savedGoals = localStorage.getItem('sg_goals');

    if (savedUser) {
      setUser(JSON.parse(savedUser));
      setState(AppState.IDLE);
    }
    if (savedStats) setStats(JSON.parse(savedStats));
    if (savedAchievements) setAchievements(JSON.parse(savedAchievements));
    if (savedGoals) {
      const g = JSON.parse(savedGoals);
      const lastActive = savedStats ? JSON.parse(savedStats).lastActive : null;
      if (lastActive && new Date(lastActive).toDateString() !== new Date().toDateString()) {
        setGoals(INITIAL_GOALS);
      } else {
        setGoals(g);
      }
    }
    const savedSessions = localStorage.getItem('sg_quiz_sessions');
    if (savedSessions) setQuizSessions(JSON.parse(savedSessions));
    const savedUploads = localStorage.getItem('sg_uploads');
    if (savedUploads) setSavedUploads(JSON.parse(savedUploads));
  }, []);

  useEffect(() => {
    if (user) localStorage.setItem('sg_user', JSON.stringify(user));
    localStorage.setItem('sg_stats', JSON.stringify({ ...stats, lastActive: new Date().toISOString() }));
    localStorage.setItem('sg_achievements', JSON.stringify(achievements));
    localStorage.setItem('sg_goals', JSON.stringify(goals));
    localStorage.setItem('sg_quiz_sessions', JSON.stringify(quizSessions));
    localStorage.setItem('sg_uploads', JSON.stringify(savedUploads));
  }, [user, stats, achievements, goals, quizSessions, savedUploads]);

  const extractTextFromPDF = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = "";

    // Process up to 50 pages for speed/safety
    const pageLimit = Math.min(pdf.numPages, 50);
    for (let i = 1; i <= pageLimit; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const strings = content.items.map((item: any) => item.str);
      fullText += strings.join(" ") + "\n";
      if (fullText.length > MAX_CHAR_COUNT) break;
    }

    return fullText;
  };

  const triggerAchievement = (id: string) => {
    setAchievements(prev => prev.map(a => {
      if (a.id === id && !a.unlocked) {
        setShowNotification(`New Achievement: ${a.title}!`);
        setTimeout(() => setShowNotification(null), 5000);
        return { ...a, unlocked: true };
      }
      return a;
    }));
  };

  const updateProgress = (type: 'upload' | 'quiz' | 'flashcard', payload?: any) => {
    setStats(prev => {
      const newStats = { ...prev };
      const now = new Date();
      const last = new Date(prev.lastActive);
      if (now.toDateString() !== last.toDateString()) {
        const diffTime = Math.abs(now.getTime() - last.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays === 1) newStats.streakDays += 1;
        else if (diffDays > 1) newStats.streakDays = 1;
      }

      if (newStats.streakDays >= 3) triggerAchievement('on_fire');
      const hours = now.getHours();
      if (hours >= 0 && hours < 5) triggerAchievement('night_owl');

      if (type === 'upload') {
        newStats.totalUploads += 1;
        if (newStats.totalUploads >= 1) triggerAchievement('first_upload');
        if (newStats.totalUploads >= 10) triggerAchievement('power_user');
      }
      if (type === 'quiz') {
        newStats.totalQuizzesCompleted += 1;
        if (payload?.perfect) newStats.perfectQuizzes += 1;
        if (newStats.totalQuizzesCompleted >= 5) triggerAchievement('quiz_master');
        if (payload?.perfect) triggerAchievement('perfectionist');
      }
      if (type === 'flashcard') {
        newStats.totalFlashcardsViewed += 1;
        if (newStats.totalFlashcardsViewed >= 50) triggerAchievement('reviewer');
      }
      return newStats;
    });

    setGoals(prev => prev.map(g => {
      let nextG = { ...g };
      if (type === 'quiz' && g.id === 'daily_quizzes') nextG.current += 1;
      if (type === 'flashcard' && g.id === 'daily_cards') nextG.current += 1;
      return nextG;
    }));
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      setErrorMessage("File is too large. Please upload a document smaller than 15MB.");
      setState(AppState.ERROR);
      return;
    }

    setState(AppState.PROCESSING);
    setErrorMessage('');
    setLoadingStep(0);

    try {
      const isImage = file.type.startsWith('image/');
      const isPDF = file.type === 'application/pdf';

      const isMarkdown = file.name.endsWith('.md') || file.type === 'text/markdown';

      let content = '';
      let sourceText: string | undefined;
      let sourceDataUrl: string | undefined;
      let sourceType: 'text' | 'pdf' | 'image' = 'text';

      if (isImage) {
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        sourceDataUrl = dataUrl;
        content = dataUrl.split(',')[1];
        sourceType = 'image';
      } else if (isPDF) {
        content = await extractTextFromPDF(file);
        sourceText = content;
        sourceType = 'pdf';

      } else if (isMarkdown) {
        content = await file.text();
        sourceText = content;
        sourceType = 'text';
      } else {
        content = await file.text();
        sourceText = content;
        sourceType = 'text';
      }

      if (!content || content.trim().length < 20) {
        throw new Error("Could not extract enough text from the document. Please ensure it contains readable text.");
      }

      // Track content coverage: split when it exceeds limit
      let unprocessedContent = '';
      if (content.length > MAX_CHAR_COUNT) {
        unprocessedContent = content.substring(MAX_CHAR_COUNT);
        content = content.substring(0, MAX_CHAR_COUNT);
      }

      setProcessedChars(content.length);

      // Store processing state for later use
      setProcessingState({
        totalContent: content + unprocessedContent,
        processedContent: content,
        unprocessedContent,
        fileName: file.name
      });

      const result = await processStudyContent(content, isImage, selectedDomain);
      const coveragePercent = unprocessedContent
        ? Math.round((content.length / (content.length + unprocessedContent.length)) * 100)
        : 100;

      const nextMaterial: StudyMaterial = {
        ...result,
        unprocessedContent,
        contentCoveragePercent: coveragePercent
      };

      const uploadId = Date.now().toString();
      setActiveUploadId(uploadId);
      setMaterial(nextMaterial);
      setQuizResetKey(Date.now().toString());
      setSavedUploads(prev => {
        const filtered = prev.filter(upload => !(upload.fileName === file.name && upload.title === (result.title || file.name)));
        const newUpload: SavedUpload = {
          id: uploadId,
          fileName: file.name,
          title: result.title || file.name,
          domain: selectedDomain,
          createdAt: new Date().toISOString(),
          material: nextMaterial,
          sourceType,
          sourceText,
          sourceDataUrl,
          sourceMimeType: file.type || undefined
        };
        return [newUpload, ...filtered].slice(0, 20);
      });
      setState(AppState.VIEWING);
      updateProgress('upload');
    } catch (error: any) {
      console.error(error);
      setErrorMessage(error.message || "Failed to process the document. Try a different format.");
      setState(AppState.ERROR);
    }
  };

  const handleKeepGoing = async () => {
    if (!material || isExtending) return;

    // If there's unprocessed content, generate from that
    if (material.unprocessedContent) {
      setIsExtending(true);
      try {
        const newMaterial = await processStudyContent(material.unprocessedContent, false);
        setMaterial({
          ...material,
          summary: material.summary + '\n\n[Continued from remaining content]\n' + newMaterial.summary,
          flashcards: [...material.flashcards, ...newMaterial.flashcards],
          quiz: [...material.quiz, ...newMaterial.quiz],
          unprocessedContent: '', // Marked as fully processed
          contentCoveragePercent: 100
        });
        setShowNotification('Generated content from remaining material!');
        setTimeout(() => setShowNotification(null), 5000);
      } catch (err) {
        console.error(err);
        setErrorMessage("Failed to generate more content. Try again.");
      } finally {
        setIsExtending(false);
      }
    } else {
      // Fallback: generate more questions from existing material
      setIsExtending(true);
      try {
        const newQuestions = await extendQuiz(material.title, material.quiz.length);
        if (newQuestions.length > 0) {
          setMaterial({
            ...material,
            quiz: [...material.quiz, ...newQuestions]
          });
          setShowNotification('Generated more practice questions!');
          setTimeout(() => setShowNotification(null), 5000);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsExtending(false);
      }
    }
  };

  const handleQuestionFailed = async () => {
    if (!material || isExtending) return;

    setIsExtending(true);
    try {
      const newQuestions = await generateQuestionForFailure(material.title);
      if (newQuestions.length > 0) {
        setMaterial({
          ...material,
          quiz: [...material.quiz, ...newQuestions]
        });
        setShowNotification('💡 Generated 2 more questions to reinforce this concept!');
        setTimeout(() => setShowNotification(null), 4000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsExtending(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Supabase signOut error:', err);
    }
    
    localStorage.removeItem('sg_user');
    localStorage.removeItem('sg_stats');
    localStorage.removeItem('sg_achievements');
    localStorage.removeItem('sg_goals');
    localStorage.removeItem('sg_quiz_sessions');
    localStorage.removeItem('sg_uploads');
    setUser(null);
    setState(AppState.IDLE);
    setMaterial(null);
    setStats(INITIAL_STATS);
    setAchievements(INITIAL_ACHIEVEMENTS);
    setGoals(INITIAL_GOALS);
    setQuizSessions([]);
    setSavedUploads([]);
    setState(AppState.AUTH);
  };

  const handleOpenUpload = (upload: SavedUpload) => {
    setMaterial(upload.material);
    setSelectedDomain(upload.domain);
    setViewMode('summary');
    setState(AppState.VIEWING);
    setActiveUploadId(upload.id);
    setQuizResetKey(Date.now().toString());
  };

  /* Shared session loading logic */
  const handleReattemptSession = (session: QuizSession) => {
    const upload = session.uploadId ? savedUploads.find(u => u.id === session.uploadId) : undefined;

    // If no questions in session AND no upload, we can't do anything
    if ((!session.questions || session.questions.length === 0) && !upload) {
      setErrorMessage("Cannot reload this session: missing question data.");
      setState(AppState.ERROR);
      return;
    }

    if (upload) {
      handleOpenUpload(upload);
      // Wait for state update then switch to quiz? 
      // handleOpenUpload sets viewMode='summary'. We want 'quiz'.
      // Since we can't chain easily without effect, we might need a distinct flow.
      // But actually, if we just want to re-take the quiz from the upload:
      setTimeout(() => setViewMode('quiz'), 0);
    } else {
      // Standalone session (or missing upload but has questions)
      if (session.questions && session.questions.length > 0) {
        setMaterial({
          title: session.topic,
          summary: 'Viewing past session',
          flashcards: [],
          quiz: session.questions,
          unprocessedContent: '',
          contentCoveragePercent: 100
        });
        setState(AppState.VIEWING);
        setViewMode('quiz');
      }
    }

    setActiveUploadId(session.uploadId || null);
    setQuizResetKey(Date.now().toString());
  };


  if (state === AppState.AUTH) {
    return <AuthView onAuth={(u) => { setUser(u); setState(AppState.IDLE); }} />;
  }

  const renderContent = () => {
    if (viewMode === 'stats') return <AchievementsView achievements={achievements} goals={goals} stats={stats} />;
    if (!material) return null;

    switch (viewMode) {
      case 'summary': return <SummaryView summary={material.summary} title={material.title} contentCoveragePercent={material.contentCoveragePercent} hasUnprocessedContent={!!material.unprocessedContent} />;
      case 'flashcards': return <FlashcardView
        cards={material.flashcards}
        topic={material.title}
        onCardViewed={() => updateProgress('flashcard')}
        onCardRated={(cardIndex, quality) => {
          const updated = { ...calculateNextReview(quality, material.flashcards[cardIndex].interval, material.flashcards[cardIndex].easeFactor) };
          setMaterial({
            ...material,
            flashcards: material.flashcards.map((card, idx) =>
              idx === cardIndex
                ? { ...card, ...updated }
                : card
            )
          });
        }}
        onLoadMore={(newCards) => {
          setMaterial({
            ...material,
            flashcards: [...material.flashcards, ...newCards]
          });
        }}
      />;
      case 'quiz': return <QuizView
        questions={Array.isArray(material.quiz) ? material.quiz : []}
        onQuizComplete={(score, total, questions, questionStates) => {
          updateProgress('quiz', { perfect: score === total });
          const sessionId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : Date.now().toString();
          const session: QuizSession = {
            id: sessionId,
            topic: material.title,
            score,
            total,
            date: new Date().toISOString(),
            questions: [...questions],
            questionStates,
            uploadId: activeUploadId || undefined
          };
          setQuizSessions(prev => [session, ...prev].slice(0, 50));
        }}
        onKeepGoing={handleKeepGoing}
        onQuestionFailed={handleQuestionFailed}
        isExtending={isExtending}
        pastSessions={quizSessions}
        savedUploads={savedUploads}
        onOpenUpload={handleOpenUpload}
        onReattemptSession={(session) => {
          const upload = session.uploadId ? savedUploads.find(u => u.id === session.uploadId) : undefined;
          if ((!session.questions || session.questions.length === 0) && !upload) return;
          if (upload) {
            handleOpenUpload(upload);
          } else if (material) {
            setMaterial({
              ...material,
              title: session.topic,
              quiz: session.questions
            });
            setState(AppState.VIEWING);
          }
          setViewMode('quiz');
          setActiveUploadId(session.uploadId || null);
          setQuizResetKey(Date.now().toString());
        }}
        key={quizResetKey}
      />;
      default: return null;
    }
  };

  return (
    <ThemeProvider>
    <div className="min-h-screen bg-theme-primary text-theme-primary flex flex-col">
      {showNotification && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] bg-theme-card text-theme-primary px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-slide-down border border-theme-primary">
          <div className="bg-amber-500 p-2 rounded-lg"><Trophy size={20} className="text-white" /></div>
          <span className="font-bold">{showNotification}</span>
          <button onClick={() => setShowNotification(null)} className="ml-2 hover:text-slate-400"><X size={16} /></button>
        </div>
      )}

      <header className="bg-theme-secondary border-b border-theme-primary sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => { setState(AppState.IDLE); setViewMode('summary'); }}>
            <div className="bg-indigo-600 p-2.5 rounded-2xl shadow-lg shadow-indigo-100"><BrainCircuit className="text-white" size={28} /></div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-theme-primary">StudyGenius<span className="text-theme-accent">AI</span></h1>
              <p className="text-[10px] text-theme-muted font-bold uppercase tracking-widest">Hi, {user?.username || 'Learner'}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-tighter">
              <Zap size={14} fill="currentColor" /> Flash Engine Active
            </div>
            {state !== AppState.IDLE && (
              <button
                onClick={() => setState(AppState.IDLE)}
                className="p-2.5 rounded-2xl bg-theme-secondary text-theme-muted border border-theme-primary hover:bg-theme-hover hover:text-theme-accent transition-all shadow-sm"
                title="Back to Dashboard"
              >
                <Home size={20} />
              </button>
            )}
            {state === AppState.VIEWING && (
              <div className="hidden md:flex bg-theme-hover p-1.5 rounded-2xl gap-1">
                {[
                  { id: 'summary', label: 'Summary', icon: FileText },
                  { id: 'flashcards', label: 'Flashcards', icon: Layout },
                  { id: 'quiz', label: 'Quiz', icon: Sparkles },
                  { id: 'stats', label: 'Progress', icon: Trophy }
                ].map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => setViewMode(mode.id as ViewMode)}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${viewMode === mode.id ? 'bg-theme-secondary text-theme-accent shadow-sm ring-1 ring-theme-primary' : 'text-theme-muted hover:text-theme-primary hover:bg-theme-secondary/50'
                      }`}
                  >
                    <mode.icon size={18} /> {mode.label}
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => { if (state !== AppState.VIEWING) setState(AppState.VIEWING); setViewMode('stats'); }} className={`p-2.5 rounded-2xl transition-all ${viewMode === 'stats' ? 'bg-theme-accent/20 text-theme-accent' : 'bg-theme-hover text-theme-muted hover:bg-theme-secondary'}`} title="View Progress & Goals"><Trophy size={24} /></button>
            <ThemeSwitcher />
            <button onClick={handleLogout} className="p-2.5 rounded-2xl bg-theme-hover text-theme-muted hover:bg-rose-50 hover:text-rose-500 transition-all" title="Log Out"><LogOut size={24} /></button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-24">
        {state === AppState.IDLE && (
          <div className="max-w-3xl mx-auto text-center animate-fade-in">
            <div className="mb-12">
              <h2 className="text-5xl font-extrabold text-theme-primary mb-6 leading-tight">Crush your rotations, <span className="text-transparent bg-clip-text bg-gradient-to-r from-theme-accent to-violet-600">{user?.username}</span></h2>
              <p className="text-xl text-theme-muted max-w-xl mx-auto leading-relaxed">Upload study materials and generate smart study content tailored to your field.</p>
            </div>

            {/* Domain Selector */}
            <div className="mb-8 bg-theme-card rounded-2xl border border-theme-primary p-6 shadow-sm">
              <label className="block text-sm font-bold text-theme-secondary mb-4">What are you studying for?</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {(['PA', 'Nursing', 'Medical', 'GenEd'] as const).map((domain) => (
                  <button
                    key={domain}
                    onClick={() => setSelectedDomain(domain)}
                    className={`py-3 px-4 rounded-xl font-bold transition-all ${selectedDomain === domain
                      ? 'bg-theme-accent text-white shadow-lg'
                      : 'bg-theme-hover text-theme-secondary hover:bg-theme-secondary/20'
                      }`}
                  >
                    {domain === 'PA' && 'PA (PANCE)'}
                    {domain === 'Nursing' && 'Nursing (NCLEX)'}
                    {domain === 'Medical' && 'Medical (USMLE)'}
                    {domain === 'GenEd' && 'General'}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative group">
              <label className="flex flex-col items-center justify-center w-full h-80 border-2 border-dashed border-theme-primary rounded-[3rem] bg-theme-card hover:bg-theme-hover hover:border-theme-accent transition-all cursor-pointer shadow-sm">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <div className="bg-theme-hover p-6 rounded-full mb-6 group-hover:scale-110 group-hover:bg-theme-accent/20 transition-all duration-300"><Upload className="text-theme-muted group-hover:text-theme-accent" size={48} /></div>
                  <p className="mb-2 text-2xl font-bold text-theme-primary">Drop your notes here</p>
                  <p className="text-theme-muted">PDF, Text, or Markdown (Max 15MB)</p>
                </div>
                <input type="file" className="hidden" onChange={handleFileUpload} accept=".txt,.pdf,.md" />
              </label>
            </div>

            {savedUploads.length > 0 && (
              <div className="mt-10 bg-theme-card rounded-2xl border border-theme-primary p-6 text-left shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <History size={18} className="text-theme-accent" />
                  <h3 className="text-sm font-bold text-theme-secondary uppercase tracking-widest">Previous Uploads</h3>
                  <span className="text-[10px] font-bold text-theme-muted bg-theme-hover px-2 py-0.5 rounded-full">{savedUploads.length}</span>
                </div>
                <div className="divide-y divide-theme-primary">
                  {savedUploads.slice(0, 6).map((upload) => (
                    <div key={upload.id} className="py-3 flex items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold text-theme-primary text-sm">{upload.title}</p>
                        <p className="text-xs text-theme-muted">
                          {upload.fileName} • {upload.domain} • {new Date(upload.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                      <button
                        onClick={() => handleOpenUpload(upload)}
                        className="px-4 py-2 bg-theme-accent text-white rounded-xl text-xs font-bold hover:brightness-110 transition-all"
                      >
                        Open
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {quizSessions.length > 0 && (
              <div className="mt-10 bg-theme-card rounded-2xl border border-theme-primary overflow-hidden shadow-sm text-left">
                <div className="p-6 border-b border-theme-primary flex items-center gap-2">
                  <History size={18} className="text-theme-accent" />
                  <h3 className="text-sm font-bold text-theme-secondary uppercase tracking-widest">Past Quiz Sessions</h3>
                  <span className="text-[10px] font-bold text-theme-muted bg-theme-hover px-2 py-0.5 rounded-full">{quizSessions.length}</span>
                </div>
                <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                  <SessionList
                    sessions={quizSessions}
                    savedUploads={savedUploads}
                    onReattempt={handleReattemptSession}
                    onOpenUpload={handleOpenUpload}
                  />
                </div>
              </div>
            )}
            <div className="mt-16 flex items-center justify-center gap-12">
              <div className="flex flex-col items-center"><div className="text-4xl font-extrabold text-theme-accent mb-1">{stats.streakDays}</div><div className="text-theme-muted font-bold uppercase tracking-widest text-xs">Day Streak</div></div>
              <div className="w-px h-12 bg-theme-primary"></div>
              <div className="flex flex-col items-center"><div className="text-4xl font-extrabold text-violet-600 mb-1">{stats.totalUploads}</div><div className="text-theme-muted font-bold uppercase tracking-widest text-xs">Documents</div></div>
              <div className="w-px h-12 bg-theme-primary"></div>
              <div className="flex flex-col items-center"><div className="text-4xl font-extrabold text-emerald-600 mb-1">{stats.totalQuizzesCompleted}</div><div className="text-theme-muted font-bold uppercase tracking-widest text-xs">Practice Sets</div></div>
            </div>
          </div>
        )}

        {state === AppState.PROCESSING && (
          <div className="flex flex-col items-center justify-center min-h-[50vh]">
            <div className="bg-theme-card p-12 rounded-[3rem] shadow-xl shadow-theme-accent/10 flex flex-col items-center border border-theme-primary max-w-md w-full">
              <div className="relative mb-8">
                <div className="absolute inset-0 bg-theme-accent/10 rounded-full animate-ping scale-150"></div>
                <div className="relative bg-theme-card p-4 rounded-full border-2 border-theme-accent">
                  <Stethoscope className="text-theme-accent" size={48} />
                </div>
                <Sparkles className="absolute -top-1 -right-1 text-amber-400 animate-bounce" size={24} />
              </div>
              <h2 className="text-2xl font-bold text-theme-primary mb-4 text-center">Optimizing Content</h2>
              <div className="w-full space-y-4">
                <div className="h-2 bg-theme-hover rounded-full overflow-hidden">
                  <div
                    className="h-full bg-theme-accent transition-all duration-[3000ms] ease-linear"
                    style={{ width: `${((loadingStep + 1) / LOADING_STEPS.length) * 100}%` }}
                  />
                </div>
                <p className="text-theme-accent text-sm font-bold text-center tracking-wide uppercase transition-all animate-pulse">
                  {LOADING_STEPS[loadingStep]}
                </p>
                <div className="flex justify-between items-center px-4 pt-2">
                  <span className="text-[10px] font-bold text-theme-muted uppercase tracking-widest">Volume Parsed</span>
                  <span className="text-[10px] font-bold text-theme-accent">{processedChars > 0 ? `${(processedChars / 1024).toFixed(1)} KB` : 'Initializing...'}</span>
                </div>
                <p className="text-theme-muted text-center text-xs px-8 leading-relaxed">
                  Parsing high-volume clinical data. Large files are safely truncated to ensure maximum AI stability.
                </p>
              </div>
            </div>
          </div>
        )}

        {state === AppState.ERROR && (
          <div className="max-w-xl mx-auto bg-rose-50 border border-rose-100 p-10 rounded-[2rem] text-center">
            <div className="bg-rose-100 text-rose-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"><AlertCircle size={32} /></div>
            <h2 className="text-2xl font-bold text-rose-800 mb-4">Upload Error</h2>
            <p className="text-rose-600 mb-8">{errorMessage}</p>
            <button onClick={() => setState(AppState.IDLE)} className="px-10 py-4 bg-rose-600 text-white rounded-2xl font-bold hover:bg-rose-700 transition-colors">Return to Home</button>
          </div>
        )}

        {state === AppState.VIEWING && <div className="animate-fade-in"><div className="mb-8">{renderContent()}</div></div>}
      </main>

      <footer className="bg-transparent py-8 mt-auto border-t border-theme-primary/50">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="flex flex-col items-center gap-2">
            <p className="text-theme-muted text-xs font-medium flex items-center gap-1.5">
              Support this project with a <Heart size={12} className="text-theme-accent fill-theme-accent" />
            </p>
            <div className="bg-theme-card/50 border border-theme-primary px-4 py-1.5 rounded-full flex items-center gap-3">
              <span className="text-[10px] font-bold text-theme-accent uppercase tracking-widest">Zelle</span>
              <span className="text-theme-primary font-bold text-sm">3175310381</span>
            </div>
            <p className="text-[10px] text-theme-muted uppercase tracking-widest mt-2">StudyGenius AI © 2024</p>
          </div>
        </div>
      </footer>
    </div>
    </ThemeProvider>
  );
};

export default App;
