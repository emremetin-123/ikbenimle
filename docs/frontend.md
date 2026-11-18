# Frontend

## Teknoloji

- React 19 ve React DOM
- TypeScript 5.9
- Vite 7
- TanStack Query 5
- Lucide React
- Leaflet
- jsPDF ve QRCode
- ESLint 10

## Uygulama Yapısı

`frontend/src/main.tsx`, güvenli fetch sarmalayıcısını kurar ve uygulamayı
başlatır. `App.tsx` authentication ve oturum zaman aşımı katmanlarını bağlar.
`AuthProvider`, her oturum kapsamı için ayrı `QueryClientProvider` oluşturur.

React Router paketi kullanılmaz. `router.tsx`, konum, gezinme ve bağlantı
altyapısını sağlar. `App.tsx` sayfa yollarını eşler, `React.lazy` ile ekranları
yükler ve bilinmeyen yolları oturum durumuna göre girişe veya ana sayfaya yönlendirir.

## Ekran Yerleşimi

Çalışan ve yönetim modüllerinin ortak yan menüsü, sayfa içerik temasından bağımsız
olarak aktif bağlantı, fare vurgusu ve klavye odağında mor paleti kullanır.

Masaüstünde (769px ve üzeri) ana sayfa, ilan ve anket detayları ile AI ayarları, liste
ekranları gibi dashboard içerik genişliğini doldurur. İlanın başvuru çubuğu
kendi sayfası içinde sticky kalır; viewport ortasına sabitlenmez ve yan menü
kapandığında sayfayla birlikte genişler. Ayrı eğitim oynatıcısının ana alanı ve
sınav/onay kartları da kullanılabilir genişliği doldurur. Mobil genişlik kuralları
ve modal boyutları bu düzenlemeden etkilenmez.

Mobilde bütün çalışan sayfaları ve yönetim modülleri ortak `MobileHeader`
bileşenini kullanır. Mor üst bardaki başlık ve ikon mevcut menü tanımından
alınır; ilan detayında detay başlığı, eğitim oynatıcısında eğitim adı gösterilir.
İçerikteki modül başlığı ekran okuyucular için korunur; oluşturma, yenileme
ve dışa aktarma işlemleri görünür kalır. Üç bağlantılı `BottomNav` aynı hizada,
en az 44px dokunma alanıyla bütün sayfalarda ve oynatıcıda kullanılır.
Mobil kabuk kuralları `styles/responsive.css` içindedir; masaüstü başlıkları
ve diğer modüllerin içerik renkleri değişmez.
Mobilde tek sayfa işlemi, mor başlığın altındaki satırda sağa hizalanır. Beyaz
zemin, mor çerçeve, 10 px köşe yarıçapı ve en az 44 px dokunma yüksekliği
kullanır. İkili işlem gruplarında ana işlem mor dolgulu, yardımcı işlem mor
çerçevelidir. Butonlar eşit genişlikte dizilir ve dar ekranlarda alt alta
geçer. Öneri ve şikâyet renkleri korunur. Dışa aktarma işlemi, mobilde
ilgili kullanıcı listesi veya rapor alanında yeşil buton olarak gösterilir.

## Modüle özgü ekranlar

İzinlerim ekranı ortak mor başlığı, lavanta izin seçeneklerini ve mor seçim
vurgusunu kullanır. Talep durumları turkuaz, mercan ve amber etiketlerle ayrılır.

### Bildirimler ve işlem günlüğü

Bildirimler ekranındaki istatistik kartları `NotificationSubscribersModal`
penceresini açar; sayfalı ad/sicil/bölüm araması ve aktif/pasif filtresi vardır.
Liste yalnız pencere açıkken yüklenir. Günlük şablon kartları son gönderim
denemesinin sonucunu gösterir; şablonlar dakikada bir yenilenir. Bildirim
servisinin kabul bilgisi, okundu veya çevrimiçi bilgisi olarak sunulmaz.

