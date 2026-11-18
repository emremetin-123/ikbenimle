# Güvenlik

Polivalans raporlarıyla birlikte dönem tarihçesi de sunucuda bölüm kapsamına
göre sınırlandırılır. `view_polyvalence_reports` sahibi employee yabancı
bölümün rapor, CSV ve tarihçesine doğrudan kimlik belirterek erişemez.
Görev detayları ve puan mutasyonları ayrıca değerlendirici sahipliğini denetler.

## Uygulanan Kontroller

### Kimlik ve Oturum

- bcrypt parola hash'i
- Veritabanı destekli, hash saklanan opaque session token
- HttpOnly, Secure production cookie ve SameSite Lax
- Mutasyonlarda sunucu oturumuna bağlı CSRF token doğrulaması
- Tek hesap/tek aktif session
- Idle ve absolute timeout
- Kalıcı login guard ve IP rate limit
- Security audit event kayıtları

### API

- Eğitim rozet yüklemesi `manage_education` ve mevcut CSRF korumasını kullanır.
  Tek görsel, 10 MB, MIME/uzantı ve dosya imzası doğrulanır. İstemcinin URL
  alanına güvenilmez; korunacak görsel veritabanından alınır. Rehber için yalnız
  aktif çalışanın tamamladığı, rozet açık eğitimdeki rozet görseli oturum açmış
  diğer kullanıcılara açılır; video/içerik dosyaları bu istisnaya dahil değildir.

- CORS origin allowlist
- Express rate limit
- Zod kullanılan route'larda strict input doğrulama
- Geri bildirim, chatbot, AI ayarları, eğitim ilerleme/sınav/yönetim, belge
  talepleri, duyuru/haber, kullanıcı yönetimi ve polivalans rapor
  mutasyonlarında strict Zod şemaları
- Ortak hata sözleşmesi ve production stack/SQL gizleme
- Parametreli SQL ve allowlist sıralama
- AI ve public sertifika endpoint'lerinde özel rate limit
- Metrics varsayılan kapalı, etkinse bearer token zorunlu
- ERP makine API'sinde hash saklanan scoped opaque anahtar, opsiyonel IP
  allowlist, ayrı rate limit ve mutasyon idempotency kontrolü

### Tarayıcı ve Proxy

- Caddy TLS ve HSTS
- Nginx CSP, frame deny, nosniff, referrer ve permissions policy
- Backend `X-Powered-By` kapalı
- Session token web storage'a yazılmıyor
- Same-origin API proxy
- QueryClient ve ekran state'i oturum kapsamına özeldir; çıkış/oturum iptalinde
  sorgular iptal edilir, önceki önbellek temizlenir. Eski oturum yanıtları yeni
  girişi geri getiremez veya düşüremez.
- Servis haritası durak adlarını Leaflet'e `textContent` üzerinden aktarır;
  adlar HTML olarak yorumlanmaz.

Express'te CSP kapalıdır çünkü production CSP Nginx tarafından verilir. Backend
doğrudan public portta yayınlanmamalıdır.

Production IP kaynağı Caddy'nin bağlantı adresidir. Caddy dışarıdan gelen
`X-Forwarded-For` değerlerini yok sayar, Nginx kendi önündeki adresi zincire
ekler. Express iki ara sunucuya göre istemciyi belirler. Bu IP hem günlüklerde
hem de IP bazlı erişim ve hız sınırlarında kullanılır. Nginx'e ya da backend'e
kısa bir dış erişim yolu açılması bu güven varsayımını bozar.

### Dosya ve Container

- Upload boyut/MIME/uzantı/imza kontrolü
- Upload endpoint'lerinde session, izin ve nesne sahipliği
- Yerel upload'lar public static klasör değil
- Geri bildirim yorum ekleri yalnız yorumun görünürlüğünü denetleyen kimlikli
  API üzerinden `private, no-store` ile indirilir. Genel yükleme adresi ve
  harici medya depolaması üzerinden erişime açılmaz.
- Avatar küçük görselleri `private, no-cache` ve ETag ile saklanabilir;
  her yeniden kullanımda oturum kontrolünden sonra doğrulanır. Rozet
  önizlemeleri de aynı oturum/nesne kontrolü ve ETag modelini kullanır. Orijinal
  dosyalar `private, no-store` kullanmayı sürdürür. Avatar dönüştürme yalnız
  avatar dizinindeki dosyalarda, 160/320 px ve 36 milyon giriş pikseli sınırıyla
  yapılır; bellek önbelleği en fazla 128 küçük görsel tutar. Rozet önizlemeleri
  ayrı 128 öğelik önbellekte, 256px içine kırpılmadan sığdırılarak saklanır;
  yalnız veritabanında rozet olarak bağlı dosyalarda çalışır. Giriş pikseli
  sınırı aynıdır. İki önbellek de oturum/nesne yetkisini saklamaz veya atlamaz.
- Read-only filesystem, non-root process, capability drop
- Gitleaks, dependency audit ve Trivy CI kapıları
- Pino hassas header/alan redaksiyonu

### Veri ve Yedek

