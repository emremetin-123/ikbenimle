import type { FormEvent } from 'react';
import { Plus, Save, Trash2, Upload } from 'lucide-react';
import type { MealMenu, MealMenuRatingReport } from '../types';

type Props = {
  month: string;
  rows: MealMenu[];
  summary: MealMenuRatingReport['summary'];
  rawText: string;
  loading: boolean;
  message: string;
  queryError: string;
  onMonthChange: (value: string) => void;
  onFileChange: (file: File | null) => void;
  onParse: (event: FormEvent) => void;
  onAdd: () => void;
  onPublish: () => void;
  onUpdate: (index: number, patch: Partial<MealMenu>) => void;
  onRemove: (index: number) => void;
};

export const MealEditorSection = ({
  month, rows, summary, rawText, loading, message, queryError, onMonthChange,
  onFileChange, onParse, onAdd, onPublish, onUpdate, onRemove,
}: Props) => (
  <>
    <form onSubmit={onParse} className="responsive-grid-3 meal-upload-form">
      <div className="input-group">
        <label className="input-label" htmlFor="meal-editor-month">Ay</label>
        <input
          className="form-control"
          type="month"
          id="meal-editor-month"
          value={month}
          onChange={(event) => onMonthChange(event.target.value)}
        />
      </div>
      <div className="input-group">
        <label className="input-label" htmlFor="meal-editor-pdf">PDF</label>
        <input
          className="form-control"
          type="file"
          id="meal-editor-pdf"
          accept="application/pdf"
          onChange={(event) => onFileChange(event.target.files?.[0] || null)}
        />
      </div>
      <button type="submit" className="btn-primary" disabled={loading}>
        <Upload size={18} /> PDF Oku
      </button>
    </form>

    {(message || queryError) && (
      <div className="admin-inline-message">{message || queryError}</div>
    )}

    <div className="meal-menu-toolbar">
      <strong>{rows.length} günlük kayıt</strong>
      <div>
        <button type="button" className="btn-secondary" onClick={onAdd}>
          <Plus size={17} /> Gün Ekle
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={onPublish}
          disabled={loading || rows.length === 0}
        >
          <Save size={17} /> Yayınla
        </button>
      </div>
    </div>

    <div className="meal-menu-editor-list">
      {rows.map((row, index) => {
        const dayRating = summary.find((item) => item.meal_date === row.meal_date);
        return (
          <div key={`${row.meal_date}-${index}`} className="meal-menu-editor-row">
            <input
              className="form-control"
              type="date"
              aria-label={`${index + 1}. menü tarihi`}
              value={row.meal_date}
              onChange={(event) => onUpdate(index, { meal_date: event.target.value })}
            />
            <div>
              <textarea
                className="form-control"
                rows={3}
                aria-label={`${index + 1}. günün yemekleri`}
                value={row.items.join('\n')}
                onChange={(event) =>
                  onUpdate(index, {
                    items: event.target.value.split('\n').map((item) => item.trim()).filter(Boolean),
                  })
                }
                placeholder="Her yemek kalemini ayrı satıra yazın"
              />
              {dayRating && (
                <small className="meal-menu-rating-note">
                  {dayRating.response_count} değerlendirme · Ortalama{' '}
                  {dayRating.avg_total_score.toFixed(2)}
                </small>
              )}
            </div>
            <button
              type="button"
              className="btn-icon danger"
              onClick={() => onRemove(index)}
              title="Kaldır"
              aria-label="Menüyü kaldır"
            >
              <Trash2 size={17} />
            </button>
          </div>
        );
      })}
    </div>

    {rawText && (
      <details className="meal-raw-text">
        <summary>PDF ham metni</summary>
        <textarea className="form-control" value={rawText} readOnly rows={8} aria-label="PDF ham metni" />
      </details>
    )}
  </>
);
