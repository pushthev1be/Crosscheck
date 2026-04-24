
import React, { useState } from 'react';

const STEPS = [
  {
    icon: '⚡',
    title: 'Knowledge audit, not passive review',
    desc: 'CrossCheck questions you on your own notes using AI. Instead of rereading, you prove what you actually know — and find exactly where the gaps are.',
  },
  {
    icon: '📤',
    title: 'Upload your notes',
    desc: 'Drop in a PDF, image, or text file. AI reads it and extracts key topics automatically — no tagging or setup required.',
  },
  {
    icon: '🖼️',
    title: 'Diagram questions',
    desc: 'Got diagrams in your PDF? Select those pages and the NVIDIA vision model generates visual challenge questions. Labels are hidden so you have to recall from knowledge, not read the answer off the page.',
  },
  {
    icon: '🎓',
    title: 'The session escalates',
    desc: "Starts casual — Friend mode, short questions. Then ramps up through Tutor → Instructor → Examiner as time passes. Hit \"I don't know\" anytime for a hint and a gentler follow-up.",
  },
  {
    icon: '📊',
    title: 'See exactly where you stand',
    desc: 'Every session ends with a full breakdown: strong topics, weak spots, and a revisit list with note references. Sessions are saved — pick up any incomplete one from the home screen.',
  },
];

export function WalkthroughOverlay({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const isLast = step === STEPS.length - 1;
  const s = STEPS[step];

  const finish = () => {
    localStorage.setItem('crosscheck-walkthrough-seen', '1');
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 600,
        background: 'rgba(0,0,0,0.72)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-sans)',
        backdropFilter: 'blur(2px)',
      }}
    >
      <div
        style={{
          background: 'var(--color-background-primary)',
          border: '0.5px solid var(--color-border-tertiary)',
          borderRadius: 18,
          padding: '36px 36px 28px',
          maxWidth: 448,
          width: '90vw',
          boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
        }}
      >
        {/* Progress dots */}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 30 }}>
          {STEPS.map((_, i) => (
            <div
              key={i}
              style={{
                height: 5, borderRadius: 3,
                width: i === step ? 22 : 6,
                background: i <= step ? 'var(--color-text-primary)' : 'var(--color-border-secondary)',
                transition: 'all 0.25s ease',
              }}
            />
          ))}
        </div>

        {/* Icon */}
        <div style={{ fontSize: 44, textAlign: 'center', marginBottom: 18, lineHeight: 1 }}>
          {s.icon}
        </div>

        {/* Title */}
        <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--color-text-primary)', textAlign: 'center', marginBottom: 10, lineHeight: 1.35 }}>
          {s.title}
        </div>

        {/* Description */}
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', textAlign: 'center', lineHeight: 1.75, marginBottom: 30 }}>
          {s.desc}
        </div>

        {/* Nav */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={finish}
            style={{
              fontSize: 11, color: 'var(--color-text-tertiary)',
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-sans)', padding: '4px 2px',
            }}
          >
            Skip tour
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            {step > 0 && (
              <button
                onClick={() => setStep(p => p - 1)}
                style={{
                  padding: '9px 18px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                  background: 'transparent',
                  border: '0.5px solid var(--color-border-secondary)',
                  color: 'var(--color-text-secondary)',
                  cursor: 'pointer', fontFamily: 'var(--font-sans)',
                }}
              >
                Back
              </button>
            )}
            <button
              onClick={isLast ? finish : () => setStep(p => p + 1)}
              style={{
                padding: '9px 24px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                background: 'var(--color-text-primary)',
                color: 'var(--color-background-primary)',
                border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)',
              }}
            >
              {isLast ? "Let's go →" : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
