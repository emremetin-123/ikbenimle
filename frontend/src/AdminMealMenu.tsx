import { ModulePageHeader } from './components/ModulePageHeader';
import { ModalShell } from './components/ModalShell';
import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Utensils, X } from 'lucide-react';
import { API_BASE } from './config';
import { api } from './services/api';
import { queryKeys } from './queryClient';
import type { MealMenu, MealMenuRating, MealMenuRatingReport } from './types';
import { MealAnalyticsSection } from './admin-meal-menu/MealAnalyticsSection';
import { MealEditorSection } from './admin-meal-menu/MealEditorSection';

type ParsedMealResponse = {
  source_file?: string;
  raw_text?: string;
  parser?: 'ai' | 'table' | 'text';
  ai_error?: string;
  menus: MealMenu[];
};

const currentMonth = () => new Date().toISOString().slice(0, 7);
const nextDate = (month: string, rows: MealMenu[]) => {
  const used = new Set(rows.map((row) => row.meal_date));
  const [year, monthNumber] = month.split('-').map(Number);
  for (let day = 1; day <= new Date(year, monthNumber, 0).getDate(); day += 1) {
    const value = `${month}-${String(day).padStart(2, '0')}`;
    if (!used.has(value)) return value;
  }
  return `${month}-01`;
};
const parseMessage = (data: ParsedMealResponse) => {
  if (data.menus?.length) {
    const parser = data.parser === 'ai' ? 'yapay zeka' : data.parser === 'table' ? 'tablo düzeni' : 'metin';
    return `${data.menus.length} günlük menü okundu (${parser}).${
      data.ai_error ? ` Yapay zeka kullanılamadı: ${data.ai_error}.` : ''
    } Kontrol edip yayınlayın.`;
  }
  return `PDF içinden tarihli menü ayrıştırılamadı.${
    data.ai_error ? ` Yapay zeka hatası: ${data.ai_error}.` : ''
  } Günleri elle ekleyebilirsiniz.`;
};

