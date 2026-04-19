import { useEffect, useRef, useState } from 'react';
import { usePresentationStore } from '../../store/usePresentationStore';

const STAGES = [
  'Initialising neural engine…',
  'Parsing context data…',
  'Structuring slide outline…',
  'Generating content per slide…',
  'Applying visual theme…',
  'Optimising layout…',
  'Rendering PPTX…',
  'Packaging output…',
  'Complete.',
];

interface ProgressOverlayProps {
  title?: string;
  subtitle?: string;
}

export default function ProgressOverlay({ title = 'Generating Presentation', subtitle }: ProgressOverlayProps) {
  const { loading, title: presentationTitle, numSlides } = usePresentationStore();
  const [pct, setPct] = useState(0);
  const [stageIdx, setStageIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (loading) {
      setPct(0);
      setStageIdx(0);
      
      // Heuristic: 8s per slide + 10s base overhead
      const estSeconds = (numSlides * 8) + 10;
      setTimeLeft(estSeconds);

      intervalRef.current = setInterval(() => {
        setPct((prev) => {
          const next = Math.min(prev + Math.random() * 8 + 2, 95);
          setStageIdx(Math.min(Math.floor((next / 100) * (STAGES.length - 1)), STAGES.length - 2));
          return next;
        });
      }, 500);

      timerRef.current = setInterval(() => {
        setTimeLeft(prev => Math.max(0, prev - 1));
      }, 1000);

    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      setPct(0);
      setTimeLeft(0);
    }
    return () => { 
      if (intervalRef.current) clearInterval(intervalRef.current); 
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loading, numSlides]);

  if (!loading) return null;

  return (
    <div className="progress-overlay show">
      <div className="progress-modal">
        <div className="progress-title">{title}</div>
        <div className="progress-sub">{subtitle || presentationTitle || '—'}</div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="progress-pct">{Math.floor(pct)}%</div>
        <div className="progress-timer" style={{ 
          fontFamily: 'var(--mono)', 
          fontSize: '10px', 
          color: 'var(--text-muted)', 
          marginTop: '4px',
          opacity: timeLeft > 0 ? 1 : 0
        }}>
          ESTIMATED TIME REMAINING: {timeLeft}s
        </div>
        <div className="progress-stage">{STAGES[stageIdx]}</div>
        <div>
          <div className="dots">
            <div className="dot" />
            <div className="dot" />
            <div className="dot" />
          </div>
        </div>
      </div>
    </div>
  );
}
