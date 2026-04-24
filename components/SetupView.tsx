
import React, { useRef, useState, useEffect } from 'react';
import { AppState, ExtractedTopic, SessionDuration, ExtractedImage, DiagramQuestion } from '../types';

interface Props {
  appState: AppState;
  uploadedFile: File | null;
  noteTitle: string;
  extractedTopics: ExtractedTopic[];
  selectedDuration: SessionDuration;
  onDurationChange: (d: SessionDuration) => void;
  onFileUpload: (file: File | File[]) => void;
  onBeginSession: () => void;
  extractedImages: ExtractedImage[];
  diagramQuestions: DiagramQuestion[];
  isGeneratingDiagramQs: boolean;
  onGenerateDiagramQuestions: (selectedIds: string[]) => void;
}

const DURATIONS: { value: SessionDuration; label: string; desc: string }[] = [
  { value: 15, label: '15', desc: 'Surface audit' },
  { value: 30, label: '30', desc: 'Standard' },
  { value: 45, label: '45', desc: 'Deep dive' },
  { value: 60, label: '60', desc: 'Full audit' },
];

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      border: '0.5px solid var(--color-border-tertiary)',
      borderRadius: 'var(--border-radius-lg)',
      padding: 20,
      marginBottom: 16
    }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 14 }}>{title}</div>
      {children}
    </div>
  );
}

type DiagramStep = 'collapsed' | 'select' | 'generating' | 'done';