Sistem > Log Kayıtları, yalnız admin'e görünür. Ortak `ModulePageHeader`,
filtre formu, sayfalı işlem tablosu, yeşil CSV/Excel aksiyonu ve `ModalShell`
detay/koruma penceresi kullanır. Mobilde tablo kartlara dönüşür. Filtreler
yazarken istek atmaz; Filtrele ile uygulanıp ilk sayfaya döner. Yalnız kullanıcı
yönetimi izni olan hesapta sorgular başlatılmaz. Kaynaklar `src/audit/` ve
`AdminAuditLogs.tsx`; stiller `module-audit.css` içindedir.

### Ana sayfa ve polivalans

Ana sayfa polivalans raporlarıyla aynı mor başlık, lavanta zemin ve beyaz kart
dilini kullanır. İzin/eğitim/hatırlatma özetleri mor, turkuaz ve mercan renklerindedir.
Profil fotoğrafı karşılama satırının sağında profil bağlantısıdır; hava durumu
dar ekranlarda ayrı satıra geçer. Mobilde ana sayfa başlığı ortak üst barda
gösterilir; sayfanın tek `h1` başlığı ekran okuyucu için korunur. İçerik teması
`dashboard-layout--personal` ile ana sayfa ve Profilim kapsamında uygulanır.
İçerik paleti `styles/employee-theme.css` içinde tek yerde tutulur.
Ana sayfa fotoğrafı masaüstünde 112px, mobilde 96px kare çerçevede ortalanır;
görsel en-boy oranını koruyarak çerçeveyi doldurur.

`pages/Home.tsx` yerleşim ve içerik sorgularını birleştirir. Özet, hızlı erişim,
duyuru/doğum günü ve yemek kartları `components/home/` altında ayrı tutulur.
Veri erişimi ortak API istemcisi ve oturuma özel TanStack Query önbelleğini
kullanır. Hatırlatma sayısı ile düzenleme listesi `usePersonalReminders` ile
aynı sorguyu paylaşır; ekleme/tamamlama sonrasında özet de güncellenir.
Yükleme, boş ve hata durumları ayrıdır; sorgu hatası sıfır kayıt olarak sunulmaz.

Mobilde izin/eğitim kartları iki sütun, hatırlatma özeti tek satır ve hızlı
erişim dört sütun/iki satırdır. İçerik kartları tek sütunda akar; ortak alt
menü korunur. Haberler masaüstünde iki, mobilde bir kart gösterir. Yerel
kaydırma, sayfa düğmeleri ve önceki/sonraki okları vardır; otomatik geçiş
yoktur. Haber ve yemek detayları ortak `ModalShell` ile açılır.

Duygu kartı etiketli çizgi ikonları kullanır; gönderimden sonra seçenekler
görünür kalır ve `Bildirimin için teşekkür ederiz.` mesajı gösterilir. Günlük
gönderim sınırı, sebep seçimi ve isteğe bağlı geri aranma akışı korunur;
gönderilmiş veya gönderim bekleyen seçenekler devre dışıdır.

Polivalans değerlendirme, dönem/rapor ve yönetim alanlarının düzeni, korunan
iş kuralları ve doğrulama kapsamı [Polivalans arayüzü](polyvalence-ui.md)
belgesinde açıklanır. Yeni stiller `module-polyvalence-workspace.css` içinde
`.poly-*` kapsamındadır; ilerleme çubukları yerel `<progress>` kullanır.

### Profilim

Profil, ortak mor başlığın altında lavanta zemin ve beyaz kartlar kullanır.
Eğitim ve rozet toplamları `/api/videos/summary` yanıtından alınır; mevcut
rozet sayfasının uzunluğu toplam olarak gösterilmez. Mobilde iki özet kartının
altında sicil satırı bulunur; iletişim, hakkımda ve detay kartları tek sütuna geçer.
Rozet görselleri, sayfalama ve ortak sertifika penceresi korunur.

