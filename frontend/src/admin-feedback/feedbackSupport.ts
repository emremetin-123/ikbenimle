import type { jsPDF } from 'jspdf';
import type { FeedbackItem } from '../types';
import { feedbackStatus, statusText, typeText } from '../feedback/feedbackModel';

export type FeedbackParticipant = {
    id: number;
    user_id: number;
    name: string;
    department?: string | null;
    position?: string | null;
    review_completed_at?: string | null;
};

export type FeedbackComment = {
    id: number;
    user_name?: string | null;
    department?: string | null;
    comment: string;
    is_public?: number | boolean;
    attachment_name?: string | null;
    created_at?: string | null;
};

export type FeedbackHistory = {
    id: number;
    user_name?: string | null;
    old_status?: string | null;
    new_status: string;
    note?: string | null;
    created_at?: string | null;
};

export type FeedbackThread = {
    participants: FeedbackParticipant[];
    comments: FeedbackComment[];
    history: FeedbackHistory[];
};

export const statusLabel = (value?: string | null) => value ? statusText(value) : '-';

export const parseDetails = (item?: FeedbackItem | null) => {
    if (!item?.details) return null;
    try {
        return JSON.parse(item.details) as Record<string, string>;
    } catch {
        return null;
    }
};

const cleanPdfText = (value?: string | number | null) => String(value ?? '-')
    .replace(/\u0130/g, 'I')
    .replace(/\u0131/g, 'i')
    .replace(/\u015e/g, 'S')
    .replace(/\u015f/g, 's')
    .replace(/\u011e/g, 'G')
    .replace(/\u011f/g, 'g')
    .replace(/\u00dc/g, 'U')
    .replace(/\u00fc/g, 'u')
    .replace(/\u00d6/g, 'O')
    .replace(/\u00f6/g, 'o')
    .replace(/\u00c7/g, 'C')
    .replace(/\u00e7/g, 'c');

const drawTextBlock = (doc: jsPDF, title: string, value: string, x: number, y: number, width: number) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 64, 175);
    doc.text(cleanPdfText(title), x, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(40, 40, 40);
    const lines = doc.splitTextToSize(cleanPdfText(value || '-'), width);
    doc.text(lines, x, y + 5);
    return y + 8 + lines.length * 4.2;
};

