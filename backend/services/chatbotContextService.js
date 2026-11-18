const MAX_ITEMS = 12;

const safeJson = (value) => {
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value || '');
    }
};

const limitText = (value, max = 900) => {
    const text = String(value || '').trim();
    return text.length > max ? `${text.slice(0, max)}...` : text;
};

const mapRows = (rows, mapper) => (Array.isArray(rows) ? rows.slice(0, MAX_ITEMS).map(mapper) : []);

async function buildChatbotContext(db, user) {
    const [
        profile,
        trainings,
        documents,
        leaveRequests,
        feedbacks,
        announcements,
        news,
        knowledgeItems,
        directory
    ] = await Promise.all([
        db.get(`
            SELECT u.employee_id, u.name, u.department, u.position, u.role,
                   p.phone, p.address, p.emergency_contact_name, p.emergency_contact_phone,
                   p.blood_type, p.birth_date, p.email, p.clothing_top, p.clothing_bottom,
                   p.shoe_size, p.education, p.hobbies, p.skills
            FROM users u
            LEFT JOIN personal_info p ON u.id = p.user_id
            WHERE u.id = ?
        `, [user.id]),
        db.all(`
            SELECT v.title, v.category, v.trainer_name, v.duration, v.validity_period,
                   a.status, a.quiz_score, a.due_date, a.assigned_at, a.completed_at, a.reference_id, a.confirmed_at
            FROM assignments a
            JOIN videos v ON a.video_id = v.id
            WHERE a.user_id = ?
            ORDER BY a.id DESC
        `, [user.id]),
        db.all(`
            SELECT title, upload_date
            FROM documents
            WHERE user_id = ?
            ORDER BY upload_date DESC
        `, [user.id]),
        db.all(`
            SELECT leave_type, start_datetime, end_datetime, return_datetime,
                   duration_type, duration_value, description, status, created_at
            FROM leave_requests
            WHERE user_id = ?
            ORDER BY created_at DESC
        `, [user.id]),
        db.all(`
            SELECT type, title, content, status, created_at, assigned_department,
                   due_date, decision, public_response, updated_at
            FROM feedback
            WHERE user_id = ?
            ORDER BY created_at DESC
        `, [user.id]),
        db.all(`
            SELECT title, content, created_at
            FROM announcements
            ORDER BY created_at DESC
        `),
        db.all(`
            SELECT title, content, created_at
            FROM company_news
            ORDER BY created_at DESC
        `),
        db.all(`
            SELECT c.name as category, i.sub_category, i.question, i.answer, i.is_featured
            FROM knowledge_items i
            JOIN knowledge_categories c ON i.category_id = c.id
            ORDER BY c.order_index ASC, i.order_index ASC
        `),
        db.all(`
            SELECT name, department, position
            FROM users
            WHERE status IS NULL OR status = 'active'
            ORDER BY name ASC
        `)
    ]);

    return {
        userProfile: profile || user,
        trainings: mapRows(trainings, row => ({
            title: row.title,
            category: row.category,
            trainer: row.trainer_name,
            duration: row.duration,
            validity_period: row.validity_period,
            status: row.status,
            quiz_score: row.quiz_score,
            due_date: row.due_date,
            assigned_at: row.assigned_at,
            completed_at: row.completed_at,
            certificate_reference: row.reference_id,
            confirmed_at: row.confirmed_at
        })),
        documents: mapRows(documents, row => ({
            title: row.title,
            upload_date: row.upload_date
        })),
        leaveRequests: mapRows(leaveRequests, row => ({
            leave_type: row.leave_type,
            start_datetime: row.start_datetime,
            end_datetime: row.end_datetime,
            return_datetime: row.return_datetime,
            duration: `${row.duration_value || ''} ${row.duration_type || ''}`.trim(),
            description: limitText(row.description, 240),
            status: row.status,
            created_at: row.created_at
        })),
        feedbacks: mapRows(feedbacks, row => ({
            type: row.type,
            title: row.title,
            content: limitText(row.content, 360),
            status: row.status,
            created_at: row.created_at,
            assigned_department: row.assigned_department,
            due_date: row.due_date,
            decision: row.decision,
            public_response: limitText(row.public_response, 360),
            updated_at: row.updated_at
        })),
        announcements: mapRows(announcements, row => ({
            title: row.title,
            content: limitText(row.content, 420),
            created_at: row.created_at
        })),
        companyNews: mapRows(news, row => ({
            title: row.title,
            content: limitText(row.content, 360),
            created_at: row.created_at
        })),
        knowledgeBase: mapRows(knowledgeItems, row => ({
            category: row.category,
            sub_category: row.sub_category,
            question: row.question,
            answer: limitText(row.answer, 520),
            is_featured: row.is_featured
        })),
        directory: mapRows(directory, row => ({
            name: row.name,
            department: row.department,
            position: row.position
        }))
    };
}

function buildChatbotPrompt(message, context) {
    return `
Sen IKBenimle calisan portalinin Turkce chatbot asistani olarak cevap veriyorsun.
Kullanici sadece kendi portal verileri ve sirket ici genel bilgiler hakkinda soru sorabilir.

Kurallar:
- Cevap Turkce, kisa, net ve yardimci olsun.
- Sadece verilen baglami kullan. Emin degilsen "Bu bilgi portalda gorunmuyor" de.
- Baska calisanlarin ozel verilerini, bordro/belge detaylarini veya gizli yonetici notlarini paylasma.
- Belgelerin icerigini bildigini iddia etme; sadece baslik/tarih bilgisini kullan.
- Hassas veya resmi karar gerektiren konularda IK ya da yoneticiye yonlendir.
- Konusma gecmisi kaydedilmiyor; cevabinda bunu belirtme.

Portal baglami:
${safeJson(context)}

Kullanici sorusu:
${message}
`;
}

module.exports = {
    buildChatbotContext,
    buildChatbotPrompt
};
