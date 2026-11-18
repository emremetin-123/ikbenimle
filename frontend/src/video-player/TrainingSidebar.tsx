import { useState } from 'react';
import { ChevronDown, ChevronLeft } from 'lucide-react';
import type { VideoPlayerData } from '../types';

type Props = {
  data: VideoPlayerData;
  currentIndex: number;
  mobileOpen: boolean;
  onBack: () => void;
  onClose: () => void;
  onSelect: (index: number) => void;
};

export const TrainingSidebar = ({
  data, currentIndex, mobileOpen, onBack, onClose, onSelect,
}: Props) => {
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const toggleModule = (id: number) => setCollapsed((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  return (
  <>
    <div className={`sidebar-overlay ${mobileOpen ? 'active' : ''}`} onClick={onClose} />
    <aside className={`sidebar training-player-sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
      <button type="button" className="desktop-only training-player-back" onClick={onBack}>
        <ChevronLeft size={18} /> Geri Dön
      </button>
      <h4 className="training-player-sidebar-label">EĞİTİM İÇERİĞİ</h4>
      <h2 className="training-player-sidebar-title">{data.video.title}</h2>
      <div className="training-player-lesson-list">
        {data.lessons.map((lesson, index) => {
          const previous = data.lessons[index - 1];
          const firstInModule = lesson.module_id == null || !previous || previous.module_id !== lesson.module_id;
          const moduleId = lesson.module_id ?? -(index + 1);
          const isCollapsed = collapsed.has(moduleId);
          const moduleNumber = (lesson.module_index ?? index) + 1;
          const contentNumber = lesson.module_id == null ? 1 : data.lessons.slice(0, index + 1).filter((item) => item.module_id === lesson.module_id).length;
          const locked = index > 0 && previous.status !== 'completed';
          return (
            <div key={lesson.id}>
              {firstInModule && <button type="button" className="training-player-module-title" aria-expanded={!isCollapsed} onClick={() => toggleModule(moduleId)}>
                <span>Modül {moduleNumber} · {lesson.module_title || lesson.title}</span><ChevronDown size={16} aria-hidden="true" />
              </button>}
              {!isCollapsed && <button
                type="button"
                disabled={locked}
                onClick={() => onSelect(index)}
                className={`training-player-lesson ${currentIndex === index ? 'is-active' : ''} ${locked ? 'is-locked' : ''}`}
                aria-current={currentIndex === index ? 'step' : undefined}
              >
                <small>{moduleNumber}.{contentNumber}</small><br />
                <span>{lesson.title}</span>
                {lesson.status === 'completed' && <span className="training-player-lesson-complete">✓</span>}
              </button>}
            </div>
          );
        })}
      </div>
    </aside>
  </>
  );
};
