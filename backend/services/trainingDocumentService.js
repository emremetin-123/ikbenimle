const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

const normalizeText = (value) => {
    if (value === undefined || value === null) return '-';
    return String(value)
        .replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
        .replace(/ü/g, 'u').replace(/Ü/g, 'U')
        .replace(/ş/g, 's').replace(/Ş/g, 'S')
        .replace(/ı/g, 'i').replace(/İ/g, 'I')
        .replace(/ö/g, 'o').replace(/Ö/g, 'O')
        .replace(/ç/g, 'c').replace(/Ç/g, 'C');
};

const formatDate = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('tr-TR');
};

const formatDateTime = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('tr-TR');
};

const statusLabels = {
    assigned: 'Atandi',
    pending: 'Bekliyor',
    in_progress: 'Devam ediyor',
    watched: 'Izlendi',
    completed: 'Tamamlandi',
    failed: 'Basarisiz',
    expired: 'Suresi doldu'
};

const eventLabels = {
    course_opened: 'Egitim acildi',
    lesson_progress: 'Icerik ilerlemesi kaydedildi',
    lesson_watched: 'Icerik tamamlandi',
    quiz_started: 'Sinav baslatildi',
    quiz_submitted: 'Sinav gonderildi',
    certificate_confirmed: 'Calisan onayi alindi'
};

const getStatusLabel = (value) => statusLabels[value] || normalizeText(value);
const getEventLabel = (value) => eventLabels[value] || normalizeText(value);

const toBuffer = (draw) => new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 42, bufferPages: true });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    draw(doc);
    doc.end();
});

const toReportBuffer = (title, draw) => new Promise((resolve, reject) => {
    const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 105, right: 42, bottom: 70, left: 42 },
        bufferPages: true
    });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.x = 0;
    doc.y = 0;
    drawReportHeader(doc, title);
    doc.x = 42;
    doc.y = 105;
    draw(doc);
    doc.end();
});

const drawFrame = (doc, title) => {
    doc.rect(24, 24, 547, 794).lineWidth(2).strokeColor('#0f2f5f').stroke();
    doc.rect(30, 30, 535, 782).lineWidth(0.8).strokeColor('#d4af37').stroke();
    doc.fillColor('#0f2f5f').fontSize(18).font('Helvetica-Bold').text(normalizeText(title), 42, 46, { align: 'center' });
    doc.moveTo(42, 82).lineTo(553, 82).lineWidth(0.8).strokeColor('#d4af37').stroke();
};

const drawReportHeader = (doc, title) => {
    const normalizedTitle = normalizeText(title);
    doc.save();
    doc.roundedRect(30, 28, 535, 62, 5).fillAndStroke('#f8fafc', '#cbd5e1');
    doc.fillColor('#0f2f5f').fontSize(18).font('Helvetica-Bold');
    const titleWidth = doc.widthOfString(normalizedTitle);
    doc.text(normalizedTitle, (doc.page.width - titleWidth) / 2, 49, { lineBreak: false });
    doc.moveTo(48, 83).lineTo(547, 83).lineWidth(0.8).strokeColor('#d4af37').stroke();
    doc.restore();
};

const labelValue = (doc, label, value, x, y, width = 230) => {
    doc.fillColor('#64748b').fontSize(8).font('Helvetica-Bold').text(normalizeText(label).toUpperCase(), x, y);
    doc.fillColor('#111827').fontSize(11).font('Helvetica').text(normalizeText(value), x, y + 12, { width });
};

const drawSignatureArea = (doc, y, trainerName, trainerTitle) => {
    doc.moveTo(360, y).lineTo(530, y).lineWidth(0.8).strokeColor('#94a3b8').stroke();
    doc.fillColor('#111827').fontSize(10).font('Helvetica-Bold').text(normalizeText(trainerName || 'Yetkili'), 360, y + 10, { width: 170, align: 'center' });
    doc.fillColor('#64748b').fontSize(8).font('Helvetica').text(normalizeText(trainerTitle || 'Imza / Onay'), 360, y + 24, { width: 170, align: 'center' });
};

