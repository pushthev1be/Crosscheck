
import React, { useRef } from 'react';
import { KnowledgeReport } from '../types';
import { PersistedSession } from '../services/sessionService';

interface Props {
  incompleteSessions: PersistedSession[];
  completedSessions: PersistedSession[];
  onFileUpload: (file: File | File[]) => void;
  onViewReport: (report: KnowledgeReport) => void;
  onStartNewSession: () => void;
  onResumeSession: (session: PersistedSession) => void;
}

const SESSION_EMOJIS = ['📘', '📗', '📙', '📕', '📓', '📔'];

function scoreLabel(topics: PersistedSession['topics'], performances: PersistedSession['topicPerformances']): { text: string; cls: string } {
  const strong = Object.values(performances).filter(p => p.status === 'strong').length;
  const weak = Object.values(performances).filter(p => p.status === 'weak' || p.status === 'revisit').length;
  const untested = topics.length - Object.keys(performances).length;
  if (weak === 0 && untested === 0) return { text: `${strong} strong`, cls: 'strong' };
  if (strong === 0) return { text: `${weak} weak`, cls: 'weak' };
  return { text: `${strong} strong · ${weak} weak`, cls: 'mixed' };
}

function reportScoreLabel(report: KnowledgeReport): { text: string; cls: string } {
  const strong = report.topics.filter(t => t.status === 'strong').length;
  const weak = report.topics.filter(t => t.status === 'weak' || t.status === 'revisit').length;
  if (weak === 0) return { text: `${strong} strong`, cls: 'strong' };
  if (strong === 0) return { text: `${weak} weak`, cls: 'weak' };
  return { text: `${strong} strong · ${weak} weak`, cls: 'mixed' };
}

function pillStyle(cls: string): React.CSSProperties {
  if (cls === 'strong') return { background: '#EAF3DE', color: '#3B6D11' };
  if (cls === 'weak') return { background: '#FAEEDA', color: '#633806' };
  return { background: '#E6F1FB', color: '#0C447C' };
}

function formatDate(iso: string | number): string {
  const d = new Date(typeof iso === 'number' ? iso : iso);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return `${diff} days ago`;
}

function formatProgress(session: PersistedSession): string {
  const covered = Object.keys(session.topicPerformances).length;
  const total = session.topics.length;
  const elapsed = Math.round(session.elapsedSeconds / 60);
  return `${covered}/${total} topics · ${elapsed} min in`;
}

