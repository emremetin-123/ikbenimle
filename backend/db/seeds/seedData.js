// Explicit development seed helpers. Never run during connection setup.
async function seedHRInfo(db) {
    try {
        // Duyurular tablosunu kontrol et
        const annCount = await db.get('SELECT COUNT(*) as cnt FROM announcements');
        if (annCount && annCount.cnt === 0) {
            const hrAnnouncements = [
                { title: 'Yıllık İzin Süreçleri ve Hak Edişler', content: 'Şirketimizde 1-5 yıl arası çalışanlarımız 14 iş günü, 5-15 yıl arası çalışanlarımız 20 iş günü, 15 yıl ve üzeri çalışanlarımız ise 26 iş günü yıllık izin hakkına sahiptir. İzin taleplerinizi portal üzerinden en az 1 hafta önceden iletmeniz gerekmektedir.' },
                { title: 'Esnek Çalışma Saatleri Uygulaması', content: 'Çalışma saatlerimiz 08:30 - 17:30 olmakla birlikte, çalışanlarımız yöneticilerinin onayı dahilinde 07:30 - 09:30 saatleri arasında esnek giriş yapabilirler. Günlük 9 saatlik çalışma süresinin tamamlanması esastır.' },
                { title: 'Özel Sağlık Sigortası (ÖSS) Kapsamı ve Avantajları', content: 'Tüm tam zamanlı çalışanlarımız, deneme sürelerinin dolmasının ardından kapsamlı Özel Sağlık Sigortası (yatarak ve ayakta tedavi) paketine dahil edilmektedir. Anlaşmalı hastaneler listesine portalın Belgeler sekmesinden ulaşabilirsiniz.' },
                { title: 'Doğum, Babalık ve Mazeret İzinleri', content: 'Kadın çalışanlarımız yasal olarak 16 hafta ücretli doğum iznine, erkek çalışanlarımız ise 5 gün ücretli babalık iznine sahiptir. Ayrıca evlilik ve birinci derece yakınların vefatı durumlarında 3 gün ücretli mazeret izni kullandırılmaktadır.' },
                { title: 'Performans Değerlendirme ve Kariyer Yönetimi', content: 'Yıllık performans değerlendirmelerimiz her yılın Aralık ve Ocak aylarında 360 derece geribildirim yöntemiyle gerçekleştirilmektedir. Hedef ve yetkinlik bazlı bu değerlendirmeler, kariyer planlamanız ve terfi süreçlerinizde temel alınır.' },
                { title: 'Eğitim ve Gelişim Fırsatları (Akademi)', content: 'Portalımızda yer alan Eğitim Yönetimi modülü üzerinden atanmış zorunlu ve seçmeli eğitimlerinizi takip edebilir, sertifikalarınızı görüntüleyebilirsiniz. Kişisel gelişiminiz için dış eğitim taleplerinizi İK departmanına iletebilirsiniz.' },
                { title: 'Fazla Mesai ve İzin Kullanımı', content: 'Haftalık 45 saati aşan çalışmalar fazla mesai olarak değerlendirilir. Fazla mesai ücretleri ilgili ayın maaş bordrosuna yansıtılmakta olup, dileyen çalışanlarımız bu süreleri serbest zaman (izin) olarak da kullanabilmektedir.' },
                { title: 'Maaş Ödemeleri ve Bordro Görüntüleme', content: 'Maaş ödemelerimiz her ayın son iş günü banka hesaplarınıza yatırılmaktadır. İlgili aya ait e-bordrolarınıza admin panelinden atandıktan sonra Maaş Bordrosu sekmesinden güvenle ulaşabilirsiniz.' },
                { title: 'Avans Talebi ve Finansal Destek Şartları', content: 'Acil nakit ihtiyaçlarınız için, net maaşınızın %50\'sini aşmayacak şekilde avans talebinde bulunabilirsiniz. Avans taleplerinin her ayın 15\'ine kadar İK ve Finans onayına sunulması gerekmektedir.' },
                { title: 'İşten Ayrılma, İhbar Süreleri ve Çıkış Süreci', content: 'İş sözleşmesinin feshinde yasal ihbar sürelerine (çalışma süresine bağlı olarak 2 ile 8 hafta arası) uyulması zorunludur. Çıkış mülakatları ve ilişik kesme işlemleri İK departmanı koordinasyonunda yürütülür.' }
            ];

            let adminUser = await db.get("SELECT id FROM users WHERE role = 'admin'");
            let adminId = adminUser ? adminUser.id : 1;

            for (const item of hrAnnouncements) {
                await db.run('INSERT INTO announcements (title, content, created_by) VALUES (?, ?, ?)', [item.title, item.content, adminId]);
            }
            console.log('✅ 10 adet örnek İK Duyurusu başarıyla eklendi.');
        }

        // Haberler tablosunu kontrol et
        const newsCount = await db.get('SELECT COUNT(*) as cnt FROM company_news');
        if (newsCount && newsCount.cnt === 0) {
            const hrNews = [
                { title: '2026 Yılı Çalışan Memnuniyeti Anketi Sonuçlandı!', content: '"Siz Söylediniz, Biz Dinledik" mottosuyla gerçekleştirdiğimiz anket sonucunda genel memnuniyet oranımız %88 olarak ölçüldü. Katkı sağlayan tüm çalışanlarımıza teşekkür ederiz.', image_url: 'https://images.pexels.com/photos/3184360/pexels-photo-3184360.jpeg?auto=compress&cs=tinysrgb&w=800' },
                { title: 'İK Dönüşüm Projemiz: "Dijital Portal" Canlıda!', content: 'Çalışan portalımız, modüler izin sistemi, online eğitim atamaları ve e-bordro görüntüleme özellikleriyle baştan aşağı yenilendi. Artık tüm İK süreçleriniz tek tıkla elinizin altında.', image_url: 'https://images.pexels.com/photos/1181675/pexels-photo-1181675.jpeg?auto=compress&cs=tinysrgb&w=800' },
                { title: '"Aramıza Hoş Geldiniz" - Yeni Oryantasyon Programı', content: 'Şirketimize yeni katılan arkadaşlarımızın adaptasyon sürecini hızlandırmak için hazırladığımız "Buddy" destekli yeni oryantasyon programımız bu ay itibarıyla başladı.', image_url: 'https://images.pexels.com/photos/3184287/pexels-photo-3184287.jpeg?auto=compress&cs=tinysrgb&w=800' },
                { title: '"Sağlıklı Yaşam ve Ergonomi" Seminerleri Başlıyor', content: 'İş sağlığı ve güvenliği kapsamında, uzman fizyoterapistler eşliğinde masa başı ergonomisi ve sağlıklı beslenme seminerlerimiz haftaya konferans salonunda gerçekleşecek.', image_url: 'https://images.pexels.com/photos/3760067/pexels-photo-3760067.jpeg?auto=compress&cs=tinysrgb&w=800' },
                { title: 'Yılın Çalışanı Ödülleri Sahiplerini Buldu', content: 'Gelenekselleşen "Yılın Çalışanı" ödül törenimiz dün akşam gerçekleşti. Fark yaratan projeleriyle ödül alan arkadaşlarımızı tebrik ediyor, başarılarının devamını diliyoruz.', image_url: 'https://images.pexels.com/photos/3184306/pexels-photo-3184306.jpeg?auto=compress&cs=tinysrgb&w=800' },
                { title: 'Şirket İçi Mentorluk Programımız Başlıyor', content: 'Deneyimli liderlerimiz ile genç yeteneklerimizi buluşturan "Geleceğe Yön Ver" mentorluk programı için başvurular açıldı. Kariyerinize yön vermek için bu fırsatı kaçırmayın.', image_url: 'https://images.pexels.com/photos/3184297/pexels-photo-3184297.jpeg?auto=compress&cs=tinysrgb&w=800' },
                { title: 'Sosyal Sorumluluk Kulübümüzden Fidan Bağışı', content: 'Çalışanlarımızın katılımıyla oluşturulan Hatıra Ormanımız için bu ay 1000 adet fidan bağışı gerçekleştirildi. Doğaya ve geleceğe katkılarımız hız kesmeden devam edecek.', image_url: 'https://images.pexels.com/photos/30386920/pexels-photo-30386920.jpeg?auto=compress&cs=tinysrgb&w=800' },
                { title: 'Kariyer Fuarında Genç Yeteneklerle Buluştuk', content: 'Üniversite kariyer günlerinde standımızı ziyaret eden yüzlerce öğrenciyle staj ve iş imkanlarımızı paylaştık. Geleceğin liderlerini şirketimize kazandırmaktan gurur duyuyoruz.', image_url: 'https://images.pexels.com/photos/2760241/pexels-photo-2760241.jpeg?auto=compress&cs=tinysrgb&w=800' },
                { title: 'Ofisimizde Sıfır Atık ve Sürdürülebilirlik Hareketi', content: 'Tüm ofis katlarımıza yeni ayrıştırılmış geri dönüşüm kutuları yerleştirildi. Ayrıca tek kullanımlık plastik bardak ve kağıt kullanımını minimuma indiriyoruz.', image_url: 'https://images.pexels.com/photos/1684187/pexels-photo-1684187.jpeg?auto=compress&cs=tinysrgb&w=800' },
                { title: 'Bahar Şenliği ve Kurumsal Pikniğimiz Yaklaşıyor!', content: 'Geleneksel bahar pikniğimiz için hazırlıklar tamamlandı. Turnuvalar, sürpriz yarışmalar ve ailelerimizin katılımıyla harika bir hafta sonu bizi bekliyor.', image_url: 'https://images.pexels.com/photos/1587927/pexels-photo-1587927.jpeg?auto=compress&cs=tinysrgb&w=800' }
            ];

            let adminUser = await db.get("SELECT id FROM users WHERE role = 'admin'");
            let adminId = adminUser ? adminUser.id : 1;

            for (const item of hrNews) {
                await db.run('INSERT INTO company_news (title, content, image_url, created_by) VALUES (?, ?, ?, ?)', [item.title, item.content, item.image_url, adminId]);
            }
            console.log('✅ 10 adet örnek İK Haberi başarıyla eklendi.');
        }
    } catch (e) {
        console.error('Örnek İK bilgileri eklenirken hata oluştu:', e.message);
    }
}

async function clearDemoProfilePhotoLinks(db) {
    try {
        await db.run(
            "UPDATE personal_info SET photo_path = NULL, photo_public_id = NULL WHERE photo_path LIKE 'https://images.unsplash.com/%'"
        );
    } catch (e) {
        console.error('Demo profil fotograflari temizlenirken hata olustu:', e.message);
    }
}

module.exports = {
    seedHRInfo,
    clearDemoProfilePhotoLinks
};
