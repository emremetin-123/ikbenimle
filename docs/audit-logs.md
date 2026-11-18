# Log Kayıtları

## Kapsam ve erişim

Sistem > Log Kayıtları (`/employee/moduller/log-kayitlari`) yalnız gerçek `admin`
rolüne açıktır. `manage_users` dahil diğer izinler şirket genelindeki loglara
erişim sağlamaz. Backend tüm liste, detay, export ve koruma endpoint'lerinde
oturum ve admin kontrolü; mutasyonlarda mevcut CSRF kontrolünü uygular.

Genel HTTP işlem günlüğü `application_audit_events`, mevcut giriş/çıkış geçmişi
`security_audit_events` üzerinden tek listede gösterilir. Önceki dönemlere ait
genel modül işlemleri için geriye dönük olay üretilmez. Mevcut oturum geçmişi migration
anında güvenli aktör adı/sicili ve UTC tarih alanıyla hazırlanır. Eski olaylardaki
ad, migration anındaki kullanıcı adıdır; tarihsel ad kanıtı değildir. Sonraki
olaylar aktör adını olay anında saklar. Kullanıcı silinmesi logları silmez.

Sunucu olayları; modül, işlem türü, kayıt kimliği, kimliği doğrulanmış aktör,
IP, HTTP sonucu ve zamanı içerir. İstek gövdesi, query string, cookie, parola,
token, dosya içeriği, serbest açıklama veya cevap metni kopyalanmaz. Güncellenmek
üzere gönderilmiş alan adları sınırlı allowlist'ten kaydedilir; bu alanların
gerçekten değiştiği iddia edilmez. Polivalans puanında görev sahipliği kapsamında
önceki sayı ve yanıttaki kaydedilen sayı kaydedilebilir; yorum metni alınmaz.
`request_id` yalnız UUID biçiminde alınır ve aktör kimliği yerine kullanılmaz.

Kapsanan alanlar: kullanıcı/profil, eğitim, duyuru/haber, belge, yönetici geri
bildirimleri, kariyer, bilgi portalı, anket, yemek, servis, polivalans, izin,
rehber, bildirim, sistem ayarı, entegrasyon yönetimi ve log ekranı erişimleri.
GET, arayüzde ve export'ta `Veri okuma` olarak gösterilir (`view` API anahtarı
korunur); geçmiş kayıtlar da aynı açıklamayla okunur. Bu kayıt sayfa açılışı
veya sisteme giriş kanıtı değildir. Otomatik liste
yenilemeleri de okuma sayılabilir. Heartbeat/izleme, summary/options/status
istekleri, statik görseller, duyuru bölüm seçenekleri ve ana sayfadaki izin
bakiyesi, günlük menü, kişisel yemek puanı durumu ve doğum günü özetleri
sayılmaz. Profil fotoğrafı için mevcut oturum bilgisi kullanılır. Profil
ayrıntılarının okunması ve yemek puanı gönderimi kaydedilir. Ana sayfadaki
haber ve duyuru kartlarının okumaları `Ana Sayfa` altında kaydedilir.
Modüllerin kendi liste ve detay istekleri ilgili modül adıyla kaydedilir.
Yemek menüsü dosyasının
ayrıştırılması `PDF analizi`, menünün kaydedilmesi `Düzenleme` olarak görünür.
Menü, görev bağlantısının görünürlüğünü
`/api/polyvalence/my-tasks/summary` üzerinden kontrol eder; bu teknik kontrol
Polivalans okuma kaydı oluşturmaz. Görev/rapor verilerinin gerçek istekleri
kaydedilmeye devam eder. Belgeler ve eğitim PDF dosyalarının
doğrudan indirmesinde dosya yolu yerine tek yönlü dosya tanımlayıcısı saklanır.
Arka plan görevleri ve makine entegrasyonlarının ayrıntılı geçmişi kendi alan
tablolarında kalır; bu ekran bunları kullanıcı HTTP işlemi olarak göstermez.

Production'da IP, Caddy ve Nginx üzerinden iletilen istemci bağlantısından
alınır. Bu ayar yeni kayıtlarda kullanılır. Daha önce kaydedilmiş Docker
adresleri geçmiş kayıtlarda olduğu gibi kalır.

Anonimlik için çalışan `/api/feedback`, `/api/mood-check` gönderim/okuma akışları,
chatbot ve kişisel hatırlatıcılar kapsam dışıdır. Duygu analizi yönetici erişimi
kapsamdadır; yanıt içeriği veya anonim yanıt kimliği kaydedilmez. Aynı özel
akışlarda Pino otomatik HTTP logu da kapalıdır. Proxy/altyapı logları ayrıca
işletim politikasına tabidir; bu modül bunların gizlilik garantisi değildir.

## Kayıt güvenilirliği

`auditMiddleware` uygun istekte auth middleware'ine bir başlangıç kancası bağlar.
Oturum doğrulanınca, CSRF/yetki/iş kuralları ve mutasyon başlamadan önce aktörlü
`pending` kayıt kalıcı olarak eklenir. Başlangıç kaydı yazılamazsa işlem 503
`AUDIT_UNAVAILABLE` ile engellenir. Kimliksiz 401 denemeleri sonuçtan sonra en iyi
çabayla kaydedilir; mevcut login olayları ayrı güvenlik kaydını kullanır.
Oturum geçmişi mevcut en iyi çaba davranışını korur; yazım arızası teknik loga
bildirilir. Login/çıkış işlemi ile güvenlik logu aynı transaction değildir.

