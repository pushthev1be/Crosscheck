import React, { useState } from 'react';
import { QuizSession, SavedUpload } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import {
    CheckCircle2,
    XCircle,
    ChevronDown,
    ChevronUp
} from 'lucide-react';

interface SessionListProps {
    sessions: QuizSession[];
    savedUploads: SavedUpload[];
    onReattempt?: (session: QuizSession) => void;
    onOpenUpload?: (upload: SavedUpload) => void;
}

export const SessionList: React.FC<SessionListProps> = ({
    sessions,
    savedUploads,
    onReattempt,
    onOpenUpload
}) => {
    const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);

    const getUploadForSession = (session: QuizSession) => {
        if (!session.uploadId) return undefined;
        return savedUploads.find(upload => upload.id === session.uploadId);
    };

    const handleDownloadUpload = (upload: SavedUpload | undefined, session: QuizSession) => {
        if (!upload || !upload.sources || upload.sources.length === 0) return;

        // 1. Download each original source file
        upload.sources.forEach((source, index) => {
            if (source.sourceDataUrl) {
                const link = document.createElement('a');
                link.href = source.sourceDataUrl;
                link.download = source.fileName || `${session.topic}_Source_${index + 1}`;
                // Stagger downloads slightly to avoid browser blocking
                setTimeout(() => link.click(), index * 500);
            }
        });

        // 2. Download the AI-generated Study Guide (Summary)
        const baseName = upload.fileName ? upload.fileName.replace(/\.[^/.]+$/, '').replace(/ \(\+\d+ more\)/, '') : session.topic;
        const fileName = `${baseName}_StudyGuide.txt`;

        const downloadContent = `TITLE: ${upload.title}\n` +
            `DATE: ${new Date(upload.createdAt).toLocaleString()}\n\n` +
            `--- AI-GENERATED STUDY GUIDE ---\n\n` +
            `${upload.material.summary}`;

        const blob = new Blob([downloadContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        setTimeout(() => link.click(), upload.sources.length * 500);
        setTimeout(() => URL.revokeObjectURL(url), (upload.sources.length + 2) * 1000);
    };

    if (sessions.length === 0) {
        return (
            <div className="text-center p-8 text-theme-tertiary text-sm">
                No past sessions found. Complete a quiz to see it here!
            </div>
        );
    }

    return (
        <motion.div layout className="divide-y divide-theme-primary">
            {sessions.map((session) => {
                const upload = getUploadForSession(session);
                const isExpanded = expandedSessionId === session.id;
                const sessionQuestions = (Array.isArray(session.questions) && session.questions.length > 0)
                    ? session.questions
                    : (upload?.material?.quiz || []);
                const hasQuestions = sessionQuestions.length > 0;
                const hasReview = hasQuestions && Array.isArray(session.questionStates) && session.questionStates.length > 0;

                return (
                    <motion.div
                        layout
                        key={session.id}
                        className="px-5 py-4 hover:bg-theme-hover/50 transition-colors"
                    >
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div>
                                <p className="font-semibold text-theme-secondary text-sm md:text-base">{session.topic}</p>
                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                    <span className="text-xs text-theme-tertiary">{new Date(session.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                    {upload && (
                                        <>
                                            <span className="text-xs text-theme-tertiary">•</span>
                                            <span className="text-xs text-theme-tertiary">File: {upload.fileName}</span>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 justify-between md:justify-end">
                                <div className="text-right mr-2">
                                    <span className={`text-lg font-bold ${session.score === session.total ? 'text-emerald-600' : session.score / session.total >= 0.7 ? 'text-theme-accent' : 'text-amber-600'}`}>
                                        {Math.round((session.score / session.total) * 100)}%
                                    </span>
                                    <p className="text-xs text-theme-tertiary">{session.score}/{session.total} correct</p>
                                </div>
                                {upload && onOpenUpload && (
                                    <button
                                        onClick={() => onOpenUpload(upload)}
                                        className="px-3 py-1.5 bg-theme-tertiary text-theme-secondary rounded-lg text-xs font-bold hover:bg-theme-secondary transition-all"
                                    >
                                        Open Upload
                                    </button>
                                )}
                                {upload && upload.sources && upload.sources.length > 0 && (
                                    <button
                                        onClick={() => handleDownloadUpload(upload, session)}
                                        className="px-3 py-1.5 bg-theme-accent-bg text-theme-accent rounded-lg text-xs font-bold hover:bg-theme-accent-secondary transition-all"
                                    >
                                        Download
                                    </button>
                                )}
                                {onReattempt && hasQuestions && (
                                    <button
                                        onClick={() => onReattempt(session)}
                                        className="px-3 py-1.5 bg-theme-accent text-white rounded-lg text-xs font-bold hover:bg-theme-accent-secondary transition-all"
                                    >
                                        Reattempt
                                    </button>
                                )}
                                <button
                                    onClick={() => setExpandedSessionId(isExpanded ? null : session.id)}
                                    className="px-3 py-1.5 bg-theme-card border border-theme-secondary text-theme-secondary rounded-lg text-xs font-bold hover:bg-theme-hover transition-all flex items-center gap-1"
                                >
                                    {isExpanded ? 'Hide' : 'Review'}
                                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </button>
                            </div>
                        </div>

                        <AnimatePresence>
                            {isExpanded && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="mt-4 space-y-4 overflow-hidden"
                                >
                                    {!hasQuestions && (
                                        <div className="p-4 bg-theme-hover rounded-xl text-xs text-theme-muted text-center italic border border-theme-primary">
                                            This session doesn’t have stored questions to review. Reattempt to regenerate a reviewable quiz.
                                        </div>
                                    )}
                                    {hasQuestions && !hasReview && (
                                        <div className="p-4 bg-theme-hover rounded-xl text-xs text-theme-muted text-center italic border border-theme-primary">
                                            Answer history isn’t available for this session. You can reattempt to generate a new review.
                                        </div>
                                    )}
                                    {hasReview && sessionQuestions.map((q, qIdx) => {
                                        const state = session.questionStates[qIdx];
                                        const selectedOption = state?.selectedOption ?? null;
                                        const isCorrect = state?.isCorrect ?? null;

                                        return (
                                            <motion.div
                                                layout
                                                key={qIdx}
                                                className="bg-theme-hover border border-theme-primary rounded-2xl p-4"
                                            >
                                                <div className="flex items-start justify-between gap-3 mb-3">
                                                    <div>
                                                        <p className="text-sm font-bold text-theme-primary"><span className="text-theme-accent mr-2">Q{qIdx + 1}</span> {q.question}</p>
                                                        {!state?.isAnswered && (
                                                            <span className="inline-block mt-2 text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">Unanswered</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-1 gap-2">
                                                    {(!q.type || q.type === 'multiple-choice') && q.options && q.options.map((option, oIdx) => {
                                                        const isSelected = selectedOption === oIdx;
                                                        const isOptionCorrect = oIdx === q.correctAnswer;

                                                        let style = "border-theme-secondary bg-theme-card";
                                                        if (isOptionCorrect) style = "border-emerald-400 bg-emerald-50";
                                                        if (isSelected && !isOptionCorrect) style = "border-rose-400 bg-rose-50";
                                                        if (!isSelected && !isOptionCorrect && selectedOption !== null) style = "border-theme-primary bg-theme-card opacity-70";

                                                        return (
                                                            <div key={oIdx} className={`p-3 rounded-xl border text-xs ${style}`}>
                                                                <div className="flex items-center gap-2">
                                                                    <span className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] font-bold shrink-0 ${isOptionCorrect ? 'border-emerald-500 text-emerald-600' : isSelected ? 'border-rose-500 text-rose-600' : 'border-theme-secondary text-theme-tertiary'}`}>
                                                                        {String.fromCharCode(65 + oIdx)}
                                                                    </span>
                                                                    <span className="text-theme-secondary">{option}</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}

                                                    {q.type === 'labeling' && q.imageLabels && (
                                                        <div className="flex flex-wrap gap-2 mt-2">
                                                            {q.imageLabels.map((l, idx) => (
                                                                <span key={l.id || idx} className="px-3 py-1 bg-theme-accent-bg text-theme-accent rounded-full text-[10px] font-black border border-theme-accent uppercase tracking-tighter">
                                                                    {l.label}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {q.type === 'matching' && q.matchingPairs && (
                                                        <div className="space-y-2 mt-2">
                                                            {q.matchingPairs.map((p, idx) => (
                                                                <div key={p.id || idx} className="flex items-center justify-between p-3 bg-theme-card border border-theme-primary rounded-xl text-[10px]">
                                                                    <span className="font-bold text-theme-secondary">{p.left}</span>
                                                                    <span className="text-theme-accent font-medium">→</span>
                                                                    <span className="text-theme-secondary">{p.right}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="mt-3 pt-3 border-t border-theme-secondary text-xs text-theme-muted flex items-start gap-2">
                                                    <div className={`mt-0.5 shrink-0 ${isCorrect ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                        {isCorrect ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                                                    </div>
                                                    <span className="text-theme-secondary leading-relaxed"><span className="font-bold">Explanation:</span> {q.explanation}</span>
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                );
            })}
        </motion.div>
    );
};
