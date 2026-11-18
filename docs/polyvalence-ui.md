# Polivalans arayüzü ve korunan akışlar

## İncelenen yapı

- `AdminPolyvalence`: yönetim metadata'sı, dönemler, rapor grupları ve açık dönem eksikleri.
- `PolyvalenceCatalogPanel` / `PolyvalenceSkillTargetModal`: bölüm, pozisyon, beceri, kategori, eğitim bağlantıları ve hedefler.
- `PolyvalenceMembershipPanel`: sayfalı çalışan havuzu, otomatik bölüm/pozisyon/üst amir eşleşmeleri ve manuel istisnalar.
- `PolyvalenceStandardsPanel`: otomatik takvim ve ortak seviye tanımları.
- `PolyvalenceTasks` / `PolyvalenceEvaluationWorkspace`: değerlendiricinin atanmış görevleri ve çalışan bazında puanlama.
- `PolyvalenceReportsPanel` / `ReportDashboard` / `PolyvalenceReportDetails`: dönem takibi, bölüm kapsamı, hesaplanan sonuçlar, çalışan ayrıntısı, indirme ve tarihçe.
- Backend `catalog`, `memberships`, `periods`, `scheduling`, `tasks`, `reports` katmanları ile `dashboardService` ve ilgili testler.

## Ekran düzeni

Polivalans çalışma alanında ortak tipografi ölçeği kullanılır: sayfa başlığı
masaüstünde 28px, mobilde 24px; bölüm başlıkları 16px; ana arayüz metni 14px;
yardımcı metinler 13px ve kısa etiketler en az 12px. Başlık ağırlığı 600'dür.
Genel kart iç boşlukları masaüstünde 24px, mobilde 20px; rapor kartlarının
yerleşimi `poly-report-modern` altında ayrıca tanımlıdır; aksiyon yükseklikleri 44px
olarak standartlaştırılır. Tablo başlıkları normal harf düzeninde gösterilir.
Rapor indirme kontrolleri diğer ikincil aksiyonlarla aynı boyut ve hizadadır.
Puan seçenekleri 44px dokunma alanıyla 0–3 olarak tek satırda gösterilir;
seviye açıklamaları her puanın erişilebilir adı/başlığı içinde korunur.
Açık çalışanın üstünde ayrıca beceri araması, seviye açıklama satırı veya
sürekli otomatik kayıt yazısı gösterilmez; beceriler doğrudan listelenir.
Otomatik kayıt ve alanın kayıt sırasındaki meşgul durumu korunur.
Stiller yalnız polivalans alanına uygulanır.

Menüde değerlendirme ve dönem/rapor girişleri bulunur. Yönetim alanı ana rapor
başlığının sağ üstündeki `Polivalans Ayarları` butonuyla geniş bir modalda
açılır; yalnız admin ve yönetim izni olan kullanıcılar bu butonu görür.
Modal; Beceriler ve Hedefler, Çalışan Eşleşmeleri, Değerlendirme Takvimi,
Seviye Tanımları olarak gruplanır. Bölüm seçimi beceri ve takvim ekranlarında
ortaktır. Çalışan eşleşmeleri mevcut sayfalı şirket havuzunu kullanır;
seviyeler tüm bölümler için ortaktır. Mobilde ayarlar tam ekran açılır.
Modal kapanınca açık rapor ve pozisyon filtresi korunur. Eski `view=management`
bağlantıları yetkili kullanıcıda ayarlar modalını açmaya devam eder.

İç düzenleme formları ayrı modal olarak açılır. Ortak `ModalShell`, pencereleri
body altında portal ile oluşturur ve yalnız en üstteki modalın klavye odağını
ve Escape işlemini yönetir; alttaki modal inert durumdadır. Alt form kapanınca
ayarlar açık kalır ve odak formu açan kontrole döner. Son modal kapatılana kadar
arka plan kaydırması kilitli kalır.

Beceri adı, kategori, açıklama, eğitim bağlantıları ve seçili pozisyonun
hedef seviyesi/kritikliği/asgari yetkin kişi sayısı aynı formda düzenlenir.
Beceri bilgileri bölümde ortak, hedef pozisyona özeldir. Mevcut beceri
başka pozisyona hedef olarak eklenebilir. Beceri, eğitim bağlantıları ve hedef
mevcut ayrı endpoint'lere sırayla kaydedilir; işlem tek transaction değildir.
Sonraki istek hata verirse form kısmi kaydı açıkça bildirir ve oluşturulan
becerinin kimliğini koruyarak tekrar kayıtta mükerrer beceriyi engeller.

Değerlendirmede çalışanlar alt alta, başlangıçta kapalı satırlar halinde listelenir.
İsme tıklanınca beceriler aynı satırın altında açılır; aynı anda tek çalışan açık
kalır. Beceri alanı en fazla 60dvh/640px yüksekliğinde kaydırılır; 30 beceri
sayfanın tamamını uzatmaz. Beceri satırları kompakt puanlar ve yorum kontrolü
taşır; kayıtlı yorum ayrıca açılıp okunabilir. Eğitim verebilir seçeneği seviye 3'te
görünür. Her seçim sunucuya sürüm numarasıyla kaydedilir.
Bekleyen/tamamlanan filtreleri, arama, yorum, önceki/sonraki çalışan ve
görev tamamlama kontrolleri vardır. Bir çalışanın tüm becerilerinin puanlanması,
tüm değerlendirici görevinin onaylanmasından ayrı gösterilir.
Önceki/sonraki çalışan seçimi arama ve durum filtresindeki görünür sırayı izler.

