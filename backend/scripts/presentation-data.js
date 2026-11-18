require('dotenv').config();

const setupDb = require('../database');
const { assertNoPendingMigrations } = require('../migrations');

const MANIFEST_KEY = 'presentation_seed_manifest_v1';

const ANNOUNCEMENTS = [
    {
        title: 'İş Sağlığı ve Güvenliği: Güvenli Çalışma Hatırlatması',
        content: 'Çalışma alanlarında kişisel koruyucu donanımların eksiksiz kullanılması, yaya yollarına uyulması ve görülen risklerin gecikmeden bölüm yöneticisine bildirilmesi önemlidir.'
    },
    {
        title: 'Sürekli İyileştirme Önerilerinizi Bekliyoruz',
        content: 'İş güvenliği, kalite, verimlilik ve çalışma ortamını geliştirecek önerilerinizi Öneri ve Şikayet modülünden paylaşabilirsiniz. Gönderdiğiniz kayıtların durumunu aynı ekran üzerinden takip edebilirsiniz.'
    },
    {
        title: 'Aylık Eğitim Takvimi Yayınlandı',
        content: 'Bu ay atanmış eğitimlerinizi Eğitimlerim ekranından kontrol edebilir, tamamlanma tarihlerini ve sınav durumlarını takip edebilirsiniz.'
    }
];

const NEWS = [
    {
        title: 'Dijital Çalışan Portalı Kullanıma Açıldı',
        content: 'Duyurular, eğitimler, belge talepleri, geri bildirimler ve çalışan deneyimi araçları artık tek platformda erişilebilir durumda.',
        image_url: 'https://images.pexels.com/photos/1181675/pexels-photo-1181675.jpeg?auto=compress&cs=tinysrgb&w=1200'
    },
    {
        title: 'Sürekli İyileştirme Çalışmaları Devam Ediyor',
        content: 'Üretim ve destek süreçlerinden gelen öneriler değerlendirilerek güvenlik, kalite ve verimlilik odaklı geliştirme planlarına dönüştürülüyor.',
        image_url: 'https://images.pexels.com/photos/3184360/pexels-photo-3184360.jpeg?auto=compress&cs=tinysrgb&w=1200'
    },
    {
        title: 'Çevre ve Sürdürülebilirlik Farkındalık Haftası',
        content: 'Atıkların kaynağında ayrıştırılması, enerji tasarrufu ve kaynakların verimli kullanımı için hazırlanan farkındalık içerikleri Bilgi Portalı üzerinden erişime açıldı.',
        image_url: 'https://images.pexels.com/photos/1684187/pexels-photo-1684187.jpeg?auto=compress&cs=tinysrgb&w=1200'
    }
];