const preparePdf = async (title: string, subtitle: string) => {
    const { jsPDF: JsPdf } = await import('jspdf');
    const doc = new JsPdf({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setDrawColor(30, 64, 175);
    doc.setLineWidth(0.9);
    doc.rect(10, 10, pageWidth - 20, 277);
    doc.setDrawColor(191, 155, 48);
    doc.setLineWidth(0.35);
    doc.rect(13, 13, pageWidth - 26, 271);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(30, 64, 175);
    doc.text(cleanPdfText(title), pageWidth / 2, 25, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(cleanPdfText(subtitle), pageWidth / 2, 32, { align: 'center' });
    doc.line(20, 38, pageWidth - 20, 38);

    return doc;
};

const normalizedPdfValue = (value?: string | null) => cleanPdfText(value || '').toLocaleLowerCase('tr-TR');

const drawFormText = (doc: jsPDF, text: string, x: number, y: number, options?: { size?: number; bold?: boolean; align?: 'left' | 'center' | 'right'; color?: [number, number, number] }) => {
    doc.setFont('helvetica', options?.bold ? 'bold' : 'normal');
    doc.setFontSize(options?.size || 6.4);
    const color = options?.color || [0, 0, 0];
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(cleanPdfText(text), x, y, { align: options?.align || 'left' });
};

const drawCheckbox = (doc: jsPDF, x: number, y: number, label: string, checked = false) => {
    doc.rect(x, y - 3, 3.4, 3.4);
    if (checked) {
        doc.setLineWidth(0.45);
        doc.line(x + 0.6, y - 1.4, x + 1.5, y);
        doc.line(x + 1.5, y, x + 3, y - 2.8);
        doc.setLineWidth(0.25);
    }
    drawFormText(doc, label, x + 5, y - 0.2);
};

const drawWrappedFormText = (doc: jsPDF, text: string, x: number, y: number, width: number, maxLines = 8, size = 7) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(size);
    doc.setTextColor(0, 0, 0);
    const lines = doc.splitTextToSize(cleanPdfText(text || '-'), width).slice(0, maxLines);
    doc.text(lines, x, y);
};

export const downloadFeedbackFormPdf = async (item: FeedbackItem, thread: FeedbackThread) => {
    const details = parseDetails(item);
    const { jsPDF: JsPdf } = await import('jspdf');
    const doc = new JsPdf({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const x = 12;
    const y = 12;
    const w = 186;
    const createdDate = item.created_at ? new Date(item.created_at).toLocaleDateString('tr-TR') : '-';
    const selectedDept = normalizedPdfValue(details?.department || item.assigned_department || item.department);
    const selectedCategory = normalizedPdfValue(details?.category || item.content);
    const participants = thread.participants.map(p => p.name).join(', ');

    doc.setDrawColor(0, 0, 0);
    doc.setTextColor(0, 0, 0);
    doc.setLineWidth(0.25);
    doc.rect(x, y, w, 255);

    doc.rect(x, y, 58, 14);
    drawFormText(doc, 'imortas', x + 14, y + 8.5, { size: 11, bold: true, color: [70, 70, 70] });
    doc.rect(x + 58, y, 94, 14);
    drawFormText(doc, 'ONERI FORMU', x + 105, y + 9, { size: 13, bold: true, align: 'center' });
    doc.rect(x + 152, y, 34, 7);
    doc.rect(x + 152, y + 7, 34, 7);
    drawFormText(doc, 'ONERI TARIHI:', x + 154, y + 4.5, { bold: true });
    drawFormText(doc, createdDate, x + 176, y + 4.5);
    drawFormText(doc, 'ONERI NO:', x + 154, y + 11.5, { bold: true });
    drawFormText(doc, String(item.id), x + 176, y + 11.5);

    const r1 = y + 14;
    doc.rect(x, r1, 80, 9);
    doc.rect(x + 80, r1, 72, 9);
    doc.rect(x + 152, r1, 34, 9);
    drawFormText(doc, 'ONERI VERENIN CALISTIGI BOLUM:', x + 2, r1 + 4, { bold: true });
    drawFormText(doc, item.department || '-', x + 44, r1 + 4);
    drawFormText(doc, 'ONERI VEREN KISININ ADI SOYADI:', x + 82, r1 + 4, { bold: true });
    drawFormText(doc, item.user_name || 'Anonim', x + 125, r1 + 4);

    const r2 = r1 + 9;
    doc.rect(x, r2, 186, 15);
    drawFormText(doc, 'ILGILI MUDURLUK', x + 2, r2 + 9, { bold: true });
    const departments = ['Insan Kaynaklari', 'Kalite', 'Muhasebe', 'Metod', 'Uretim', 'Satis/Pazarlama', 'MPL', 'Satin Alma', 'Bilgi Islem', 'Mali Isler'];
    departments.forEach((department, index) => {
        const col = index % 5;
        const row = Math.floor(index / 5);
        drawCheckbox(doc, x + 42 + col * 27, r2 + 5 + row * 7, department, selectedDept.includes(normalizedPdfValue(department)));
    });

    const r3 = r2 + 15;
    doc.rect(x, r3, 186, 6);
    drawFormText(doc, 'ONERININ ONCEKI VEYA SONRAKI YAZINIZ, SEKIL, RESIM, HESAP EDINIZ (KURSUN KALEM VE BOYALI KALEM KULLANINIZ)', x + 93, r3 + 4, { size: 5.5, bold: true, align: 'center' });

    const r4 = r3 + 6;
    doc.rect(x, r4, 10, 62);
    doc.text(cleanPdfText('CALISAN TARAFINDAN DOLDURULACAK'), x + 6, r4 + 52, { angle: 90 });
    doc.rect(x + 10, r4, 88, 62);
    doc.rect(x + 98, r4, 88, 62);
    drawFormText(doc, 'ONCE (MEVCUT DURUM)', x + 54, r4 + 4, { bold: true, align: 'center' });
    drawFormText(doc, 'SONRA (ONERILEN DURUM)', x + 142, r4 + 4, { bold: true, align: 'center' });
    drawWrappedFormText(doc, details?.currentSituation || item.content, x + 13, r4 + 11, 82, 11, 7);
    drawWrappedFormText(doc, details?.proposedSituation || '-', x + 101, r4 + 11, 82, 11, 7);

    const r5 = r4 + 62;
    doc.rect(x, r5, 186, 25);
    drawFormText(doc, 'ONERI KATEGORISI (EN ILGILI TEK KARE ISARETLENECEK):', x + 2, r5 + 5, { bold: true });
    const categories = ['Is Sagligi ve Guvenligi', 'Enerji Tasarrufu', 'Kalite', 'Maliyet Tasarrufu', 'Is Kolayligi / Ergonomi', 'Alan Tasarrufu', 'Verimlilik', 'Malzeme Tasarrufu', 'Dokuman', 'Diger'];
    categories.forEach((category, index) => {
        const col = index % 4;
        const row = Math.floor(index / 4);
        drawCheckbox(doc, x + 52 + col * 34, r5 + 6 + row * 7, category, selectedCategory.includes(normalizedPdfValue(category)));
    });

    const r6 = r5 + 25;
    doc.rect(x, r6, 98, 24);
    doc.rect(x + 98, r6, 42, 24);
    doc.rect(x + 140, r6, 46, 24);
    drawFormText(doc, 'YAPILACAK YATIRIM (GEREKIYOR ISE):', x + 2, r6 + 5, { bold: true });
    drawFormText(doc, 'ACIKLAMA', x + 2, r6 + 10, { bold: true });
    drawWrappedFormText(doc, details?.investment || '-', x + 18, r6 + 10, 76, 3, 6.5);
    drawFormText(doc, 'ONGORULEN TUTAR:', x + 142, r6 + 5, { bold: true });
    drawWrappedFormText(doc, details?.estimatedCost || '-', x + 142, r6 + 12, 42, 2, 7);
    drawFormText(doc, 'IMZA:', x + 142, r6 + 20, { bold: true });

    const r7 = r6 + 24;
    doc.rect(x, r7, 48, 22);
    doc.rect(x + 48, r7, 138, 22);
    drawCheckbox(doc, x + 2, r7 + 7, 'ONERI SISTEMINE UYGUN');
    drawCheckbox(doc, x + 2, r7 + 16, 'ONERI SISTEMINE UYGUN DEGIL');
    drawFormText(doc, 'ACIKLAMA:', x + 50, r7 + 5, { bold: true });
    drawWrappedFormText(doc, participants ? `Katilimcilar: ${participants}` : '-', x + 66, r7 + 5, 115, 3, 6.5);

    const r8 = r7 + 22;
    doc.rect(x, r8, 10, 72);
    doc.text(cleanPdfText('ONERI DEGERLENDIRME SORUMLUSU TARAFINDAN DOLDURULACAK'), x + 6, r8 + 68, { angle: 90 });
    doc.rect(x + 10, r8, 82, 32);
    doc.rect(x + 92, r8, 55, 32);
    doc.rect(x + 147, r8, 39, 32);
    drawFormText(doc, 'KAZANC TURU:', x + 12, r8 + 5, { bold: true });
    drawFormText(doc, 'KAZANC BIRIMI:', x + 94, r8 + 5, { bold: true });
    ['ADAM SAAT', 'MAKINE SAAT', 'KG/ADET', 'M2', 'DIGER'].forEach((unit, index) => drawCheckbox(doc, x + 113, r8 + 6 + index * 5.2, unit));
    drawFormText(doc, 'ONGORULEN TOPLAM KAZANC:', x + 149, r8 + 5, { bold: true });

    const r9 = r8 + 32;
    doc.rect(x + 10, r9, 52, 14);
    doc.rect(x + 62, r9, 85, 14);
    doc.rect(x + 147, r9, 39, 14);
    drawFormText(doc, 'UYGULAYACAK KISI:', x + 12, r9 + 5, { bold: true });
    drawFormText(doc, item.assigned_to_name || '-', x + 12, r9 + 10);
    drawFormText(doc, 'HEDEF UYGULAMA BASLANGIC TARIHI:', x + 64, r9 + 5, { bold: true });
    drawFormText(doc, 'HEDEF UYGULAMA BITIS TARIHI:', x + 149, r9 + 5, { bold: true });
    drawFormText(doc, item.due_date ? new Date(item.due_date).toLocaleDateString('tr-TR') : '-', x + 149, r9 + 10);

    const r10 = r9 + 14;
    doc.rect(x + 10, r10, 52, 26);
    doc.rect(x + 62, r10, 124, 26);
    drawFormText(doc, 'DEGERLENDIRILME SONUCU:', x + 12, r10 + 5, { bold: true });
    drawCheckbox(doc, x + 64, r10 + 6, 'UYGUN', item.decision === 'approved');
    drawCheckbox(doc, x + 64, r10 + 14, 'ISE UYGUN DEGIL', item.decision === 'rejected');
    drawCheckbox(doc, x + 64, r10 + 22, 'EKSIK VAR', item.decision === 'needs_revision');
    drawFormText(doc, 'ACIKLAMA:', x + 103, r10 + 5, { bold: true });
    drawWrappedFormText(doc, item.decision_note || item.public_response || '-', x + 119, r10 + 5, 62, 4, 6.5);

    const r11 = r10 + 26;
    doc.rect(x + 10, r11, 52, 18);
    doc.rect(x + 62, r11, 124, 18);
    drawFormText(doc, 'TARIH:', x + 12, r11 + 5, { bold: true });
    drawFormText(doc, new Date().toLocaleDateString('tr-TR'), x + 12, r11 + 11);
    drawFormText(doc, 'BOLUM YONETICISI AD SOYAD - IMZA:', x + 64, r11 + 5, { bold: true });

    const r12 = r11 + 18;
    doc.rect(x, r12, 10, 22);
    doc.text(cleanPdfText('KOMISYON KARARI'), x + 6, r12 + 20, { angle: 90 });
    doc.rect(x + 10, r12, 52, 11);
    doc.rect(x + 10, r12 + 11, 52, 11);
    doc.rect(x + 62, r12, 124, 22);
    drawFormText(doc, 'UYGUN DEGIL', x + 12, r12 + 7, { bold: true });
    drawCheckbox(doc, x + 55, r12 + 7, '');
    drawFormText(doc, 'UYGUNDUR', x + 12, r12 + 18, { bold: true });
    drawCheckbox(doc, x + 55, r12 + 18, '');
    drawFormText(doc, 'ACIKLAMA:', x + 64, r12 + 7, { bold: true });

    doc.setFontSize(6);
    doc.text(cleanPdfText('X:\\KALITE\\SISTEM DOKUMANLARI\\Formlar\\F302'), x, 280);
    doc.save(`Oneri_Formu_${item.id}.pdf`);
};

export const downloadFeedbackResultPdf = async (item: FeedbackItem, thread: FeedbackThread) => {
    const doc = await preparePdf('ONERI / SIKAYET SONUC RAPORU', `Kayit No: ${item.id} - Rapor Tarihi: ${new Date().toLocaleDateString('tr-TR')}`);
    let y = 48;

    y = drawTextBlock(doc, 'Baslik', item.title, 20, y, 170);
    y = drawTextBlock(doc, 'Gonderen', `${item.user_name || 'Anonim'} ${item.department ? `(${item.department})` : ''}`, 20, y + 2, 170);
    y = drawTextBlock(doc, 'Atanan Sorumlu', item.assigned_to_name || '-', 20, y + 2, 170);
    y = drawTextBlock(doc, 'Son Durum', statusText(feedbackStatus(item)), 20, y + 2, 170);
    y = drawTextBlock(doc, 'Karar', item.decision || '-', 20, y + 2, 170);
    y = drawTextBlock(doc, 'Karar Notu', item.decision_note || '-', 20, y + 2, 170);
    y = drawTextBlock(doc, 'Calisana Verilecek Cevap', item.public_response || '-', 20, y + 2, 170);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 64, 175);
    doc.text('Durum Gecmisi', 20, y + 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(40, 40, 40);
    let historyY = y + 10;
    thread.history.slice(-8).forEach(history => {
        const text = `${history.created_at ? new Date(history.created_at).toLocaleDateString('tr-TR') : '-'} - ${history.user_name || 'Sistem'}: ${statusLabel(history.old_status)} > ${statusLabel(history.new_status)} ${history.note ? `- ${history.note}` : ''}`;
        const lines = doc.splitTextToSize(cleanPdfText(text), 170);
        doc.text(lines, 20, historyY);
        historyY += lines.length * 4 + 2;
    });

    doc.setFontSize(8);
    doc.setTextColor(130, 130, 130);
    doc.text('Bu belge calisan portali uzerinden dijital olarak uretilmistir.', 20, 280);
    doc.save(`Oneri_Sonuc_Raporu_${item.id}.pdf`);
};

export const formatDateTime = (value?: string | null) => {
    if (!value) return '-';
    return new Date(value).toLocaleString('tr-TR');
};

const csvCell = (value?: string | number | null) => `"${String(value ?? '').replace(/"/g, '""')}"`;

export const feedbackTypeLabel = (value?: string | null) => {
    return value ? typeText(value) : '-';
};

export const downloadFeedbacksExcel = (feedbacks: FeedbackItem[]) => {
    const headers = [
        'Kayıt No', 'Tür', 'Başlık', 'İçerik', 'İlgili Müdürlük', 'Kategori',
        'Mevcut Durum', 'Önerilen Durum', 'Yatırım', 'Öngörülen Tutar',
        'Durum', 'Gönderen', 'Pozisyon', 'Departman', 'Atanan Kişi',
        'Atanan Birim', 'Hedef Tarih', 'Karar', 'Karar Notu',
        'Çalışan Cevabı', 'Oluşturulma Tarihi',
    ];

    const rows = feedbacks.map(item => {
        const details = parseDetails(item);
        return [
            item.id,
            feedbackTypeLabel(item.type),
            item.title,
            item.content,
            details?.department || item.assigned_department || '',
            details?.category || '',
            details?.currentSituation || '',
            details?.proposedSituation || '',
            details?.investment || '',
            details?.estimatedCost || '',
            statusText(feedbackStatus(item)),
            item.user_name || 'Anonim',
            item.position || '',
            item.department || '',
            item.assigned_to_name || '',
            item.assigned_department || '',
            item.due_date ? new Date(item.due_date).toLocaleDateString('tr-TR') : '',
            item.decision || '',
            item.decision_note || '',
            item.public_response || '',
            formatDateTime(item.created_at),
        ];
    });

    const csv = [headers, ...rows].map(row => row.map(csvCell).join(';')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `geri_bildirim_raporu_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
};