- Harici PostgreSQL bağlantısında doğrulanmış TLS kullanılmalıdır. Mevcut
  Compose iç ağ bağlantısı `DB_SSL=false` kullanır; TLS uygulandığı varsayılmaz.
- Restic veriyi VPS'den çıkmadan şifreler.
- Restore production hedefinin üzerine yazmayı reddeder.
- Uygulama, migration ve backup DB hesapları ayrılabilir.

PostgreSQL volume'unun disk şifrelemesi, hesap yetkileri ve gerçek off-site
backup başarısı repository kodundan kanıtlanamaz. Production kabulünde
[Üretim veri koruma kontrolü](data-protection-checklist.md) uygulanmalıdır.

## Kişisel Veri Davranışı

- Telefon, adres ve doğum tarihi uygulama seviyesinde kolon şifrelemesi
  kullanmaz.
- Duygu yanıtı `anonymous_mood_checks` tablosunda kullanıcı veya sicil alanı
  olmadan saklanır. Sunucuda katılım makbuzu tutulmaz; cihaz başına günlük tekrar
  kontrolü yalnız HttpOnly tarih çereziyle yapılır.
- Geri aranma talebi ayrı kimlikli tabloda tutulur; duygu, sebep veya anonim yanıt
  kimliği taşımaz.
- Geri bildirim çalışan liste ve detay yanıtlarında `decision_note` bulunmaz;
  çalışan thread geçmişindeki serbest notlar da döndürülmez (eski kayıtlar dahil).
  Sahip yalnız açık yorumları, atanmış sorumlu/katılımcı ise ekip içi görüşleri de
  görebilir. Bu ayrım arayüzde gizlemeye değil servis/repository kapsamına dayanır.
  Kaldırılan katılımcının erişimi kesilir; atamalar yalnız aktif kullanıcılarla yapılır.
- Departman-gün kohortu yapılandırılan anonimlik eşiğinin altındaysa rapor,
  export ve AI analizine dahil edilmez.
- Korumalı upload erişimi nesne bazında kontrol edilir.
- ERP audit kaydı payload yerine işlem, durum ve toplu sonuç sayıları tutar;
  API anahtarının açık değeri loglanmaz veya tekrar görüntülenmez.

Genel işlem ve oturum günlüğünde 180/365 günlük sınıflı saklama, koruma ve
günlük temizlik politikası vardır; ayrıntılar [Log Kayıtları](audit-logs.md).
Bu politika asıl iş kayıtlarının veya yedeklerin bütün KVKK süreçlerini kapsamaz.
Log başlangıcı yazılamayan korumalı işlem engellenir; sonucu yazılamayan olay
başarıya çevrilmez. Admin dışına liste/detay/export açılmaz. Raw payload, parola,
cookie, token veya anonim yanıt içeriği genel günlüğe alınmaz. Olay düzenleme ve
manuel silme API'si yoktur; ayrıcalıklı DB erişimi için WORM garantisi verilmez.

## Açık Riskler

3 Kasım 2026 yerel incelemesinde kullanıcı yöneticisinin admin pasifleştirebilmesi,
doğrudan backend dosya erişiminde yol normalleştirme farkı ve Cloudinary hassas
ek teslimatında koşullu erişim riski belirlendi. Kanıt, üretim etkisinin sınırları
ve kapanış koşulları [Bilinen sorunlar](known-issues.md) içinde tutulur. Upload
kontrollerine ilişkin yukarıdaki açıklamalar bu istisnalarla değerlendirilmelidir.

Bağımlılıkların güvenlik durumu kilit dosyası ve güncel CI taramasıyla
izlenir. Geçmiş bir `npm audit` sonucu sonraki sürümler için güvence değildir.

- Body almayan işlemler ve dosyanın kendisini doğrulayan upload middleware'leri
  dışında dış girdili kritik mutation route'ları ortak Zod middleware'ini
  kullanır. Yeni route'larda bu standardın korunması gerekir.
- MFA, SSO ve kullanıcı tarafından parola sıfırlama akışı yoktur.
- Public health endpoint'leri sınırlı operasyon durumunu açığa çıkarır.
- Root seviyesinde ürün lisansı ve resmi veri saklama politikası yoktur.

Özellik eksikleri [Geliştirme konuları](improvements.md), üretim kontrolleri [Veri koruma kontrolü](data-protection-checklist.md) içindedir.

## Secret Rotasyonu

Aşağıdaki olaylarda ilgili secret değiştirilir ve session'lar revoke edilir:

- repository veya log sızıntısı
- VPS/CI hesabı ihlali
- çalışan ayrılığı veya yetki değişimi
- VAPID/Gemini/Cloudinary/S3 anahtarının yetkisiz görülmesi
- DB hesabı şüphesi

VAPID private key değişikliği mevcut push aboneliklerinin yeniden kurulmasını
gerektirebilir.

## Bordro entegrasyonu

Bordro makine API’si payrolls:write kapsamını upload başlamadan denetler. Yalnız eşleştirilmiş çalışan kabul edilir. Tek PDF için 20 MB, MIME, uzantı ve imza kontrolü uygulanır. PDF dosyaları public cloud URL yerine korumalı yerel documents yolunda saklanır. Sahiplik ve manage_documents erişimi mevcut upload middleware ile denetlenir.
