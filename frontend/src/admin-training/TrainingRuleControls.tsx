import { Minus, Plus, SlidersHorizontal } from 'lucide-react';
import type { TrainingForm } from './trainingConfig';

type TrainingRuleControlsProps = {
  form: TrainingForm;
  idPrefix: string;
  onChange: <K extends keyof TrainingForm>(field: K, value: TrainingForm[K]) => void;
};

type RangeFieldProps = {
  id: string;
  label: string;
  value: string;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  hint: string;
  disabled?: boolean;
  onChange: (value: string) => void;
};

type StepperFieldProps = {
  id: string;
  label: string;
  value: string;
  min: number;
  max: number;
  hint: string;
  onChange: (value: string) => void;
};

const asBoundedNumber = (value: string, min: number, max: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return min;
  return Math.min(max, Math.max(min, parsed));
};

function RangeField({
  id,
  label,
  value,
  min = 0,
  max = 100,
  step = 5,
  suffix = '%',
  hint,
  disabled = false,
  onChange,
}: RangeFieldProps) {
  const numericValue = asBoundedNumber(value, min, max);
  const hintId = `${id}-hint`;

  return (
    <div className="training-range-field">
      <div className="training-range-heading">
        <label htmlFor={id}>{label}</label>
        <div className="training-range-value">
          <input
            id={`${id}-number`}
            type="number"
            min={min}
            max={max}
            step={1}
            value={numericValue}
            disabled={disabled}
            aria-label={`${label} sayısal değer`}
            onChange={(event) => onChange(String(asBoundedNumber(event.target.value, min, max)))}
          />
          <span>{suffix}</span>
        </div>
      </div>
      <input
        id={id}
        className="training-range-input"
        type="range"
        min={min}
        max={max}
        step={step}
        value={numericValue}
        disabled={disabled}
        aria-describedby={hintId}
        onChange={(event) => onChange(event.target.value)}
      />
      <div className="training-range-scale" aria-hidden="true">
        <span>{min}{suffix}</span>
        <span>{max}{suffix}</span>
      </div>
      <small id={hintId}>{hint}</small>
    </div>
  );
}

function StepperField({
  id,
  label,
  value,
  min,
  max,
  hint,
  onChange,
}: StepperFieldProps) {
  const numericValue = asBoundedNumber(value, min, max);
  const setValue = (nextValue: number) => onChange(String(asBoundedNumber(String(nextValue), min, max)));

  return (
    <div className="training-stepper-field">
      <label htmlFor={id}>{label}</label>
      <div className="training-stepper-control">
        <button
          type="button"
          onClick={() => setValue(numericValue - 1)}
          disabled={numericValue <= min}
          aria-label={`${label} değerini azalt`}
          title="Azalt"
        >
          <Minus size={18} />
        </button>
        <input
          id={id}
          type="number"
          min={min}
          max={max}
          value={numericValue}
          onChange={(event) => setValue(Number(event.target.value))}
        />
        <button
          type="button"
          onClick={() => setValue(numericValue + 1)}
          disabled={numericValue >= max}
          aria-label={`${label} değerini artır`}
          title="Artır"
        >
          <Plus size={18} />
        </button>
      </div>
      <small>{hint}</small>
    </div>
  );
}

export function TrainingRuleControls({
  form,
  idPrefix,
  onChange,
}: TrainingRuleControlsProps) {
  return (
    <section className="training-rule-panel" aria-labelledby={`${idPrefix}-rules-title`}>
      <div className="training-rule-panel-heading">
        <span className="training-rule-panel-icon" aria-hidden="true">
          <SlidersHorizontal size={19} />
        </span>
        <div>
          <h4 id={`${idPrefix}-rules-title`}>Ölçüm ve geçerlilik</h4>
          <p>Eğitimin tamamlanma ve yenileme koşullarını belirleyin.</p>
        </div>
      </div>

      <div className="training-rule-grid">
        {form.requires_quiz && (
          <RangeField
            id={`${idPrefix}-pass-score`}
            label="Başarı barajı"
            value={form.pass_score}
            hint="Sınavın başarılı sayılması için gereken en düşük puan."
            onChange={(value) => onChange('pass_score', value)}
          />
        )}

        {form.requires_full_watch && (
          <RangeField
            id={`${idPrefix}-minimum-watch`}
            label="Minimum izleme"
            value={form.minimum_watch_percent}
            hint={form.compliance_lock
              ? 'Kanuni uyum eğitimlerinde minimum izleme oranı %100 olarak kilitlidir.'
              : 'İçeriğin tamamlanmış sayılması için gereken minimum oran.'}
            disabled={form.compliance_lock}
            onChange={(value) => onChange('minimum_watch_percent', value)}
          />
        )}

        {form.requires_quiz && (
          <StepperField
            id={`${idPrefix}-quiz-attempts`}
            label="Quiz deneme hakkı"
            value={form.quiz_attempt_limit}
            min={0}
            max={100}
            hint="0 seçildiğinde deneme hakkı sınırsızdır."
            onChange={(value) => onChange('quiz_attempt_limit', value)}
          />
        )}

        <div className="input-group training-rule-text-field">
          <label className="input-label" htmlFor={`${idPrefix}-duration`}>Eğitim süresi</label>
          <input
            id={`${idPrefix}-duration`}
            className="form-control"
            value={form.duration}
            placeholder="Örn. 45 dakika"
            onChange={(event) => onChange('duration', event.target.value)}
          />
          <small>Katalogda kullanıcıya gösterilecek tahmini süre.</small>
        </div>

        <div className="input-group training-rule-text-field">
          <label className="input-label" htmlFor={`${idPrefix}-validity-period`}>Geçerlilik açıklaması</label>
          <input
            id={`${idPrefix}-validity-period`}
            className="form-control"
            value={form.validity_period}
            placeholder="Örn. 1 yıl"
            onChange={(event) => onChange('validity_period', event.target.value)}
          />
          <small>Katalog ve raporlarda gösterilecek bilgilendirme metni.</small>
        </div>

        {form.auto_reassign_enabled && (
          <div className="training-validity-field">
            <StepperField
              id={`${idPrefix}-validity-amount`}
              label="Tekrar atama süresi"
              value={form.validity_amount}
              min={1}
              max={10_000}
              hint="Süre dolduğunda eğitim otomatik olarak yeniden atanır."
              onChange={(value) => onChange('validity_amount', value)}
            />
            <label className="training-validity-unit">
              <span>Süre birimi</span>
              <select
                className="form-control"
                value={form.validity_unit}
                onChange={(event) => onChange('validity_unit', event.target.value)}
              >
                <option value="day">Gün</option>
                <option value="month">Ay</option>
                <option value="year">Yıl</option>
              </select>
            </label>
          </div>
        )}
      </div>
    </section>
  );
}
