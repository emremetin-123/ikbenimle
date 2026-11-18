# Test ve kalite

Bu belge test komutlarını ve kapsadıkları sınırları açıklar. Geçmiş bir başarılı
çalıştırma, güncel commit'in sonucu değildir; sonuç için CI kaydı veya yerel çıktı kullanılır.

## Hangi değişiklikte ne çalıştırılır?

| Değişiklik | Asgari kontrol |
| --- | --- |
| Backend route, servis veya veri erişimi | `cd backend` ardından `npm test` |
| Frontend bileşeni veya stil | Lint, mimari kontrol, build ve paket boyutu; değişen akışın tarayıcı testi |
| Migration | Backend testleri, boş veritabanında up/status ve iki adaptörün incelenmesi |
| Docker veya CI | İlgili Compose yapılandırması ve image build |
| Oturum, izin veya dosya erişimi | İlgili güvenlik testleri ve erişimi reddetmesi gereken senaryolar |
| Yalnız Markdown | Yerel bağlantılar, komut/dosya adları, kodla uyum ve `git diff --check` |

## Backend

```powershell
cd backend
npm test
```

Node.js `node:test`, test dosyalarını tek concurrency ile çalıştırır. HTTP ve
veri testleri geçici SQLite dosyaları, sürümlü migration'lar ve test verileri
kullanır. Geliştirme seed'i çalıştırılmaz. PostgreSQL'e özel testler
`POSTGRES_TEST_URL` gerektirir; CI bu adresi ayrı PostgreSQL servisiyle sağlar.
Yerelde adres yokken atlanan testler tam PostgreSQL doğrulaması sayılmaz.

Başlıca kapsamlar:

- Oturum, CSRF, izin, girdi doğrulama ve hata sözleşmesi.
- Eğitim modülleri, ilerleme, sınav, sürüm, sertifika ve yeniden atama.
- Polivalans dönem, takvim, görev sahipliği, rapor ve bölüm kapsamı.
- Geri bildirimde yazışma görünürlüğü, atama, karar ve yeniden açma.
- Profil, duygu/yemek, bildirim ve entegrasyon kuralları.
- İşlem günlüğünde erişim, arıza davranışı, koruma ve 180/365 günlük temizlik.
- Mimari sınırlar ve kaynakların UTF-8 denetimi.

## Frontend

`tests/e2e/home-dashboard.spec.ts`, dört ekran boyutunda ana sayfanın
profil bağlantısını, gerçek veri özetlerini, hata durumlarını, erişilebilirliğini,
haber sayfalama/detay ve ekran boyutu değişimini, hatırlatma ekleme/düzenleme/
tamamlama ile özet güncellemesini, günlük duygu ve geri aranma akışını,
yemek puanlarının kaydedilip yeniden açılmasını denetler. API yanıtları
sentetik fixture'lardır; bu testler canlı sunucu veya fiziksel cihaz onayı değildir.

```powershell
cd frontend
npm run lint
npm run check:architecture
npm run build
npm run check:bundle
npm run test:e2e
```

| Komut | Denetim |
| --- | --- |
| `lint` | ESLint |
| `check:architecture` | TSX/CSS satır bütçesi, CSS sırası, polivalans kapsamı, sıfır `!important` ve izinli runtime stilleri |
| `build` | TypeScript ve Vite üretim derlemesi |
| `check:bundle` | İlk yüklenen JS+CSS için 220 KB gzip; JS dosyaları için 150 KB gzip üst sınırı |
| `test:e2e` | Playwright senaryoları; seçili ekranlarda taşma, klavye ve axe kontrolleri |

Playwright yapılandırması `frontend/playwright.config.ts` içindedir. Chromium
375, 768, 1024 ve 1440 piksel genişliklerde çalışır. CI tarayıcıyı ayrıca kurar.
API yanıtları fixture'larla karşılanır; bu testler gerçek backend ile bütünleşik
uçtan uca test veya fiziksel cihaz testi yerine geçmez.

Seçili test dosyaları `frontend/tests/e2e/` altında:

