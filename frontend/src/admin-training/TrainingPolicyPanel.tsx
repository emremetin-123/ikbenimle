import { useState } from 'react';
import { ChevronDown, Settings2 } from 'lucide-react';
import type { TrainingForm } from './trainingConfig';
import { trainingPolicyToggles } from './trainingConfig';

type TrainingPolicyPanelProps = {
  form: TrainingForm;
  hasVideoLessons: boolean;
  onChange: <K extends keyof TrainingForm>(field: K, value: TrainingForm[K]) => void;
};

export function TrainingPolicyPanel({
  form,
  hasVideoLessons,
  onChange,
}: TrainingPolicyPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const visibleToggles = trainingPolicyToggles.filter((toggle) => !toggle.videoOnly || hasVideoLessons);
  const enabledCount = visibleToggles.filter((toggle) => Boolean(form[toggle.field])).length;

  return (
    <section className={`training-policy-panel ${expanded ? 'is-expanded' : ''}`}>
      <button
        type="button"
        className="training-policy-trigger"
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
      >
        <span className="training-policy-trigger-icon" aria-hidden="true">
          <Settings2 size={19} />
        </span>
        <span className="training-policy-trigger-copy">
          <strong>Eğitim kuralları</strong>
          <small>{enabledCount} etkin kural · Değiştirmek için açın</small>
        </span>
        <ChevronDown className="training-policy-chevron" size={20} aria-hidden="true" />
      </button>

      {expanded && (
        <div className="responsive-grid-2 training-policy-grid">
          {visibleToggles.map((toggle) => (
            <label key={toggle.field} className="training-policy-toggle">
              <input
                type="checkbox"
                checked={Boolean(form[toggle.field])}
                disabled={form.training_profile === 'compliance' && (toggle.field === 'requires_quiz' || toggle.field === 'requires_full_watch')}
                onChange={(event) => onChange(toggle.field, event.target.checked)}
              />
              <span>{toggle.label}</span>
            </label>
          ))}
        </div>
      )}
    </section>
  );
}
