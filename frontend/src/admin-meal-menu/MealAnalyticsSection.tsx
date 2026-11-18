import { BarChart3, CalendarDays, MessageSquare, Star, Users, Utensils } from 'lucide-react';
import { ExportExcelButton } from '../components/ExportExcelButton';
import { PaginationControls } from '../components/PaginationControls';
import type {
  MealMenu,
  MealMenuRating,
  MealMenuRatingReport,
  PaginatedResponse,
} from '../types';

type SummaryRow = MealMenuRatingReport['summary'][number];

type Props = {
  month: string;
  overall?: MealMenuRatingReport['overall'];
  summary: SummaryRow[];
  selectedDate: string | null;
  selectedSummary?: SummaryRow;
  selectedMenu?: MealMenu;
  ratings?: PaginatedResponse<MealMenuRating>;
  loadingRatings: boolean;
  onMonthChange: (value: string) => void;
  onDateChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onExport: () => void;
};

const formatDay = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'long',
    weekday: 'long',
  });

const formatMonth = (value: string) => {
  const [year, month] = value.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('tr-TR', {
    month: 'long',
    year: 'numeric',
  });
};

export const MealAnalyticsSection = ({
  month, overall, summary, selectedDate, selectedSummary, selectedMenu, ratings,
  loadingRatings, onMonthChange, onDateChange, onPageChange, onExport,
}: Props) => (
  <section className="meal-analytics">
    <div className="meal-analytics-header">
      <div>
        <h3><BarChart3 size={20} /> Değerlendirme</h3>
        <p>{formatMonth(month)} dönemi yemek, çalışan tutumu ve temizlik değerlendirmeleri</p>
      </div>
      <div className="meal-analytics-actions">
        <label className="meal-month-picker">
          <span>Ay seç</span>
          <input type="month" value={month} onChange={(event) => onMonthChange(event.target.value)} />
        </label>
        <ExportExcelButton onClick={onExport} disabled={!overall?.response_count} />
      </div>
    </div>

    <div className="meal-score-grid">
      <div className="meal-score-card primary">
        <span>Genel Ortalama</span>
        <strong><Star size={18} fill="currentColor" /> {(overall?.avg_total_score ?? 0).toFixed(2)}</strong>
        <small>{overall?.response_count ?? 0} değerlendirme</small>
      </div>
      <div className="meal-score-card">
        <span>Yemekler</span>
        <strong><Utensils size={18} /> {(overall?.avg_food_score ?? 0).toFixed(2)}</strong>
      </div>
      <div className="meal-score-card">
        <span>Çalışan Tutumu</span>
        <strong><Users size={18} /> {(overall?.avg_staff_score ?? 0).toFixed(2)}</strong>
      </div>
      <div className="meal-score-card">
        <span>Temizlik</span>
        <strong><BarChart3 size={18} /> {(overall?.avg_cleanliness_score ?? 0).toFixed(2)}</strong>
      </div>
    </div>

    {summary.length ? (
      <div className="meal-analysis-layout">
        <aside className="meal-day-list">
          <div className="meal-day-list-title"><CalendarDays size={17} /> Günlük sonuçlar</div>
          {summary.map((day) => (
            <button
              key={day.meal_date}
              type="button"
              className={`meal-day-card ${selectedDate === day.meal_date ? 'active' : ''}`}
              onClick={() => onDateChange(day.meal_date)}
            >
              <span>{formatDay(day.meal_date)}</span>
              <strong>{day.avg_total_score.toFixed(2)}</strong>
              <small>{day.response_count} kişi değerlendirdi</small>
            </button>
          ))}
        </aside>

        <div className="meal-day-detail">
          {selectedSummary && selectedDate && (
            <>
              <div className="meal-day-detail-header">
                <div>
                  <h4>{formatDay(selectedDate)}</h4>
                  <p>{selectedSummary.response_count} kişi değerlendirdi</p>
                </div>
                <strong><Star size={17} fill="currentColor" /> {selectedSummary.avg_total_score.toFixed(2)}</strong>
              </div>
              {selectedMenu?.items?.length ? (
                <div className="meal-menu-preview">
                  {selectedMenu.items.map((item, index) => (
                    <span key={`${selectedDate}-${item}-${index}`}>{item}</span>
                  ))}
                </div>
              ) : null}
              <div className="meal-day-score-row">
                <span>Yemek <strong>{selectedSummary.avg_food_score.toFixed(2)}</strong></span>
                <span>Tutum <strong>{selectedSummary.avg_staff_score.toFixed(2)}</strong></span>
                <span>Temizlik <strong>{selectedSummary.avg_cleanliness_score.toFixed(2)}</strong></span>
              </div>
              <div className="meal-comment-list">
                <div className="meal-comment-title">
                  <MessageSquare size={17} /> Kişi bazlı yorumlar ve puanlar
                </div>
                {(ratings?.items ?? []).map((row) => (
                  <article key={row.id} className="meal-comment-card">
                    <div>
                      <strong>{row.name || 'Kullanıcı'}</strong>
                      <small>
                        {row.employee_id ? `#${row.employee_id}` : ''}
                        {row.department ? ` - ${row.department}` : ''}
                        {row.position ? ` - ${row.position}` : ''}
                      </small>
                    </div>
                    <div className="meal-comment-scores">
                      <span>Yemek {row.food_score}</span>
                      <span>Tutum {row.staff_score}</span>
                      <span>Temizlik {row.cleanliness_score}</span>
                      <strong>{row.avg_total_score?.toFixed(2)}</strong>
                    </div>
                    <p>{row.comment?.trim() || 'Yorum yazılmamış.'}</p>
                  </article>
                ))}
                {loadingRatings && <p>Değerlendirmeler yükleniyor...</p>}
                <PaginationControls pagination={ratings?.pagination} onPageChange={onPageChange} />
              </div>
            </>
          )}
        </div>
      </div>
    ) : (
      <div className="meal-empty-state">
        <BarChart3 size={28} />
        <strong>Bu ay için değerlendirme yok</strong>
        <span>Ay seçimini değiştirerek geçmiş değerlendirmeleri inceleyebilirsiniz.</span>
      </div>
    )}
  </section>
);
