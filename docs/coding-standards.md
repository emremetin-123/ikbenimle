# Kodlama Standartları

Bu dosya yeni değişiklikler için kuralları tanımlar. Mevcut uygulamanın
ayrıntıları alan rehberlerinde, açık uyumsuzluklar [Bilinen Sorunlar](known-issues.md)
içinde tutulur. Bir kuralın yazılı olması bütün eski kodun ona uyduğu anlamına gelmez.

## Genel

- Mevcut dil ve modül stili korunur: backend CommonJS, frontend TypeScript ESM.
- İlgisiz refactor aynı değişikliğe eklenmez.
- Secret, kişisel üretim verisi ve gerçek ortam değerleri kaynak koda yazılmaz.
- Türkçe kullanıcı metinleri UTF-8 olarak kaydedilir.
- Yeni davranış test ve ilgili dokümanla birlikte teslim edilir.

Depoda Prettier veya ortak otomatik formatter yapılandırması yoktur. Frontend
ESLint kuralları ve mevcut dosya biçimi kaynak kabul edilir.

## Backend

- Route yalnız HTTP sözleşmesini ve middleware sırasını yönetir.
- İş kuralları service'e, SQL repository'ye taşınır.
- Request body, params ve query Zod ile `.strict()` doğrulanır.
- Liste endpoint'i ortak pagination sözleşmesini kullanır.
- SQL parametrelidir; dinamik kolon/sıralama allowlist ile seçilir.
- Mutation transaction gerektiriyorsa `db.transaction` kullanılır.
- Beklenen domain hatası `AppError` ile kodlanır.
- Production cevabına stack veya SQL mesajı eklenmez.
- Yetki kontrolü frontend'e bırakılmaz.
- Upload'da boyut, MIME, uzantı ve imza kontrolleri korunur.

Backend route/controller dosyası mimari test gereği 500 satırı aşmamalıdır.

## Frontend

- Component'ler fonksiyon ve hook tabanlıdır.
- API erişimi ortak istemci ve TanStack Query üzerinden yapılır.
- Query key domain bazında kararlı tutulur; mutation sonrası hedefli invalidate
  yapılır.
- Oturum token'ı state veya web storage'a yazılmaz.
- Mutasyonlarda `secureFetch` CSRF davranışı atlanmaz.
- Lucide karşılığı olan ikon elle çizilmez.
- Form, modal ve liste birbirinden ayrılır; container dosyası 500 satırı
  aşmamalıdır.
- Sabit boyutlu kontroller responsive ölçülerle tanımlanır; metin taşması ve
  mobil yatay kayma kontrol edilir.

Çalışan modüllerinin giriş başlıkları `ModulePageHeader` kullanır. Kariyer
Merkezi referansı korunur: ikon kutusu, tek `h1`, kısa açıklama ve isteğe bağlı
sağ işlem alanı. Boyutlar, boşluklar ve mobil kırılım
`styles/module-page-header.css` içinde ortaktır; renk için `blue`, `teal` veya
`violet` tonu seçilir. Bu ortak modül stili domain stillerinden sonra,
`responsive.css` öncesinde yüklenir; import sırası mimari kontrolde doğrulanır.
Arama ve filtreler başlığın altında kalır. Mobilde bütün çalışan sayfaları ve
yönetim modülleri `MobileHeader` kullanır; sayfa adı mevcut menü tanımından
alınır. İçerikteki modül başlığı ekran okuyucu için korunur, başlığın işlem
düğmeleri görünür kalır. Masaüstünde ana sayfa ve Profilim mor ortak başlığı
kullanır. İçerik detayları bu standardın dışında kalır. Servis, duyuru,
haber, belge, anket, duygu analizi, bilgi portalı, yemek menüsü, eğitim ve kariyer yönetim
ekranları da aynı başlığı kullanır. Yönetim butonları `actions` alanında,
işlem bildirimleri başlığın altında kalır. Çalışan alanında da kullanılan
polivalans raporu ortak başlığı kullanır.
Belgelerim'de belge talep etme butonu başlığın sağ işlem alanındadır.
Geri bildirim yönetiminde dışa aktarma, Talepler tablosunun sağ üstünde
ortak yeşil `ExportExcelButton` ile sunulur; sayfa başlığında tekrarlanmaz.
Bilgi İşlemleri kategori oluşturma formu, başlıktaki `Kategori Ekle` butonuyla
küçük bir pencerede açılır; başarılı kayıt sonrası kategori listesi yenilenir.

Masaüstünde (769px ve üzeri) ana sayfa, modül giriş ve ilan/anket detay sayfaları, yan menü açık veya daraltılmış
olduğunda `dashboard-content-frame` alanının tamamını kullanır. Ortak genişlik
kuralı `styles/app-shell.css` içindedir; sayfa bazındaki eski üst sınırlar bu
alanda uygulanmaz. AI ayarları da aynı alanı doldurur. Ayrı eğitim oynatıcısı
ve sınav/onay kartları kendi kullanılabilir alanına genişler. Mobil düzenler
ve modal boyutları korunur.

## CSS

Stiller sorumluluğa göre:

- token
- uygulama kabuğu ve base/layout
- ortak components
- domain modül stilleri
- en son uygulama geneli responsive override'lar

Yeni global selector yerine mümkün olduğunda domain sınıfı kullanılır. CSS
dosyası 1.200 satırı aşmamalıdır. `module-polyvalence*.css` dosyalarında
polivalans namespace'i dışındaki selector'lara izin verilmez.

`!important` bildirimi eklenmez. `check-style-architecture.mjs` sıfır bütçesini
zorunlu tutar; selector özgüllüğü veya katman sırası düzeltilir, bütçe
yükseltilmez.

TSX içinde statik inline stil kullanılmaz. Runtime değer gerekiyorsa değer
doğrulanır veya güvenli aralığa sınırlandırılır, isimlendirilmiş bir
CSS custom property üzerinden domain CSS’ine aktarılır. Onaylı runtime
bağlantıları `check-style-architecture.mjs` allowlist’inde dosya, yardımcı adı
ve adet bazında izlenir. Yeni kullanım eklemek yalnız stil yazmak için değil,
runtime gereksinimi kanıtlandığında kabul edilir.

## İsimlendirme

- JS/TS değişken ve fonksiyon: `camelCase`
- React component ve type/interface: `PascalCase`
- Sabit izin ve event anahtarları: mevcut `snake_case`
- SQL tablo/kolon: `snake_case`
- Environment değişkeni: `UPPER_SNAKE_CASE`

## Commit Öncesi

Değişikliğin kapsamına göre [Test](testing.md) kontrolleri çalıştırılır.
Environment, API, izin, şema veya iş kuralı değiştiyse ilgili doküman aynı
commit'te güncellenir.