Profil ve yan menü fotoğrafı aynı `employeeProfile` sorgusunu paylaşır. Fotoğraf
yüklendiğinde bu sorgu yenilenir; ayrıca fetch veya global olay dinleyicisi yoktur.
Kartlar ayrı düzenlenir; kayıt hatasında taslak korunur ve tekrar denenebilir.
Profil, eğitim özeti ve rozetlerde yükleme/boş/hata durumları ayrıdır.
Profil fotoğrafı masaüstünde 160px, mobilde 128px, 400px altındaki ekranlarda
112px çerçevede gösterilir. Kamera simgesi çerçevenin dörtte biri boyutundadır;
köşedeki 44px tıklama alanı korunur. Gerçek fotoğraf ve boş avatar aynı kare
alana ortalanır; kamera yüzün ortasını kapatmaz.

## Kaynak dizinleri ve ortak kontroller

- `pages/`: çalışan ekranları
- `Admin*.tsx`: yönetim ekranı container'ları
- `admin-*/`: büyük yönetim ekranlarının alt bileşenleri
- `components/`: paylaşılan görsel/işlevsel bileşenler
- `layouts/`: ortak dashboard iskeleti
- `styles/`: token, base, component, responsive ve domain stilleri
- `services/`: HTTP ve push istemcileri

Yönetim container'ları sorgu, mutation ve ekran durumunu yönetir. Anket ve
bildirim listeleri/form görünümleri kendi `admin-*` alan klasörlerindeki sunum
bileşenlerine ayrılır.

Kullanıcı düzenleme formu, API'den saat bilgisiyle gelebilen `birth_date`
değerinin yalnız `YYYY-MM-DD` kısmını tarih alanına aktarır. Böylece kayıtlı
doğum tarihi görünür ve saat dilimi dönüşümüyle gün kayması oluşmaz.

Ortak UI davranışları `PageHeader`, `ModalShell`, `AppFeedback`, `AsyncState`,
`FormField`, `StatusBadge` ve `IconButton` bileşenlerinde tutulur. `ModalShell`
odak kilidi, Escape ile kapatma, body scroll kilidi ve açan kontrole odak
dönüşünü sağlar. Başarı, hata, onay ve kısa metin istemleri tarayıcı
`alert/confirm/prompt` API'leri yerine `AppFeedback` üzerinden gösterilir.

Modallar body altında portal ile gösterilir. Bir modalın içinden başka form
açıldığında yalnız üstteki pencere odak ve Escape işlemini yönetir; alttaki
pencere inert olur. Son pencere kapanana kadar body kaydırma kilidi korunur.
Polivalans yönetimi, rapor başlığındaki `Polivalans Ayarları` butonundan açılan
geniş bir modalda yer alır; raporun seçili kapsamı ve filtreleri korunur.

Yemek analizi ve menü editörü `admin-meal-menu`, profil formu/rozet
akışları `pages/personal-info`, eğitim navigasyonu ve sınav görünümü
`video-player` alan klasörlerinde tutulur. Container dosyaları veri ve iş akışı
orkestrasyonundan sorumludur.

## Eğitim rozetleri, sertifika ve oynatıcı

Eğitim İşlemleri’nin özet kartları Ana Sayfa’nın mor, lavanta, turkuaz ve
mercan paletini kullanır. Atama Kayıtları masaüstünde kendi alanında yatay
kayar. Uzun sertifika numaraları hücre içinde kırılır, onay tarihi kendi
sütununda kalır. Mobilde iki değer açılabilir atama kartında ayrı satırlardadır.

Profildeki eğitim rozeti ve Eğitimlerim sertifika aksiyonu ortak
`TrainingCertificateModal` bileşenini açar. Önizleme ve indirme aynı
`/api/assignment/:id/certificate.pdf` çıktısını kullanır; tarayıcıda ayrı bir
sertifika tasarımı üretilmez. PDF önizlemesini desteklemeyen cihazlar için
yeni sekmede açma ve indirme bağlantıları bulunur. Sertifikasız rozetlerde
belge üretilmez; açıklama gösterilir.