async function generateCertificatePdf({ assignment, lessons = [], verifyUrl }) {
    const qrDataUrl = assignment.reference_id
        ? await QRCode.toDataURL(verifyUrl || assignment.reference_id, { margin: 1, width: 120 })
        : null;
    const qrBuffer = qrDataUrl ? Buffer.from(qrDataUrl.split(',')[1], 'base64') : null;

    return toBuffer((doc) => {
        drawFrame(doc, 'EGITIM TAMAMLAMA SERTIFIKASI');
        doc.fillColor('#d4af37').fontSize(14).font('Helvetica-Bold').text('IKBenimle Akademi', 42, 102, { align: 'center' });
        doc.fillColor('#334155').fontSize(11).font('Helvetica').text(
            'Bu belge, asagida bilgileri yer alan calisanin ilgili egitimi basariyla tamamladigini belgelemek amaciyla duzenlenmistir.',
            82, 130,
            { width: 430, align: 'center', lineGap: 3 }
        );

        const y = 190;
        labelValue(doc, 'Calisan', assignment.name, 72, y);
        labelValue(doc, 'Sicil No', assignment.employee_id, 330, y);
        labelValue(doc, 'Departman', assignment.department, 72, y + 54);
        labelValue(doc, 'Pozisyon', assignment.position, 330, y + 54);
        labelValue(doc, 'Egitim', assignment.title, 72, y + 108, 460);
        labelValue(doc, 'Kategori', assignment.category, 72, y + 162);
        labelValue(doc, 'Egitmen', assignment.trainer_name, 330, y + 162);
        labelValue(doc, 'Versiyon', assignment.version_no ? `v${assignment.version_no}` : '-', 72, y + 216);
        labelValue(doc, 'Puan', assignment.quiz_score !== null && assignment.quiz_score !== undefined ? `%${assignment.quiz_score}` : '-', 200, y + 216);
        labelValue(doc, 'Tamamlama Tarihi', formatDate(assignment.completed_at), 330, y + 216);

        doc.roundedRect(72, 470, 460, 74, 8).lineWidth(0.8).strokeColor('#cbd5e1').stroke();
        doc.fillColor('#0f2f5f').fontSize(10).font('Helvetica-Bold').text('Tamamlanan Icerik Ozeti', 90, 488);
        const lessonSummary = lessons.length
            ? lessons.map((lesson, index) => `${index + 1}. ${lesson.module_title ? `${normalizeText(lesson.module_title)}: ` : ''}${normalizeText(lesson.title)} (${normalizeText(lesson.status || 'kayit')})`).join(' | ')
            : 'Ders kaydi bulunamadi';
        doc.fillColor('#334155').fontSize(8).font('Helvetica').text(lessonSummary, 90, 506, { width: 420, lineGap: 2 });

        if (qrBuffer) {
            doc.image(qrBuffer, 78, 590, { width: 86, height: 86 });
            doc.fillColor('#64748b').fontSize(7).font('Helvetica').text('QR ile belge dogrulama', 62, 682, { width: 120, align: 'center' });
        }
        labelValue(doc, 'Belge Referans No', assignment.reference_id || '-', 190, 602, 220);
        labelValue(doc, 'Olusturma Tarihi', formatDateTime(new Date()), 190, 656, 220);
        drawSignatureArea(doc, 680, assignment.trainer_name, assignment.trainer_title);
    });
}

async function generateParticipationPdf({ assignment, lessons = [], logs = [] }) {
    return toBuffer((doc) => {
        drawFrame(doc, 'EGITIM KATILIM VE AKTIVITE RAPORU');
        labelValue(doc, 'Calisan', assignment.name, 58, 110);
        labelValue(doc, 'Egitim', assignment.title, 300, 110);
        labelValue(doc, 'Atama Tarihi', formatDateTime(assignment.assigned_at), 58, 164);
        labelValue(doc, 'Ilk Erisim', formatDateTime(assignment.first_accessed_at), 300, 164);
        labelValue(doc, 'Tamamlama', formatDateTime(assignment.completed_at), 58, 218);
        labelValue(doc, 'Durum', assignment.status, 300, 218);

        doc.fillColor('#0f2f5f').fontSize(12).font('Helvetica-Bold').text('Ders Bazli Kayitlar', 58, 290);
        let y = 318;
        lessons.forEach((lesson, index) => {
            if (y > 735) {
                doc.addPage();
                drawFrame(doc, 'EGITIM KATILIM VE AKTIVITE RAPORU');
                y = 105;
            }
            doc.roundedRect(58, y, 480, 48, 5).lineWidth(0.5).strokeColor('#cbd5e1').stroke();
            doc.fillColor('#111827').fontSize(9).font('Helvetica-Bold').text(`${index + 1}. ${normalizeText(lesson.title)}`, 70, y + 9, { width: 270 });
            doc.fillColor('#475569').fontSize(8).font('Helvetica').text(`Durum: ${normalizeText(lesson.status || '-')}`, 350, y + 9);
            doc.text(`Izlenen/Aktif sure: ${Number(lesson.watched_seconds || lesson.active_seconds || 0)} sn`, 70, y + 27);
            doc.text(`Ilerleme: %${Number(lesson.content_progress_percent || lesson.max_position || 0)}`, 350, y + 27);
            y += 60;
        });

        doc.fillColor('#64748b').fontSize(8).font('Helvetica').text(`Toplam log kaydi: ${logs.length}`, 58, 765);
    });
}