| Dosya | Kapsam |
| --- | --- |
| `ui-smoke.spec.ts` | Giriş, ana sayfa ve temel eğitim/kullanıcı akışları |
| `user-status.spec.ts` | Kullanıcıyı pasife alma/aktifleştirme, onaydan vazgeçme ve salt okunur liste alanlarının güncelleme isteğine taşınmaması |
| `polyvalence.spec.ts`, `polyvalence-compact.spec.ts` | Takvim, bölüm kapsamı, puanlama, modal ve 30×30 değerlendirme düzeni |
| `polyvalence-report-design.spec.ts` | Hedef karşılama/tamamlanma ayrımı, hedef çubukları, filtre ve boş veri |
| `profile-update.spec.ts` | Eğitim kaydı bulunan profilde doğum tarihi ve bedenin korunması |
| `profile-design.spec.ts` | Dört ekran boyutunda profil düzeni ve form erişilebilirliği, rozet toplamı/sayfalama, kayıt hatası/iptal, fotoğraf yenileme ve veri hatasından toparlanma |
| `portrait-layout.spec.ts` | Yatay/dikey fotoğraf ve boş avatarda boyut, dairesel hizalama, kamera oranı/örtüşmesi ve 320px taşma kontrolü |
| `mobile-shell.spec.ts` | Sistem modüllerinde ortak mobil bar, menü, alt navigasyon, erişilebilirlik ve eğitim oynatıcısında geri/menü kontrolleri |
| `session-isolation.spec.ts` | Hesap değişiminde profil/bordro/yazma ayrımı, ağ hatası, gecikmiş profil ve oturum yanıtları, oturum iptali ve harita durak adında HTML engelleme |
| `training-badges.spec.ts`, `training-certificates.spec.ts` | Rozet yükleme, küçük görsel ve ortak sunucu PDF'i |
| `notification-subscribers.spec.ts` | Cihaz listesi, filtre, hata ve gönderim sonucu |
| `audit-logs.spec.ts` | Filtre, CSV, detay, koruma ve admin erişimi |
| `feedback-rejection.spec.ts` | Ret kararının liste, detay ve filtrede gösterimi |
| `module-headers.spec.ts`, `module-widths.spec.ts`, `detail-widths.spec.ts` | Ortak başlık ve içerik genişliği |

Tam liste test klasöründedir. Örneğin yalnız polivalans testlerini çalıştırmak için:

```powershell
cd frontend
npx playwright test tests/e2e/polyvalence.spec.ts
```

## Gerçek API ile yerel geri bildirim önizlemesi

Backend klasöründe `node tests/helpers/feedbackPreview.js` çalıştırılır.
Frontend ayrı terminalde, `VITE_API_BASE=http://127.0.0.1:5190` ortam değişkeniyle
`npm run dev -- --host 127.0.0.1 --port 4187 --strictPort` üzerinden açılır.
`http://127.0.0.1:5190/preview/owner` örnek çalışanı; aynı yoldaki `assignee`,
`participant`, `admin` diğer rolleri açar. Yardımcı sunucu loopback ve geçici
veritabanı kullanır; uygulamaya veya canlı veriye bağlanmaz.

## CI kontrolleri

`.github/workflows/build-and-deploy.yml`, Gitleaks, backend testleri, frontend
kontrolleri, Playwright, bağımlılık denetimi ve ilgili image'lar için Trivy taraması
çalıştırır. Zorunlu adım başarısızsa image yayınlama aşamasına geçilmez.

## Yük ve yedekleme testleri

- Yük profili `performance/k6-smoke.js` içindedir: rutin okumalar, giriş yükü
  ve duygu yanıtı gönderimi. Mevcut profil rapor endpoint'lerini sınamaz.
- Staging workflow'unun `seed_data` adımı PostgreSQL ve doğrulanmış TLS kullanır.
  `loadTest.test.js`, veri hazırlığının tekrar çalıştırılmasını SQLite ve
  `POSTGRES_TEST_URL` varsa PostgreSQL üzerinde sınar; k6 istek alanlarını API
  şemasıyla, günlük tekrar davranışını simüle edilen yanıtlarla kontrol eder.
  Gerçek staging yük koşusu ayrıca [Yük testi rehberi](../performance/README.md)
  üzerinden çalıştırılır.
- `.github/workflows/backup-drill.yml`, geçici MinIO ile SQLite ve PostgreSQL
  yedeğini Restic üzerinden farklı hedefe geri yükler; veri ve upload hash'lerini
  doğrular. Bu, gerçek üretim yedeğinden yapılmış tatbikatın yerini tutmaz.

## Bordro entegrasyonu

ERP simülasyonu için backend klasöründe node --test tests/integrations.test.js tests/payroll-integration.test.js çalıştırılır. Geçici SQLite ve örnek PDF kullanır; gerçek HTTP üzerinden çalışan/bakiye, izin kuyruğu hata ve yeniden deneme, bordro yükleme, tekrar/revizyon, eşzamanlılık, izin/sahiplik, dosya indirme ve işlem geri alma sınanır. Gerçek ERP ürün adaptörü doğrulanmış sayılmaz.

Gerçek arayüz + gerçek API testi için frontend klasöründe `npx playwright test --config playwright.payroll.config.ts` çalıştırılır. Ayrı test sunucuları 4188/5191 portlarını ve geçici veritabanını kullanır. ERP isteğiyle yüklenen PDF, gerçek Bordrolarım ekranından indirilir; mobil taşma ve başka çalışan erişimi kontrol edilir. Bu yardımcı sunucu yalnız loopback üzerinde çalışır ve üretim uygulamasına eklenmez.