HTTP tamamlanınca sonuç güncellenir; 2xx/3xx başarı, 4xx reddedildi, 5xx hata,
bağlantı kesilmesi aborted olur. HTTP başarısı uygulamanın o HTTP sözleşmesini
tamamlamasıdır; tüm alt süreçlerin tamamlandığını garanti etmez. Sonuç yazımı
üç kez denenir. Yazılamazsa başlangıç kaydı pending kalır; iki dakikadan eski
pending kayıtlar modülde uyarılır ve 365 gün korunur. API kapanışında sonuç
yazımları beklenir. İş verisi ve günlük farklı transaction'lardır; çökme durumunda
kesin sonucu logdan çıkarmak mümkün olmayabilir. Bu durum başarıya çevrilmez.

Arayüz/API olayın içeriğini değiştiremez veya tek tek silemez. Veritabanına
ayrıcalıklı erişimi olan kişi kayıtları değiştirebilir; bu sistem WORM veya
kriptografik imzalı delil deposu değildir. DB erişimi ve yedek yetkileri ayrı
korunmalıdır. Mevcut alan bazlı eğitim/polivalans kanıtları değiştirilmez.

## Saklama ve temizlik

- Başarılı genel okuma/ekleme/düzenleme olayları: 180 gün.
- Kullanıcı/yetki, sistem ayarı, entegrasyon ve log yönetimi; silme, export,
  indirme; başarısız, reddedilen, bağlantısı kesilen veya sonuçsuz olaylar: 365 gün.
- Oturum güvenlik olayları: 365 gün.
- Asıl eğitim, sertifika, polivalans, personel ve alan audit/kanıt kayıtları bu
  temizliğin dışındadır. Bunların hukuki saklama politikası ayrıca belirlenir.

Arka plan worker'ı başlarken ve saatlik kontrol yapar; UTC gününde bir kez
(Türkiye saatinde yeni günün 03:00 sonrası) temizlik uygular. Kaçan günler sonraki
başlangıçta telafi edilir. İki worker aynı kontrol satırında transaction kilidiyle
sıralanır. Süre hesabı UTC zaman farkıdır; eşik anındaki kayıt korunur, eşikten
eski kayıt silinir. Üç yıllık imha özetleri takvim yılıyla hesaplanır. Son başarılı
kontrol yoksa veya 36 saatten eskiyse arayüz uyarır; worker hatayı konsola yazar.

İnceleme için bir olaya admin tarafından en az 10 karakter gerekçeyle koruma
konabilir. İlk gerekçe ikinci istekle ezilmez. Koruma ve temizlik aynı kontrol
kilidini kullanır. Koruma kaldırılırsa süresi dolmuş olay sonraki günlük
temizlikte silinir; sürenin yeniden başlaması söz konusu değildir. Koruma
işlemleri de kritik logdur. Korunmuş kayıtların gerekçesi düzenli gözden geçirilir.

Her başarılı temizlik, yalnız tarih ve silinen genel/kritik/güvenlik kayıt
adetlerini içeren özet bırakır; silinen kişisel içeriği tekrarlamaz. Özet en az
üç takvim yılı saklanır. Uygulama içindeki arşivde süresiz kopya tutulmaz.
Yedeklerin rotasyonu/geri yükleme sonrası silme kuralları ayrıca uygulanmalıdır;
veritabanından silme eski yedekleri geriye dönük değiştirmez.

## Kullanım

Kullanıcı/sicil, modül, işlem, sonuç, Türkiye tarih aralığı ve koruma filtresi;
25 satırlı sayfalama, detay penceresi, son temizlik bilgisi ve Excel ile
açılabilen UTF-8 BOM CSV vardır. Export en fazla 5.000 filtrelenmiş satırdır;
daha fazlası sessizce kesilmez, filtreyi daraltma hatası döner. CSV formül
başlangıçları etkisizleştirilir. IP ve detaylar export'a dahil değildir.
Liste/export'un o anda sürmekte olan kendi log olayı, yanıtta kendisini
sonuçsuz göstermemek için yalnız o yanıttan çıkarılır; kaydı yine tutulur ve
sonraki sorguda görünür. Politika/sağlık bilgisi açık ekranda dakikada bir
yenilenir; bu teknik kontrol için ayrı okuma logu oluşturulmaz.

## Doğrulama ve dayanak

`backend/tests/auditLogs.test.js`: gerçek oturum/CSRF, yönetici kapsamı, maskelenen
girdiler, anonim istisnalar, güvenli CSV, depo arızası, sonucu yazılamayan olay,
180/365 gün eşikleri, koruma, temizlik idempotansı, üç yıllık özet ve migration.
`frontend/tests/e2e/audit-logs.spec.ts`: filtre, export, detay, koruma ve mobil
erişilebilirliği; mevcut testler diğer modüllerin davranışını doğrular.

Süreler 28.10.2026 tarihinde kabul edilen ürün politikasıdır; her tür veri için
evrensel yasal süre olduğu iddia edilmez. Temel karşılaştırmalar:
[Microsoft](https://learn.microsoft.com/en-us/purview/audit-solutions-overview),
[Google](https://knowledge.workspace.google.com/admin/reports/data-retention-and-lag-times),
[SAP](https://userapps.support.sap.com/sap/support/knowledge/en/3286668).
İmha işlem kayıtlarının en az üç yılı:
[KVKK Yönetmeliği madde 7](https://www.kvkk.gov.tr/Icerik/5441/KISISEL-VERILERIN-SILINMESI-YOK-EDILMESI-VEYA-ANONIM-HALE-GETIRILMESI-HAKKINDA-YONETMELIK).