Eğitim oluşturma/düzenlemede `Rozet verilsin` açıksa `TrainingCoverUpload`
rozet kipinde zorunlu görsel alanını gösterir. Yüklenen tasarım kırpılmadan
`AchievementBadgeCard` içinde daha büyük, kare ve ortalanmış bir alanda kullanılır;
görsel altında ayrıca eğitim adı yazılmaz. Ad, erişilebilir düğme adı/görsel
açıklaması ve üzerine gelince gösterilen başlık içinde korunur.
Hazır çerçeve/amblem çizimleri yoktur.
Görselsiz eski kazanımlar yalnız eğitim adıyla listelenir. Profil ve rehber aynı
görsel bileşenini kullanır; sertifika üretimi rozetten bağımsızdır.
Yerel rozetler `badgeSize=256` ile küçük önizleme ister. Profil ve rehberde ilk
dört rozet eager/high öncelikle, devamı lazy yüklenir; async decoding ve sabit
görsel oranıyla yer ayrılır. Uzak rozet URL'leri değiştirilmez. Sunucu orijinali
korur; önizleme ETag ile yetki kontrolünden sonra yeniden doğrulanır.
Mobil/tablet görünümünde (768px ve altı) rozet kartı 88px, görsel en fazla
72px olur; profil koleksiyonu sabit boylu sütunlara sarılır. Masaüstündeki
120px kart/104px görsel boyutu korunur.

Eğitim oynatıcısında içerik bitmeden eylemsiz bir tamamlama/sınav butonu
gösterilmez; sınavın içerik sonrası açılacağı kısa metinle belirtilir. Kullanılabilir
sınav, sonraki içerik ve tamamlama aksiyonları içerik açıklamasının altında
ayrı bir işlem alanında sunulur. Son çalışan onayı ve sertifika referansı
oluşturma akışı korunur.

Çalışan modül route'ları gerektiğinde `AdminDashboard` içindeki izinli modülü
embedded görünümde kullanır. Bu nedenle yönetim bileşenleri hem tam panel hem
modül görünümü davranışını korur.

## Veri Erişimi

Çalışan menüsündeki `Duyurular` ekranı duyuruları başlangıçta yalnız başlık ve
tarih bilgisiyle listeler. Her satır tıklamayla veya klavyede Enter/Space ile
açılıp kapanır; içerik, yayınlayan kişi ve dosya eki açılan bölümde gösterilir.
Sayfa değiştirildiğinde duyurular kapalı başlar.

`frontend/src/services/api.ts` aşağıdaki ortak sözleşmeleri sağlar:

- JSON istekleri
- paginated liste istekleri
- ilk sayfadan sonra kalan sayfaları paralel yükleme
- form upload
- dosya indirme

QueryClient oturuma özeldir. Giriş, çıkış, oturum iptali veya kullanıcı/rol/izin/
bölüm/amir kapsamı değişiminde önceki istemcinin sorguları iptal edilir ve
önbelleği temizlenir; yeni istemci ve yeniden bağlanan ekranlar önceki kullanıcının
verisini veya form state'ini devralmaz. Aynı kapsamın periyodik oturum kontrolü
önbelleği sıfırlamaz. Ekranlar istemciyi `useQueryClient` üzerinden alır;
paylaşılan global istemci kullanılmaz. Geciken eski oturum yanıtları işlem
sırası kontrolüyle yok sayılır. Sunucu oturum/CSRF kontrolleri değişmez.

TanStack Query varsayılanları:

- stale time: 30 saniye
- garbage collection: 5 dakika
- query retry: 1
- mutation retry: 0
- pencere odağında otomatik refetch kapalı

