
import React, { useState, useRef, useEffect } from 'react';
import { CheckSession, TopicStatus, PersonalityProfile, DiagramQuestion } from '../types';

interface Props {
  session: CheckSession;
  elapsedSeconds: number;
  isAiThinking: boolean;
  onSendMessage: (text: string) => void;
  personality?: PersonalityProfile;
  personalityActive?: boolean;
}

const DOT_COLOR: Record<TopicStatus, string> = {
  strong: '#3B6D11',
  weak: '#BA7517',
  revisit: '#BA7517',
  untested: 'var(--color-border-secondary)'
};

const STATUS_ICON: Record<TopicStatus, string> = {
  strong: '✓',
  weak: '⚠',
  revisit: '⚠',
  untested: ''
};

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export function SessionView({ session, elapsedSeconds, isAiThinking, onSendMessage, personality, personalityActive }: Props) {
  const [input, setInput] = useState('');
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [revealedImages, setRevealedImages] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!lightboxSrc) return;
    const close = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightboxSrc(null); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [lightboxSrc]);

  const totalSeconds = session.duration * 60;
  const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);
  const isOvertime = session.isOvertimeActive;

  const coveredCount = Object.keys(session.topicPerformances).length;
  const totalCount = session.topics.length;

  const currentTopicId = [...session.messages].reverse().find(m => m.role === 'ai' && m.topicId)?.topicId;
  const currentTopic = session.topics.find(t => t.id === currentTopicId);

  const pct = totalSeconds > 0 ? elapsedSeconds / totalSeconds : 0;
  const mode = isOvertime ? 'examiner' : pct < 0.25 ? 'friend' : pct < 0.5 ? 'tutor' : pct < 0.75 ? 'instructor' : 'examiner';
  const MODE_LABEL: Record<string, string> = {
    friend: personalityActive && personality ? personality.name : 'Friend',
    tutor: 'Tutor', instructor: 'Instructor', examiner: 'Examiner'
  };
  const MODE_COLOR: Record<string, string> = { friend: '#3B6D11', tutor: '#0C447C', instructor: '#6B3F9E', examiner: '#BA7517' };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session.messages, isAiThinking]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || isAiThinking) return;
    setInput('');
    onSendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const words = wordCount(input);

  return (
    <div style={{ display: 'flex', height: '100%', fontFamily: 'var(--font-sans)' }}>

      {/* Sidebar */}
      <div style={{
        width: 170,
        borderRight: '0.5px solid var(--color-border-tertiary)',
        padding: '16px 12px',
        overflowY: 'auto',
        flexShrink: 0
      }}>
        <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
          Topics
        </div>
        {session.topics.map(topic => {
          const perf = session.topicPerformances[topic.id];
          const status: TopicStatus = perf ? perf.status as TopicStatus : 'untested';
          const isActive = topic.id === currentTopicId;
          return (
            <div key={topic.id} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 8px', borderRadius: 6, marginBottom: 3,
              background: isActive ? 'var(--color-background-secondary)' : 'transparent'
            }}>
              <div style={{
                width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                background: isActive ? 'var(--color-text-primary)' : DOT_COLOR[status]
              }} />
              <div style={{
                fontSize: 12, lineHeight: 1.3, flex: 1,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                fontWeight: isActive ? 500 : 400
              }}>
                {topic.name}
              </div>
              {!isActive && STATUS_ICON[status] && (
                <span style={{ fontSize: 11, flexShrink: 0 }}>{STATUS_ICON[status]}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Chat */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Chat bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px',
          borderBottom: '0.5px solid var(--color-border-tertiary)',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {currentTopic && (
              <span style={{
                fontSize: 11, padding: '3px 9px', borderRadius: 4,
                background: 'var(--color-background-secondary)',
                border: '0.5px solid var(--color-border-tertiary)',
                color: 'var(--color-text-secondary)'
              }}>
                {currentTopic.name}
              </span>
            )}
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--color-text-tertiary)' }}>
              <span style={{ width: 70, height: 3, background: 'var(--color-border-tertiary)', borderRadius: 2, overflow: 'hidden', display: 'inline-block' }}>
                <span style={{ display: 'block', height: '100%', background: 'var(--color-text-primary)', width: `${totalCount > 0 ? (coveredCount / totalCount) * 100 : 0}%`, borderRadius: 2 }} />
              </span>
              {coveredCount} of {totalCount}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
              padding: '3px 8px', borderRadius: 4,
              color: MODE_COLOR[mode],
              background: MODE_COLOR[mode] + '22',
              border: `0.5px solid ${MODE_COLOR[mode]}55`
            }}>
              {MODE_LABEL[mode]}
            </span>
          <div style={{
            fontSize: 12, fontWeight: 500, fontFamily: 'var(--font-mono)',
            color: isOvertime ? 'var(--color-text-danger)' : 'var(--color-text-secondary)',
            background: 'var(--color-background-secondary)',
            border: isOvertime ? '0.5px solid var(--color-border-danger)' : '0.5px solid var(--color-border-tertiary)',
            padding: '4px 10px', borderRadius: 6
          }}>
            {isOvertime ? 'OVERTIME' : formatTime(remainingSeconds)}
          </div>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {session.messages.map(msg => {
            const isUser = msg.role === 'user';
            const showPersonality = !isUser && personalityActive && personality;
            const aiName = showPersonality ? personality!.name : 'Cross Check';
            const isDiagram = msg.tag === 'diagram';
            const diagramQ = isDiagram && msg.imageId
              ? session.diagramQuestions.find(q => q.id === msg.imageId)
              : undefined;

            return (
              <div key={msg.id} style={{ display: 'flex', gap: 10, flexDirection: isUser ? 'row-reverse' : 'row' }}>
                {/* Avatar */}
                {showPersonality ? (
                  <div style={{ width: 27, height: 27, borderRadius: '50%', flexShrink: 0, border: '0.5px solid var(--color-border-tertiary)', background: 'var(--color-background-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                    {personality!.name.slice(0, 2).toUpperCase()}
                  </div>
                ) : (
                  <div style={{
                    width: 27, height: 27, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 500, flexShrink: 0,
                    border: isUser ? 'none' : '0.5px solid var(--color-border-tertiary)',
                    background: isUser ? 'var(--color-text-primary)' : 'var(--color-background-secondary)',
                    color: isUser ? 'var(--color-background-primary)' : 'var(--color-text-primary)'
                  }}>
                    {isUser ? 'U' : 'CC'}
                  </div>
                )}
                <div style={{ maxWidth: '76%' }}>
                  <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', fontWeight: 500, letterSpacing: '0.04em', marginBottom: 4, textAlign: isUser ? 'right' : 'left' }}>
                    {isUser ? 'You' : aiName}
                  </div>
                  {!isUser && msg.tag && (
                    <div style={{
                      display: 'inline-block', fontSize: 10, fontWeight: 500,
                      padding: '2px 7px', borderRadius: 4, marginBottom: 5,
                      ...(msg.tag === 'diagram'
                        ? { background: '#F0EBF8', color: '#6B3F9E' }
                        : msg.tag === 'question'
                          ? { background: '#E6F1FB', color: '#0C447C' }
                          : { background: '#FAEEDA', color: '#633806' })
                    }}>
                      {msg.tag === 'diagram' ? 'Diagram' : msg.tag === 'question' ? 'Question' : 'Follow-up'}
                    </div>
                  )}
                  {/* Diagram image card */}
                  {diagramQ?.imageDataUrl && (() => {
                    const revealed = revealedImages.has(diagramQ.id);
                    return (
                      <div style={{ marginBottom: 8, borderRadius: 8, overflow: 'hidden', border: '0.5px solid var(--color-border-secondary)', maxWidth: 300, position: 'relative' }}>
                        <div
                          onClick={() => revealed ? setLightboxSrc(diagramQ.imageDataUrl!) : undefined}
                          style={{ position: 'relative', cursor: revealed ? 'zoom-in' : 'default' }}
                        >
                          <img
                            src={diagramQ.imageDataUrl}
                            alt={`Page ${diagramQ.pageNumber}`}
                            style={{ width: '100%', display: 'block', filter: revealed ? 'none' : 'blur(10px)', transition: 'filter 0.3s ease' }}
                          />
                          {!revealed && (
                            <div style={{
                              position: 'absolute', inset: 0,
                              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                              background: 'rgba(0,0,0,0.25)', gap: 8
                            }}>
                              <div style={{ fontSize: 11, color: '#fff', fontWeight: 500, textShadow: '0 1px 4px rgba(0,0,0,0.6)', textAlign: 'center', padding: '0 12px' }}>
                                Answer first, then reveal
                              </div>
                              <button
                                onClick={() => setRevealedImages(prev => new Set([...prev, diagramQ.id]))}
                                style={{
                                  padding: '5px 14px', borderRadius: 6, fontSize: 11, fontWeight: 500,
                                  background: 'rgba(255,255,255,0.9)', color: '#111',
                                  border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)'
                                }}
                              >
                                Reveal image
                              </button>
                            </div>
                          )}
                        </div>
                        <div style={{ padding: '5px 10px', background: 'var(--color-background-secondary)', fontSize: 10, color: 'var(--color-text-tertiary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>Page {diagramQ.pageNumber}</span>
                          {revealed && <span style={{ opacity: 0.5 }}>click to enlarge</span>}
                        </div>
                      </div>
                    );
                  })()}
                  <div style={{
                    fontSize: 13, lineHeight: 1.6,
                    color: 'var(--color-text-primary)',
                    background: isUser ? 'var(--color-background-primary)' : 'var(--color-background-secondary)',
                    border: '0.5px solid var(--color-border-tertiary)',
                    borderRadius: 10, padding: '10px 13px'
                  }}>
                    {msg.content}
                  </div>
                </div>
              </div>
            );
          })}

          {isAiThinking && (
            <div style={{ display: 'flex', gap: 10 }}>
              {personalityActive && personality ? (
                <div style={{ width: 27, height: 27, borderRadius: '50%', flexShrink: 0, border: '0.5px solid var(--color-border-tertiary)', background: 'var(--color-background-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  {personality.name.slice(0, 2).toUpperCase()}
                </div>
              ) : (
                <div style={{
                  width: 27, height: 27, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 500, flexShrink: 0,
                  border: '0.5px solid var(--color-border-tertiary)',
                  background: 'var(--color-background-secondary)',
                  color: 'var(--color-text-primary)'
                }}>CC</div>
              )}
              <div>
                <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', fontWeight: 500, letterSpacing: '0.04em', marginBottom: 4 }}>
                  {personalityActive && personality ? personality.name : 'Cross Check'}
                </div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '10px 13px',
                  background: 'var(--color-background-secondary)',
                  border: '0.5px solid var(--color-border-tertiary)',
                  borderRadius: 10, width: 'fit-content'
                }}>
                  {[0, 0.2, 0.4].map((delay, i) => (
                    <span key={i} style={{
                      width: 5, height: 5, background: 'var(--color-text-tertiary)',
                      borderRadius: '50%', display: 'inline-block',
                      animation: `cc-bounce 1.2s ${delay}s infinite`
                    }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div style={{
          borderTop: '0.5px solid var(--color-border-tertiary)',
          padding: '12px 16px', flexShrink: 0
        }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isAiThinking}
            placeholder="Type your answer — explain your reasoning, not just the fact…"
            style={{
              width: '100%', resize: 'none', fontSize: 13,
              fontFamily: 'var(--font-sans)', lineHeight: 1.6,
              padding: '10px 13px',
              border: '0.5px solid var(--color-border-secondary)',
              borderRadius: 10,
              background: 'var(--color-background-primary)',
              color: 'var(--color-text-primary)',
              height: 68, outline: 'none',
              opacity: isAiThinking ? 0.5 : 1,
              boxSizing: 'border-box',
            }}
            onFocus={e => (e.target.style.borderColor = 'var(--color-border-primary)')}
            onBlur={e => (e.target.style.borderColor = 'var(--color-border-secondary)')}
          />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 9, gap: 8 }}>
            {/* I don't know — amber, prominent */}
            <button
              onClick={() => { setInput(''); onSendMessage("I don't know"); }}
              disabled={isAiThinking}
              style={{
                padding: '0 16px', height: 38, borderRadius: 8,
                background: isAiThinking ? 'transparent' : 'rgba(186,117,23,0.1)',
                color: '#BA7517',
                fontSize: 12, fontWeight: 600,
                cursor: isAiThinking ? 'not-allowed' : 'pointer',
                opacity: isAiThinking ? 0.35 : 1,
                border: '1px solid rgba(186,117,23,0.4)',
                fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { if (!isAiThinking) (e.currentTarget.style.background = 'rgba(186,117,23,0.18)'); }}
              onMouseLeave={e => { if (!isAiThinking) (e.currentTarget.style.background = 'rgba(186,117,23,0.1)'); }}
            >
              I don't know
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                {words} word{words !== 1 ? 's' : ''}
              </span>
              {/* Send — solid primary */}
              <button
                onClick={handleSend}
                disabled={!input.trim() || isAiThinking}
                style={{
                  padding: '0 22px', height: 38, borderRadius: 8,
                  background: input.trim() && !isAiThinking ? 'var(--color-text-primary)' : 'var(--color-border-secondary)',
                  color: 'var(--color-background-primary)',
                  fontSize: 13, fontWeight: 600,
                  cursor: input.trim() && !isAiThinking ? 'pointer' : 'not-allowed',
                  border: 'none', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap',
                  transition: 'background 0.15s',
                  letterSpacing: '0.01em',
                }}
              >
                Send →
              </button>
            </div>
          </div>
        </div>
      </div>

      {lightboxSrc && (
        <div
          onClick={() => setLightboxSrc(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 500,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'zoom-out'
          }}
        >
          <img
            src={lightboxSrc}
            alt="Diagram enlarged"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '90vw', maxHeight: '90vh',
              borderRadius: 8,
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
              cursor: 'default'
            }}
          />
          <button
            onClick={() => setLightboxSrc(null)}
            style={{
              position: 'absolute', top: 20, right: 24,
              background: 'rgba(255,255,255,0.15)', border: 'none',
              color: '#fff', fontSize: 22, width: 36, height: 36,
              borderRadius: '50%', cursor: 'pointer', lineHeight: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            ×
          </button>
        </div>
      )}

      <style>{`
        @keyframes cc-bounce {
          0%,60%,100% { transform: translateY(0); }
          30% { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  );
}