async function generateExamPdf({ assignment, attempts = [] }) {
    return toBuffer((doc) => {
        drawFrame(doc, 'EGITIM SINAV SONUC RAPORU');
        labelValue(doc, 'Calisan', assignment.name, 58, 110);
        labelValue(doc, 'Egitim', assignment.title, 300, 110);
        labelValue(doc, 'Baraj', assignment.pass_score !== null && assignment.pass_score !== undefined ? `%${assignment.pass_score}` : '-', 58, 164);
        labelValue(doc, 'Son Puan', assignment.quiz_score !== null && assignment.quiz_score !== undefined ? `%${assignment.quiz_score}` : '-', 300, 164);

        doc.fillColor('#0f2f5f').fontSize(12).font('Helvetica-Bold').text('Deneme Kayitlari', 58, 235);
        let y = 265;
        if (!attempts.length) {
            doc.fillColor('#64748b').fontSize(10).font('Helvetica').text('Bu egitim icin sinav denemesi bulunmuyor.', 58, y);
            return;
        }
        attempts.forEach((attempt, index) => {
            if (y > 735) {
                doc.addPage();
                drawFrame(doc, 'EGITIM SINAV SONUC RAPORU');
                y = 105;
            }
            doc.roundedRect(58, y, 480, 46, 5).lineWidth(0.5).strokeColor('#cbd5e1').stroke();
            doc.fillColor('#111827').fontSize(9).font('Helvetica-Bold').text(`${index + 1}. Deneme`, 70, y + 10);
            doc.fillColor('#475569').fontSize(8).font('Helvetica').text(`Puan: %${attempt.score}`, 180, y + 10);
            doc.text(`Sonuc: ${attempt.passed ? 'Gecti' : 'Kaldi'}`, 285, y + 10);
            doc.text(`Tarih: ${formatDateTime(attempt.created_at)}`, 385, y + 10, { width: 135 });
            y += 58;
        });
    });
}

const ensureReportSpace = (doc, y, requiredHeight, title) => {
    if (y + requiredHeight <= 650) return y;
    doc.addPage();
    doc.x = 0;
    doc.y = 0;
    drawReportHeader(doc, title);
    doc.x = 42;
    doc.y = 105;
    return 105;
};

const drawReportSection = (doc, title, y) => {
    doc.fillColor('#0f2f5f').fontSize(12).font('Helvetica-Bold').text(normalizeText(title), 58, y);
    return y + 28;
};