export function SetupView({
  appState, uploadedFile, noteTitle, extractedTopics, selectedDuration,
  onDurationChange, onFileUpload, onBeginSession,
  extractedImages, diagramQuestions, isGeneratingDiagramQs,
  onGenerateDiagramQuestions,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isLoading = appState === AppState.UPLOADING || appState === AppState.PROCESSING;
  const isReady = appState === AppState.SESSION_SETUP;

  const [diagramStep, setDiagramStep] = useState<DiagramStep>('collapsed');
  const [selectedPageIds, setSelectedPageIds] = useState<string[]>([]);

  // Auto-complete when generation finishes
  useEffect(() => {
    if (!isGeneratingDiagramQs && diagramStep === 'generating') {
      setDiagramStep('done');
    }
  }, [isGeneratingDiagramQs, diagramStep]);

  // Reset when a new file is uploaded
  useEffect(() => {
    setDiagramStep('collapsed');
    setSelectedPageIds([]);
  }, [extractedImages]);

  if (isLoading) {
    return (
      <div style={{ padding: 24, fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 12 }}>
        <div style={{ width: 32, height: 32, border: '2px solid var(--color-border-tertiary)', borderTopColor: 'var(--color-text-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>
          {appState === AppState.UPLOADING ? 'Reading file…' : 'Extracting topics from your notes…'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>This takes a few seconds</div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div style={{ padding: 24, fontFamily: 'var(--font-sans)' }}>
        <Card title="Upload notes">
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onFileUpload(f); }}
            style={{ border: '0.5px dashed var(--color-border-primary)', borderRadius: 'var(--border-radius-md)', padding: 32, textAlign: 'center', cursor: 'pointer', transition: 'background 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-background-secondary)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 4 }}>Drop your notes here or click to browse</div>
            <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>PDF, images (multi-select), or text file</div>
          </div>
          <input ref={fileInputRef} type="file" accept=".pdf,.txt,.md,image/*" multiple style={{ display: 'none' }} onChange={e => {
            if (!e.target.files?.length) return;
            const files = Array.from(e.target.files);
            onFileUpload(files.length === 1 ? files[0] : files as any);
          }} />
        </Card>
      </div>
    );
  }

  const togglePage = (id: string) => {
    setSelectedPageIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleGenerate = () => {
    if (!selectedPageIds.length) return;
    setDiagramStep('generating');
    onGenerateDiagramQuestions(selectedPageIds);
  };

  return (
    <div style={{ padding: 24, fontFamily: 'var(--font-sans)' }}>

      {/* File card */}
      <Card title="Uploaded notes">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'var(--color-background-secondary)', borderRadius: 'var(--border-radius-md)', border: '0.5px solid var(--color-border-tertiary)' }}>
          <div style={{ width: 32, height: 32, background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>
            {uploadedFile?.type?.startsWith('image/') ? '🖼️' : '📄'}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>{uploadedFile?.name || noteTitle}</div>
            <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 2 }}>{extractedTopics.length} topics detected</div>
          </div>
          <button onClick={() => fileInputRef.current?.click()} style={{ padding: '5px 10px', fontSize: 11, fontWeight: 500, border: '0.5px solid var(--color-border-secondary)', borderRadius: 6, background: 'var(--color-background-primary)', color: 'var(--color-text-primary)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
            Replace
          </button>
          <input ref={fileInputRef} type="file" accept=".pdf,.txt,.md,image/*" multiple style={{ display: 'none' }} onChange={e => {
            if (!e.target.files?.length) return;
            const files = Array.from(e.target.files);
            onFileUpload(files.length === 1 ? files[0] : files as any);
          }} />
        </div>
      </Card>

      {/* Topics card */}
      <Card title="Topics detected">
        <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginBottom: 10 }}>
          {extractedTopics.length} topics extracted from your notes
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {extractedTopics.map(t => (
            <span key={t.id} style={{ fontSize: 12, padding: '5px 11px', borderRadius: 20, border: '0.5px solid var(--color-border-tertiary)', color: 'var(--color-text-secondary)', background: 'var(--color-background-primary)' }}>
              {t.name}
            </span>
          ))}
        </div>
      </Card>

      {/* Diagram questions card — only shown for PDFs */}
      {extractedImages.length > 0 && (
        <div style={{ border: '0.5px solid var(--color-border-tertiary)', borderRadius: 'var(--border-radius-lg)', padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: diagramStep === 'collapsed' ? 0 : 14 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>
              Diagram questions
              {diagramStep === 'done' && diagramQuestions.length > 0 && (
                <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 400, color: '#3B6D11', background: '#EAF3DE', padding: '2px 8px', borderRadius: 4 }}>
                  {diagramQuestions.length} ready
                </span>
              )}
            </div>
            {diagramStep === 'collapsed' && (
              <button
                onClick={() => setDiagramStep('select')}
                style={{ fontSize: 11, padding: '5px 10px', borderRadius: 6, border: '0.5px solid var(--color-border-secondary)', background: 'var(--color-background-primary)', color: 'var(--color-text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
              >
                Add diagram questions ({extractedImages.length} pages)
              </button>
            )}
            {diagramStep !== 'collapsed' && (
              <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{extractedImages.length} pages</span>
            )}
          </div>

          {/* Select pages */}
          {diagramStep === 'select' && (
            <>
              <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 12 }}>
                Select pages that contain diagrams, charts, or figures you want to be quizzed on.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8, marginBottom: 14, maxHeight: 340, overflowY: 'auto' }}>
                {extractedImages.map(img => {
                  const selected = selectedPageIds.includes(img.id);
                  return (
                    <div
                      key={img.id}
                      onClick={() => togglePage(img.id)}
                      style={{
                        border: selected ? '1.5px solid var(--color-border-primary)' : '0.5px solid var(--color-border-tertiary)',
                        borderRadius: 8, overflow: 'hidden', cursor: 'pointer',
                        background: selected ? 'var(--color-background-secondary)' : 'var(--color-background-primary)',
                        transition: 'all 0.1s', position: 'relative'
                      }}
                    >
                      <img src={img.dataUrl} alt={`Page ${img.pageNumber}`} style={{ width: '100%', display: 'block', aspectRatio: '3/4', objectFit: 'cover' }} />
                      <div style={{ padding: '5px 7px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>p.{img.pageNumber}</span>
                        <div style={{
                          width: 14, height: 14, borderRadius: 3,
                          border: selected ? 'none' : '0.5px solid var(--color-border-secondary)',
                          background: selected ? 'var(--color-text-primary)' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          {selected && <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4L3.5 6L6.5 2" stroke="var(--color-background-primary)" strokeWidth="1.2" strokeLinecap="round" /></svg>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setDiagramStep('collapsed')} style={{ padding: '6px 12px', fontSize: 11, border: '0.5px solid var(--color-border-secondary)', borderRadius: 6, background: 'transparent', color: 'var(--color-text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  Cancel
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={!selectedPageIds.length}
                  style={{ padding: '6px 14px', fontSize: 11, fontWeight: 500, border: 'none', borderRadius: 6, background: selectedPageIds.length ? 'var(--color-text-primary)' : 'var(--color-border-tertiary)', color: selectedPageIds.length ? 'var(--color-background-primary)' : 'var(--color-text-tertiary)', cursor: selectedPageIds.length ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)' }}
                >
                  Generate questions ({selectedPageIds.length} selected)
                </button>
              </div>
            </>
          )}

          {/* Generating */}
          {diagramStep === 'generating' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0' }}>
              <div style={{ width: 18, height: 18, border: '2px solid var(--color-border-tertiary)', borderTopColor: 'var(--color-text-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Generating diagram questions…</span>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          )}

          {/* Done */}
          {diagramStep === 'done' && (
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
              {diagramQuestions.length > 0
                ? `${diagramQuestions.length} diagram question${diagramQuestions.length !== 1 ? 's' : ''} will be injected throughout your session.`
                : 'No questions generated — session will be text only.'}
              <button onClick={() => setDiagramStep('select')} style={{ marginLeft: 10, fontSize: 11, background: 'none', border: 'none', color: 'var(--color-text-tertiary)', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'var(--font-sans)' }}>Change</button>
            </div>
          )}
        </div>
      )}

      {/* Duration card */}
      <Card title="Session duration">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
          {DURATIONS.map(d => {
            const sel = selectedDuration === d.value;
            return (
              <div
                key={d.value}
                onClick={() => onDurationChange(d.value)}
                style={{ padding: '12px 8px', border: sel ? '0.5px solid var(--color-border-primary)' : '0.5px solid var(--color-border-tertiary)', borderRadius: 'var(--border-radius-md)', textAlign: 'center', cursor: 'pointer', background: sel ? 'var(--color-background-secondary)' : 'transparent', transition: 'all 0.15s' }}
              >
                <span style={{ fontSize: 18, fontWeight: 500, display: 'block', letterSpacing: '-0.02em', color: sel ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>{d.label}</span>
                <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 3 }}>min</div>
                <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 6, lineHeight: 1.4 }}>{d.desc}</div>
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 10 }}>
          Session extends automatically if a weakness is detected near the end
        </div>
      </Card>

      {/* Begin */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={onBeginSession}
          disabled={isGeneratingDiagramQs}
          style={{ padding: '7px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: isGeneratingDiagramQs ? 'not-allowed' : 'pointer', background: 'var(--color-text-primary)', color: 'var(--color-background-primary)', border: '0.5px solid var(--color-text-primary)', fontFamily: 'var(--font-sans)', opacity: isGeneratingDiagramQs ? 0.5 : 1 }}
        >
          {isGeneratingDiagramQs ? 'Generating…' : 'Begin session →'}
        </button>
      </div>
    </div>
  );
}