const KNOWLEDGE_CATEGORIES = [
    {
        name: 'İş Süreçleri',
        items: [
            ['İnsan Kaynakları', 'İzin talebi nasıl oluşturulur?', 'İzin Talebi ekranından izin türü ve tarih aralığı seçilir, gerekli açıklama eklenir ve talep onaya gönderilir. Talebin güncel durumu aynı ekran üzerinden izlenir.'],
            ['Çalışan Deneyimi', 'Öneri veya şikayet süreci nasıl takip edilir?', 'Öneri ve Şikayet ekranından yeni kayıt oluşturabilirsiniz. Gönderdiklerim bölümünde durum değişiklikleri, katılımcı yorumları ve sonuç bilgileri görüntülenir.'],
            ['İnsan Kaynakları', 'Belge talebi nasıl yapılır?', 'Belgeler ekranında ihtiyaç duyulan belge türü seçilir ve kullanım amacı belirtilir. Hazırlanan belge aynı talep kaydı üzerinden indirilebilir.']
        ]
    },
    {
        name: 'Şirket Politikaları',
        items: [
            ['Bilgi Güvenliği', 'Kurumsal hesap güvenliği için temel kurallar nelerdir?', 'Parolanızı başka kişilerle paylaşmayın, ortak cihazlarda oturumu açık bırakmayın ve şüpheli bağlantıları Bilgi İşlem birimine bildirin. Yetkiniz dışındaki kurumsal verileri indirmeyin veya paylaşmayın.'],
            ['İş Sağlığı ve Güvenliği', 'Riskli bir durum fark edildiğinde ne yapılmalıdır?', 'Çalışmayı güvenli biçimde durdurun, çevredeki kişileri uyarın ve durumu gecikmeden amirinize veya İSG birimine bildirin. Acil durum prosedürlerindeki yönlendirmeleri uygulayın.'],
            ['Kişisel Veriler', 'Çalışan verileri nasıl korunmalıdır?', 'Kişisel veriler yalnız iş amacıyla ve yetki kapsamında kullanılmalıdır. Belgeler açıkta bırakılmamalı, yetkisiz kişilere aktarılmamalı ve saklama kurallarına uyulmalıdır.']
        ]
    },
    {
        name: 'Kalite ve Sürekli İyileştirme',
        items: [
            ['Kalite', 'Uygunsuzluk fark edildiğinde nasıl hareket edilir?', 'Ürünü veya süreci tanımlı yönteme göre güvenli alana ayırın, gerekli kaydı oluşturun ve sorumlu kişiye bilgi verin. Onay alınmadan sürece geri kazandırmayın.'],
            ['5S', '5S uygulamasının temel amacı nedir?', 'Gereksiz malzemeleri ayırmak, çalışma alanını düzenlemek, temizliği sürdürmek, standart oluşturmak ve bu standardı disiplinli biçimde korumaktır.'],
            ['Öneri Sistemi', 'İyileştirme önerisi hazırlarken nelere dikkat edilmelidir?', 'Mevcut durumu, önerilen çözümü, beklenen faydayı ve varsa güvenlik veya maliyet etkisini açık ve ölçülebilir biçimde belirtin.']
        ]
    }
];

const SURVEYS = [
    {
        title: 'Çalışan Deneyimi Kısa Anketi',
        description: 'İletişim, çalışma ortamı ve portal deneyimi hakkındaki görüşlerinizi paylaşın.',
        questions: [
            ['Çalışma ortamınızı genel olarak nasıl değerlendirirsiniz?', 'rating', [], true],
            ['Kurum içi bilgilendirmeleri yeterli buluyor musunuz?', 'single_choice', ['Evet', 'Kısmen', 'Hayır'], true],
            ['En sık kullandığınız portal modülleri hangileri?', 'multiple_choice', ['Duyurular', 'Eğitimler', 'Belgeler', 'Bilgi Portalı', 'Öneri ve Şikayet'], false],
            ['Çalışan deneyimini geliştirmek için öneriniz var mı?', 'text', [], false]
        ]
    },
    {
        title: 'Yemekhane ve Sosyal Alanlar Anketi',
        description: 'Yemekhane hizmetleri ve ortak kullanım alanlarıyla ilgili kısa değerlendirme.',
        questions: [
            ['Yemek çeşitliliğini nasıl değerlendirirsiniz?', 'rating', [], true],
            ['Yemekhane hizmetinde öncelikli gelişim alanı hangisidir?', 'single_choice', ['Menü çeşitliliği', 'Servis hızı', 'Temizlik', 'Porsiyon', 'Oturma düzeni'], true],
            ['Eklemek istediğiniz görüşünüz nedir?', 'text', [], false]
        ]
    }
];

const MENUS = [
    ['Mercimek Çorbası', 'Etli Nohut', 'Pirinç Pilavı', 'Cacık', 'Mevsim Salata'],
    ['Ezogelin Çorbası', 'Tavuk Sote', 'Bulgur Pilavı', 'Ayran', 'Meyve'],
    ['Yayla Çorbası', 'İzmir Köfte', 'Makarna', 'Yoğurt', 'Karışık Salata'],
    ['Domates Çorbası', 'Fırın Tavuk', 'Pirinç Pilavı', 'Şekerpare', 'Mevsim Salata'],
    ['Tarhana Çorbası', 'Kuru Fasulye', 'Bulgur Pilavı', 'Turşu', 'Ayran'],
    ['Sebze Çorbası', 'Tas Kebabı', 'Pirinç Pilavı', 'Yoğurt', 'Karışık Salata'],
    ['Düğün Çorbası', 'Tavuk Döner', 'Bulgur Pilavı', 'Ayran', 'Meyve'],
    ['Mercimek Çorbası', 'Patlıcan Musakka', 'Pirinç Pilavı', 'Cacık', 'Mevsim Salata'],
    ['Yayla Çorbası', 'Köri Soslu Tavuk', 'Makarna', 'Yoğurt', 'Karışık Salata'],
    ['Domates Çorbası', 'Etli Bezelye', 'Bulgur Pilavı', 'Ayran', 'Meyve']
];