Mutation sonrası yalnız ilgili query key'leri invalidate edilmelidir. Dosya
upload/indirme ve bazı karmaşık legacy akışlarda doğrudan `fetch` kullanımı
devam etmektedir.

`api.listAll`, ilk sayfadan toplam sayfa sayısını alır; kalan sayfaları
sınırlı paralel gruplarla yükler. Mevcut kullanımları kullanıcı, belge,
geri bildirim ve eğitim raporu dışa aktarımlarıdır. Normal listeler `api.list`
ile yalnız istenen sayfayı yükler.

## Güvenli Fetch

`secureFetch.ts`, yapılandırılmış API origin'ine giden API/upload isteklerinde:

- `credentials: include` kullanır,
- istemciden `Authorization` header'ını kaldırır,
- mutasyonlarda CSRF cookie değerini `X-CSRF-Token` olarak gönderir.

Oturum token'ı `localStorage` veya JavaScript state'inde tutulmaz. Local storage
yalnız son kullanıcı etkinlik zamanını sekmeler arasında paylaşır ve ağ hatasında
bekleyen logout işlemini işaretler. Idle ve uyarı süreleri login/session
yanıtındaki backend `session_policy` değerlerinden alınır.

## PWA ve Dağıtım

Manifest `standalone` görüntüleme sağlar. Service worker push mesajını ve
bildirim tıklamasını işler; offline application cache uygulamaz.

Production build Nginx tarafından port 8080'de sunulur. API base boşsa
same-origin kullanılır. Yerel geliştirmede varsayılan API adresi
`http://localhost:5000` olur.

## Stil, Erişilebilirlik ve Bütçeler

Giriş ekranı `public/login-ribbons.png` arka planını 3px bulanıklıkla kullanır;
form paneli 28px backdrop blur ve yarı saydam beyaz katmanla ayrılır. Masaüstünde
sağda, mobilde ortada yerleşir. Şifre görünürlüğü düğmesi ve gönderim sırasında
bekleme durumu `Login.tsx` içinde yönetilir. Görselin üretim istemi
[Giriş arka planı](login-background.md) belgesindedir.

- TSX container bütçesi: en fazla 500 satır
- CSS dosyası bütçesi: en fazla 1.200 satır
- İlk yüklenen JS ve CSS toplamı: en fazla 220 KB gzip
- Lazy chunk bütçesi: en fazla 150 KB gzip
- Sabit font ölçekleme ve mobil responsive kuralları CSS katmanlarındadır.

`index.css` stilleri şu katman sırasıyla yükler:

1. `tokens.css`
2. `app-shell.css` ve `base-and-layout.css`
3. `components.css`
4. `module-*.css` domain stilleri
5. `responsive.css` uygulama geneli responsive override'lar

Polivalans stilleri yalnız `module-polyvalence*.css` dosyalarında ve `.poly-*`
namespace'i altında tutulur. Bildirim ve anket stilleri kendi domain dosyalarına
ayrılmıştır. `npm run check:architecture` dosya bütçesini, import sırasını ve
polivalans seçici sınırını ve sıfır `!important` bütçesini doğrular. Aynı
kontrol TSX dosyalarında yeni statik inline stil ve gömülü `<style>` kullanımını
reddeder. Mevcut runtime custom property bağlantıları dosya, yardımcı ve adet
bazında allowlist ile korunur.

`index.html` kullanıcı yakınlaştırmasını engellemez. Dokunmatik cihazlarda
ortak ikon kontrolleri en az 44 x 44 piksel hedef alanına sahiptir. Hareket
azaltma tercihi token katmanında desteklenir.

Playwright paketi giriş ve ana sayfanın yanında eğitim, belge, geri bildirim,
polivalans, bildirim ve işlem günlüğü senaryolarını da kapsar. Dört ekran boyutu
ve seçili akışlardaki axe kontrolleri [Test ve Kalite](testing.md) içinde açıklanır.