## Değişmeyen iş kuralları

- Puan aralığı 0–3; eğitim verebilir yalnız seviye 3 ve isteğe bağlıdır.
- Puan düşürme ve eğitim verebilir değişikliği açıklama gerektirir.
- Sürüm çakışması sunucu tarafından reddedilir; yenileme kontrolü sunulur.
- Tamamlanan görev ve açık olmayan dönem arayüzde de salt okunurdur.
- Dönem açılışındaki çalışan/beceri/hedef snapshot'ları ve önceki dönemden
  aktarma hesapları korunur. Açık döneme yeni kayıt ekleme ayrı, açık bir işlemdir.
- Kategori ve beceriler silinmez; arşivlenir ve geçmiş dönem sonuçları korunur.
- Manuel eşleşme, otomatiğe dönüş ve pasifleştirme davranışları korunur.
- Worker aktif takvimleri Türkiye gününe göre kontrol eder; zamanı gelen açılış,
  süresi dolan kapanış, başarısız açılışın yeniden denenmesi ve hatırlatma akışı
  değiştirilmemiştir. Takvim kaydı sonrası mevcut kontrol çağrısı sürer.

## Yetki ve rapor kapsamı

Admin ve `manage_polyvalence` tüm bölümleri yönetir ve raporlar.
Değerlendirici yalnız kendi atanmış görevlerini görür/değerlendirir.
`view_polyvalence_reports` sahibi employee yalnız güncel departmanına eşleşen
bölümün rapor, CSV ve tarihçesine erişir. Kısıtlar backend'de uygulanır;
arayüz yönetim kontrollerini ve şirket kapsamı seçimini gizler.

Yönetim yetkisi olan kullanıcılar açık dönemleri dönem listesindeki “Raporu aç”
aksiyonunun yanındaki “Dönemi kapat” butonuyla, tüm değerlendirici görevleri
tamamlandıktan ve onay verdikten sonra kapatabilir. Rapor detayında hesaplama
açıklama bloğu gösterilmez.

Bir dönem satırından rapor açılması doğrudan o dönemin `period_id` değerini
kullanır. Admin aynı tarih grubundaki bölümleri karşılaştırmak için kapsamı
açıkça değiştirebilir. Çıktılar tek bölümün tüm pozisyonlarını kapsar;
ekrandaki pozisyon filtresinin dosyaya uygulanmadığı belirtilir.

## Hesapların doğru sunumu

`dashboardService` hesapları değiştirilmemiştir:

- Polivalans: hedefi karşılayan değerlendirmeler / hedefli değerlendirmeler.
- Ortalama beceri/çalışan: hedefi karşılayan beceriler / kapsamdaki çalışanlar.
- Isı haritası ve pozisyon karşılaştırması: hedef karşılama yüzdesi; 0–3 puan
  ortalaması değildir. Verisi olmayan hücre sıfır yerine boş gösterilir.
- Tamamlanan çalışan: bütün değerlendirme satırları puanlanmış çalışan.
- Dönem listesi ilerlemesi: tamamlanan değerlendirici görevi / tüm görevler;
  çalışan sayısı olarak etiketlenmez.
- Kritik risk: kritik beceride tek kişiye bağımlılık veya asgari yetkin kişi açığı.
- Gelişim listesi: kapsamı %60 altında olan ilk beş beceri.

## Rapor görünümü

`ReportDashboard.tsx`, mor/turkuaz/mercan özet kartları, hedef karşılama halkası,
pozisyon karşılaştırması, risk listesi ve beceri matrisi sunar. Tamamlanma ile
hedef karşılama ayrı gösterilir. Halkanın kalan bölümü hedefin altında veya
değerlendirilmemiş becerileri kapsar; hedef verisi yoksa boş durum gösterilir.
Yeni grafik bağımlılığı yoktur; halka SVG, çubuklar yerel `progress` kullanır.
Stiller `module-polyvalence-workspace.css` içindeki `poly-report-modern`
kapsamındadır. Mobilde kartlar tek sütuna geçer, geniş tablolar kendi alanında kayar.

## Doğrulama

`backend/tests/polyvalence.test.js` dönem açma/klonlama/arşiv/kilitleme,
görev sahipliği ve yabancı bölümün rapor/CSV/tarihçesine erişim reddini;
`polyvalenceScheduling.test.js` Türkiye günü ve başarısız taslak tekrarını korur.

`frontend/tests/e2e/polyvalence.spec.ts` dört ekran boyutunda birleşik formu,
seçili bölüm raporunu, değerlendirici görünümünü, açıklama zorunluluğunu,
görev kilidini, kısmi kayıt tekrarını, yatay taşmayı ve axe erişilebilirlik
kontrollerini sınar. Browser testleri sentetik API fixture'ları kullanır;
sunucu kuralları ayrı olarak gerçek geçici SQLite üzerinde doğrulanır.
`polyvalence-compact.spec.ts`, 30 çalışan × 30 beceriyle tek açık çalışanı,
sınırlı kaydırma alanını, satır yüksekliğini, aramayı, klavyeyle açma/kapamayı,
yorum/eğitmen açıklamasını, sürüm çakışmasını ve seçimlerin korunmasını sınar.

`polyvalence-report-design.spec.ts`, hedef karşılama ve tamamlanma ayrımını,
çalışan hedef çubuklarını, pozisyon filtresini ve boş veriyi dört ekran boyutunda sınar.