export function HomeView({ incompleteSessions, completedSessions, onFileUpload, onViewReport, onStartNewSession, onResumeSession }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalSessions = completedSessions.length;
  const avgStrong = totalSessions === 0 ? 0 : Math.round(
    completedSessions.reduce((acc, s) => {
      const perfs = Object.values(s.topicPerformances);
      const pct = perfs.length > 0
        ? (perfs.filter(p => p.status === 'strong').length / s.topics.length) * 100
        : 0;
      return acc + pct;
    }, 0) / totalSessions
  );
  const totalWeak = completedSessions.reduce((acc, s) =>
    acc + Object.values(s.topicPerformances).filter(p => p.status === 'weak' || p.status === 'revisit').length, 0
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) onFileUpload(file);
  };

  return (
    <div style={{ padding: 24, fontFamily: 'var(--font-sans)' }}>
      {/* Hero */}
      <div style={{ border: '0.5px solid var(--color-border-tertiary)', borderRadius: 'var(--border-radius-lg)', padding: '28px 28px 24px', marginBottom: 20, background: 'var(--color-background-secondary)' }}>
        <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.08em', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', marginBottom: 10 }}>
          Knowledge Audit Tool
        </div>
        <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--color-text-primary)', letterSpacing: '-0.02em', lineHeight: 1.3, marginBottom: 8 }}>
          You studied. Now prove it.
        </div>
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6, maxWidth: 420, marginBottom: 20 }}>
          Upload the same notes you just studied. Cross Check runs you through a conversational audit and tells you exactly what stuck and what didn't.
        </div>

        {/* Upload zone */}
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
          style={{ border: '0.5px dashed var(--color-border-primary)', borderRadius: 'var(--border-radius-lg)', padding: 28, textAlign: 'center', cursor: 'pointer', marginBottom: 16, transition: 'background 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-background-primary)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <div style={{ width: 36, height: 36, border: '0.5px solid var(--color-border-tertiary)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px', background: 'var(--color-background-primary)' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 11V5M5 8l3-3 3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              <path d="M3 13h10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </div>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 4 }}>Upload your notes to begin</div>
          <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>PDF, images (multi-select), or text file</div>
        </div>
        <input ref={fileInputRef} type="file" accept=".pdf,.txt,.md,image/*" multiple style={{ display: 'none' }} onChange={e => {
          if (!e.target.files?.length) return;
          const files = Array.from(e.target.files);
          onFileUpload(files.length === 1 ? files[0] : files as any);
        }} />

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
          {[
            { label: 'Sessions completed', val: totalSessions, sub: 'all time' },
            { label: 'Avg. strong topics', val: totalSessions > 0 ? `${avgStrong}%` : '—', sub: 'across all sessions' },
            { label: 'Weak areas flagged', val: totalWeak, sub: 'need revisit' }
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 'var(--border-radius-md)', padding: '14px 16px' }}>
              <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}>{s.val}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 3 }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* In-progress sessions */}
      {incompleteSessions.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 10, letterSpacing: '0.02em' }}>
            In progress
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {incompleteSessions.map((s, i) => {
              const pill = scoreLabel(s.topics, s.topicPerformances);
              return (
                <div
                  key={s.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', border: '0.5px solid var(--color-border-secondary)', borderRadius: 'var(--border-radius-md)', background: 'var(--color-background-primary)' }}
                >
                  <div style={{ width: 32, height: 32, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0, background: 'var(--color-background-secondary)' }}>
                    {SESSION_EMOJIS[i % SESSION_EMOJIS.length]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>{s.uploadTitle}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                      {formatDate(s.startTime)} · {formatProgress(s)}
                    </div>
                  </div>
                  <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 4, ...pillStyle(pill.cls) }}>
                    {pill.text}
                  </span>
                  <button
                    onClick={() => onResumeSession(s)}
                    style={{ padding: '6px 14px', fontSize: 11, fontWeight: 500, border: '0.5px solid var(--color-border-primary)', borderRadius: 6, background: 'var(--color-text-primary)', color: 'var(--color-background-primary)', cursor: 'pointer', fontFamily: 'var(--font-sans)', flexShrink: 0 }}
                  >
                    Resume
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Completed sessions */}
      {completedSessions.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 12, letterSpacing: '0.02em' }}>
            Recent sessions
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {completedSessions.slice(0, 5).map((s, i) => {
              const report = s.report;
              if (!report) return null;
              const pill = reportScoreLabel(report);
              return (
                <div
                  key={s.id}
                  onClick={() => onViewReport(report)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 'var(--border-radius-md)', background: 'var(--color-background-primary)', cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-background-secondary)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-background-primary)')}
                >
                  <div style={{ width: 32, height: 32, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0, background: 'var(--color-background-secondary)' }}>
                    {SESSION_EMOJIS[i % SESSION_EMOJIS.length]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>{s.uploadTitle}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                      {formatDate(report.date)} · {report.actualDurationMinutes} min · {report.topics.length} topics
                    </div>
                  </div>
                  <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 4, ...pillStyle(pill.cls) }}>
                    {pill.text}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* About */}
      <div style={{ marginTop: 32, paddingTop: 20, borderTop: '0.5px solid var(--color-border-tertiary)' }}>
        <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>About</div>
        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.75, maxWidth: 500 }}>
          CrossCheck was built by{' '}
          <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>push</span>
          {' '}— a developer focused on building AI-native tools that actually change how people work and learn.
          CrossCheck started as a personal tool to stop passive rereading and start actually testing knowledge.
        </div>
        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
          <a
            href="https://oracleai.live"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 12, fontWeight: 500,
              color: 'var(--color-text-primary)',
              background: 'var(--color-background-secondary)',
              border: '0.5px solid var(--color-border-secondary)',
              borderRadius: 7, padding: '6px 13px',
              textDecoration: 'none',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--color-border-primary)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--color-border-secondary)')}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
              <path d="M8 2C8 2 6 5 6 8s2 6 2 6" stroke="currentColor" strokeWidth="1.2" />
              <path d="M8 2C8 2 10 5 10 8s-2 6-2 6" stroke="currentColor" strokeWidth="1.2" />
              <path d="M2 8h12" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            oracleai.live
          </a>
          <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>Another project by push</span>
        </div>
      </div>
    </div>
  );
}