const turkeyIsoDate = (date) => {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
};

const addDays = (isoDate, amount) => {
    const date = new Date(`${isoDate}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + amount);
    return date.toISOString().slice(0, 10);
};

const presentationMealDates = (now, excludedDates = new Set()) => {
    const dates = [];
    let offset = 0;
    const start = turkeyIsoDate(now);
    while (dates.length < MENUS.length) {
        const candidate = addDays(start, offset);
        if (
            new Date(`${candidate}T12:00:00Z`).getUTCDay() !== 0
            && !excludedDates.has(candidate)
        ) dates.push(candidate);
        offset += 1;
    }
    return dates;
};

const parseManifest = (row) => {
    if (!row?.value) return null;
    try {
        const manifest = JSON.parse(row.value);
        return manifest && typeof manifest === 'object' ? manifest : null;
    } catch {
        throw new Error('PRESENTATION_MANIFEST_INVALID');
    }
};

async function seedPresentationData(db, now = new Date()) {
    const current = parseManifest(await db.get(
        'SELECT value FROM app_settings WHERE setting_key = ?', [MANIFEST_KEY]
    ));
    if (current) return { status: 'already_seeded', manifest: current };

    return db.transaction(async (tx) => {
        const admin = await tx.get("SELECT id FROM users WHERE role = 'admin' ORDER BY id ASC");
        if (!admin) throw new Error('PRESENTATION_ADMIN_REQUIRED');

        const manifest = {
            version: 1,
            created_at: new Date().toISOString(),
            announcements: [], news: [], knowledge_categories: [], knowledge_items: [],
            surveys: [], survey_questions: [], meal_menus: [], meal_dates: []
        };
        const visibleUntil = addDays(turkeyIsoDate(now), 60);

        for (const item of ANNOUNCEMENTS) {
            const result = await tx.run(`
                INSERT INTO announcements (title, content, target_department, visible_until, created_by)
                VALUES (?, ?, ?, ?, ?)
            `, [item.title, item.content, null, visibleUntil, admin.id]);
            manifest.announcements.push(result.lastID);
        }

        for (const item of NEWS) {
            const result = await tx.run(`
                INSERT INTO company_news (title, content, image_url, created_by)
                VALUES (?, ?, ?, ?)
            `, [item.title, item.content, item.image_url, admin.id]);
            manifest.news.push(result.lastID);
        }

        for (const [categoryIndex, category] of KNOWLEDGE_CATEGORIES.entries()) {
            const existingCategory = await tx.get(
                'SELECT id FROM knowledge_categories WHERE name = ?',
                [category.name]
            );
            let categoryId = existingCategory?.id;
            if (!categoryId) {
                const categoryResult = await tx.run(
                    'INSERT INTO knowledge_categories (name, order_index) VALUES (?, ?)',
                    [category.name, categoryIndex + 1]
                );
                categoryId = categoryResult.lastID;
                manifest.knowledge_categories.push(categoryId);
            }
            for (const [itemIndex, item] of category.items.entries()) {
                const itemResult = await tx.run(`
                    INSERT INTO knowledge_items (
                        category_id, sub_category, question, answer, is_featured, order_index
                    ) VALUES (?, ?, ?, ?, ?, ?)
                `, [categoryId, item[0], item[1], item[2], itemIndex === 0 ? 1 : 0, itemIndex + 1]);
                manifest.knowledge_items.push(itemResult.lastID);
            }
        }

        for (const survey of SURVEYS) {
            const surveyResult = await tx.run(`
                INSERT INTO surveys (title, description, status, created_by)
                VALUES (?, ?, ?, ?)
            `, [survey.title, survey.description, 'active', admin.id]);
            manifest.surveys.push(surveyResult.lastID);
            for (const [questionIndex, question] of survey.questions.entries()) {
                const questionResult = await tx.run(`
                    INSERT INTO survey_questions (
                        survey_id, question_text, question_type, options, is_required, order_index
                    ) VALUES (?, ?, ?, ?, ?, ?)
                `, [surveyResult.lastID, question[0], question[1], JSON.stringify(question[2]), question[3] ? 1 : 0, questionIndex]);
                manifest.survey_questions.push(questionResult.lastID);
            }
        }

        const startDate = turkeyIsoDate(now);
        const existingMeals = await tx.all(
            'SELECT meal_date FROM meal_menus WHERE meal_date >= ?',
            [startDate]
        );
        const dates = presentationMealDates(
            now,
            new Set(existingMeals.map(item => String(item.meal_date).slice(0, 10)))
        );
        for (const [index, mealDate] of dates.entries()) {
            const menuResult = await tx.run(`
                INSERT INTO meal_menus (meal_date, items, source_file, created_by)
                VALUES (?, ?, ?, ?)
            `, [mealDate, JSON.stringify(MENUS[index]), 'presentation-demo-v1', admin.id]);
            manifest.meal_menus.push(menuResult.lastID);
            manifest.meal_dates.push(mealDate);
        }

        await tx.run(
            'INSERT INTO app_settings (setting_key, value) VALUES (?, ?)',
            [MANIFEST_KEY, JSON.stringify(manifest)]
        );
        return { status: 'seeded', manifest };
    });
}

async function cleanupPresentationData(db) {
    const manifest = parseManifest(await db.get(
        'SELECT value FROM app_settings WHERE setting_key = ?', [MANIFEST_KEY]
    ));
    if (!manifest) return { status: 'not_seeded' };

    await db.transaction(async (tx) => {
        for (const surveyId of manifest.surveys || []) {
            await tx.run(`
                DELETE FROM survey_answers WHERE response_id IN (
                    SELECT id FROM survey_responses WHERE survey_id = ?
                )
            `, [surveyId]);
            await tx.run('DELETE FROM survey_responses WHERE survey_id = ?', [surveyId]);
            await tx.run('DELETE FROM survey_questions WHERE survey_id = ?', [surveyId]);
            await tx.run('DELETE FROM surveys WHERE id = ?', [surveyId]);
        }
        for (const mealDate of manifest.meal_dates || []) {
            await tx.run('DELETE FROM meal_menu_ratings WHERE meal_date = ?', [mealDate]);
        }
        for (const id of manifest.meal_menus || []) await tx.run('DELETE FROM meal_menus WHERE id = ?', [id]);
        for (const id of manifest.knowledge_items || []) await tx.run('DELETE FROM knowledge_items WHERE id = ?', [id]);
        for (const id of manifest.knowledge_categories || []) await tx.run('DELETE FROM knowledge_categories WHERE id = ?', [id]);
        for (const id of manifest.announcements || []) await tx.run('DELETE FROM announcements WHERE id = ?', [id]);
        for (const id of manifest.news || []) await tx.run('DELETE FROM company_news WHERE id = ?', [id]);
        await tx.run('DELETE FROM app_settings WHERE setting_key = ?', [MANIFEST_KEY]);
    });
    return { status: 'cleaned' };
}

async function main() {
    if (process.env.ALLOW_PRESENTATION_DATA !== 'true') {
        throw new Error('ALLOW_PRESENTATION_DATA_REQUIRED');
    }
    const operation = process.argv[2];
    if (!['seed', 'clean'].includes(operation)) throw new Error('PRESENTATION_OPERATION_INVALID');

    const { validateEnvironment } = require('../config/environment');
    validateEnvironment();
    const db = await setupDb();
    try {
        await assertNoPendingMigrations(db);
        const result = operation === 'seed'
            ? await seedPresentationData(db)
            : await cleanupPresentationData(db);
        const counts = result.manifest
            ? Object.fromEntries(
                Object.entries(result.manifest)
                    .filter(([, value]) => Array.isArray(value))
                    .map(([key, value]) => [key, value.length])
            )
            : undefined;
        console.log(JSON.stringify({ operation, status: result.status, counts }));
    } finally {
        await db.close();
    }
}

if (require.main === module) {
    main().catch(error => {
        console.error('Presentation data operation failed:', error.message);
        process.exit(1);
    });
}

module.exports = {
    MANIFEST_KEY,
    seedPresentationData,
    cleanupPresentationData,
    presentationMealDates
};