async function generateEvidencePdf({ assignment, lessons = [], attempts = [], logs = [], files = [] }) {
    const reportTitle = 'EGITIM KANIT RAPORU';
    return toReportBuffer(reportTitle, (doc) => {
        labelValue(doc, 'Calisan', assignment.name, 58, 110);
        labelValue(doc, 'Sicil No', assignment.employee_id, 300, 110);
        labelValue(doc, 'Departman', assignment.department, 58, 164);
        labelValue(doc, 'Pozisyon', assignment.position, 300, 164);
        labelValue(doc, 'Egitim', assignment.title, 58, 218, 235);
        labelValue(doc, 'Versiyon', assignment.version_no ? `v${assignment.version_no}` : '-', 300, 218);
        labelValue(doc, 'Atama Tarihi', formatDateTime(assignment.assigned_at), 58, 272);
        labelValue(doc, 'Ilk Erisim', formatDateTime(assignment.first_accessed_at), 300, 272);
        labelValue(doc, 'Tamamlama', formatDateTime(assignment.completed_at), 58, 326);
        labelValue(doc, 'Durum', getStatusLabel(assignment.status), 300, 326);
        labelValue(doc, 'Son Puan', assignment.quiz_score !== null && assignment.quiz_score !== undefined ? `%${assignment.quiz_score}` : 'Sinav uygulanmadi', 58, 380);
        labelValue(doc, 'Basari Baraji', attempts.length ? `%${assignment.pass_score ?? 0}` : '-', 300, 380);
        labelValue(doc, 'Sertifika Referansi', assignment.reference_id || '-', 58, 434, 235);
        labelValue(doc, 'Calisan Onayi', formatDateTime(assignment.confirmed_at), 300, 434);

        let y = drawReportSection(doc, 'Icerik Bazli Katilim Kayitlari', 500);
        if (!lessons.length) {
            doc.fillColor('#64748b').fontSize(9).font('Helvetica').text('Bu atamaya ait icerik kaydi bulunmuyor.', 58, y);
            y += 28;
        }
        lessons.forEach((lesson, index) => {
            y = ensureReportSpace(doc, y, 58, reportTitle);
            doc.roundedRect(58, y, 480, 48, 5).lineWidth(0.5).strokeColor('#cbd5e1').stroke();
            const modulePrefix = lesson.module_title ? `${lesson.module_title} / ` : '';
            doc.fillColor('#111827').fontSize(9).font('Helvetica-Bold').text(
                `${index + 1}. ${normalizeText(modulePrefix)}${normalizeText(lesson.title)}`,
                70, y + 8, { width: 300 }
            );
            doc.fillColor('#475569').fontSize(8).font('Helvetica').text(
                `Durum: ${getStatusLabel(lesson.status || 'Baslamadi')}`,
                390, y + 8, { width: 130, align: 'right' }
            );
            const activitySeconds = Number(lesson.watched_seconds || lesson.active_seconds || 0);
            const progress = Number(lesson.content_progress_percent || 0);
            doc.text(`Aktif/izlenen sure: ${activitySeconds} sn`, 70, y + 27);
            doc.text(`Ilerleme: %${progress} | Tamamlama: ${formatDateTime(lesson.completed_at)}`, 265, y + 27, { width: 255, align: 'right' });
            y += 60;
        });

        y = ensureReportSpace(doc, y + 8, 85, reportTitle);
        y = drawReportSection(doc, 'Sinav Sonuclari', y);
        if (!attempts.length) {
            doc.fillColor('#64748b').fontSize(9).font('Helvetica').text('Bu egitimde sinav uygulanmamistir veya sinav denemesi bulunmuyor.', 58, y);
            y += 30;
        } else {
            attempts.forEach((attempt, index) => {
                y = ensureReportSpace(doc, y, 42, reportTitle);
                doc.roundedRect(58, y, 480, 34, 5).lineWidth(0.5).strokeColor('#cbd5e1').stroke();
                doc.fillColor('#111827').fontSize(8).font('Helvetica-Bold').text(`${index + 1}. Deneme`, 70, y + 11);
                doc.fillColor('#475569').font('Helvetica').text(`Puan: %${attempt.score}`, 175, y + 11);
                doc.text(`Sonuc: ${attempt.passed ? 'Gecti' : 'Kaldi'}`, 275, y + 11);
                doc.text(formatDateTime(attempt.created_at), 380, y + 11, { width: 140, align: 'right' });
                y += 44;
            });
        }

        y = ensureReportSpace(doc, y + 8, 85, reportTitle);
        y = drawReportSection(doc, 'Aktivite Zaman Cizelgesi', y);
        if (!logs.length) {
            doc.fillColor('#64748b').fontSize(9).font('Helvetica').text('Aktivite kaydi bulunmuyor.', 58, y);
            y += 28;
        } else {
            logs.forEach((log, index) => {
                y = ensureReportSpace(doc, y, 28, reportTitle);
                doc.fillColor('#334155').fontSize(8).font('Helvetica').text(
                    `${index + 1}. ${formatDateTime(log.created_at)} - ${getEventLabel(log.event_type)}`,
                    58, y, { width: 480 }
                );
                y += 22;
            });
        }

        y = ensureReportSpace(doc, y + 8, 75, reportTitle);
        y = drawReportSection(doc, 'Ek Kanit Dosyalari', y);
        if (!files.length) {
            doc.fillColor('#64748b').fontSize(9).font('Helvetica').text('Ek kanit dosyasi bulunmuyor.', 58, y);
        } else {
            files.forEach((file, index) => {
                y = ensureReportSpace(doc, y, 26, reportTitle);
                const fileName = file.original_name || file.file_name || file.document_type || `Kanit dosyasi ${index + 1}`;
                doc.fillColor('#334155').fontSize(8).font('Helvetica').text(
                    `${index + 1}. ${normalizeText(fileName)} - ${formatDateTime(file.created_at)}`,
                    58, y, { width: 480 }
                );
                y += 20;
            });
        }

        doc.fillColor('#64748b').fontSize(7).font('Helvetica').text(
            `Rapor olusturma tarihi: ${formatDateTime(new Date())}`,
            58, 750, { width: 480, align: 'right', lineBreak: false }
        );
    });
}

module.exports = {
    generateCertificatePdf,
    generateEvidencePdf,
    generateParticipationPdf,
    generateExamPdf,
    normalizeText
};