export const AdminMealMenu = () => {
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(currentMonth());
  const [editorOpen, setEditorOpen] = useState(false);
  const [draftRows, setDraftRows] = useState<MealMenu[] | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [sourceFile, setSourceFile] = useState<string | null>(null);
  const [rawText, setRawText] = useState('');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [ratingPage, setRatingPage] = useState(1);
  const [message, setMessage] = useState('');

  const menusQuery = useQuery({
    queryKey: [...queryKeys.adminMealMenus, month],
    queryFn: () => api.list<MealMenu>(`/api/admin/meal-menu?month=${month}&page=1&pageSize=31`),
  });
  const summaryQuery = useQuery({
    queryKey: [...queryKeys.adminMealRatingSummary, month],
    queryFn: () => api.get<MealMenuRatingReport>(`/api/admin/meal-menu/ratings/summary?month=${month}`),
  });
  const rows = draftRows ?? menusQuery.data?.items ?? [];
  const summary = summaryQuery.data?.summary ?? [];
  const effectiveDate = selectedDate && summary.some((row) => row.meal_date === selectedDate)
    ? selectedDate
    : summary[0]?.meal_date ?? null;
  const ratingsQuery = useQuery({
    queryKey: [...queryKeys.adminMealRatings, month, effectiveDate, ratingPage],
    queryFn: () => api.list<MealMenuRating>(
      `/api/admin/meal-menu/ratings?month=${month}&date=${effectiveDate}&page=${ratingPage}&pageSize=20`,
    ),
    enabled: Boolean(effectiveDate),
  });

  const parseMutation = useMutation({
    mutationFn: (body: FormData) => api.upload<ParsedMealResponse>('/api/admin/meal-menu/parse-pdf', body),
    onSuccess: (data) => {
      setDraftRows(data.menus || []);
      setSourceFile(data.source_file || file?.name || null);
      setRawText(data.raw_text || '');
      setMessage(parseMessage(data));
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : 'PDF okunamadı.'),
  });
  const publishMutation = useMutation({
    mutationFn: () => api.put<{ saved: number }>('/api/admin/meal-menu/bulk', {
      source_file: sourceFile,
      menus: rows.map(({ meal_date, items }) => ({ meal_date, items })),
    }),
    onSuccess: async ({ saved }) => {
      setMessage(`${saved} günlük menü yayınlandı.`);
      setDraftRows(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminMealMenus });
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : 'Menü yayınlanamadı.'),
  });
  const deleteMutation = useMutation({
    mutationFn: (date: string) => api.delete(`/api/admin/meal-menu/${date}`),
    onSuccess: async () => {
      setDraftRows(null);
      setMessage('Menü kaldırıldı.');
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminMealMenus });
    },
  });

  const changeMonth = (value: string) => {
    setMonth(value);
    setDraftRows(null);
    setSelectedDate(null);
    setRatingPage(1);
    setMessage('');
  };
  const parsePdf = (event: FormEvent) => {
    event.preventDefault();
    if (!file) return setMessage('PDF dosyası seçin.');
    const body = new FormData();
    body.append('file', file);
    body.append('month', month);
    parseMutation.mutate(body);
  };
  const removeRow = (index: number) => {
    if (rows[index].id) return deleteMutation.mutate(rows[index].meal_date);
    setDraftRows(rows.filter((_, rowIndex) => rowIndex !== index));
  };
  const closeEditor = () => { setEditorOpen(false); setFile(null); };
  const loading = menusQuery.isLoading || summaryQuery.isLoading
    || parseMutation.isPending || publishMutation.isPending || deleteMutation.isPending;

  return (
    <>
      <ModulePageHeader title="Yemek Menüsü" description="Yemek menülerini yayınlayın, çalışan değerlendirmelerini ve günlük sonuçları takip edin." icon={<Utensils />} tone="teal" actions={<button type="button" className="btn-secondary" onClick={() => setEditorOpen(true)} aria-haspopup="dialog"><Plus size={18} /> Menü Ekle</button>} />
      <div className="premium-card admin-meal-menu-shell">
        <MealAnalyticsSection
          month={month}
          overall={summaryQuery.data?.overall}
          summary={summary}
          selectedDate={effectiveDate}
          selectedSummary={summary.find((row) => row.meal_date === effectiveDate)}
          selectedMenu={menusQuery.data?.items.find((row) => row.meal_date === effectiveDate)}
          ratings={ratingsQuery.data}
          loadingRatings={ratingsQuery.isLoading}
          onMonthChange={changeMonth}
          onDateChange={(date) => { setSelectedDate(date); setRatingPage(1); }}
          onPageChange={setRatingPage}
          onExport={() => window.open(`${API_BASE}/api/admin/meal-menu/ratings/export?${new URLSearchParams({ month })}`, '_blank')}
        />
      </div>
      {editorOpen && <ModalShell labelledBy="meal-editor-title" onClose={closeEditor} className="admin-action-modal">
        <div className="admin-modal-header">
          <h2 id="meal-editor-title">Menü Ekle</h2>
          <button type="button" className="admin-modal-close" onClick={closeEditor} aria-label="Menü düzenleyiciyi kapat"><X size={20} /></button>
        </div>
        <MealEditorSection
          month={month}
          rows={rows}
          summary={summary}
          rawText={rawText}
          loading={loading}
          message={message}
          queryError={
            menusQuery.error instanceof Error ? menusQuery.error.message
              : summaryQuery.error instanceof Error ? summaryQuery.error.message : ''
          }
          onMonthChange={changeMonth}
          onFileChange={setFile}
          onParse={parsePdf}
          onAdd={() => setDraftRows([...rows, { meal_date: nextDate(month, rows), items: [''] }])}
          onPublish={() => publishMutation.mutate()}
          onUpdate={(index, patch) => setDraftRows(rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row))}
          onRemove={removeRow}
        />
      </ModalShell>}
    </>
  );
};
