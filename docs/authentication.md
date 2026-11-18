# Kimlik Doğrulama

## Model

Sistem JWT kullanmaz. Authentication, veritabanında tutulan opaque session
token'ına dayanır.

Login akışı:

1. Kullanıcı sicil numarası ve parolasını `POST /api/login` ile gönderir.
2. Parola `bcryptjs` ile kayıtlı hash'e karşı doğrulanır.
3. 32 byte rastgele session ve CSRF token üretilir.
4. Token'ların yalnız SHA-256 hash'leri `auth_sessions` tablosuna yazılır.
5. Session token HttpOnly cookie, CSRF token JavaScript tarafından okunabilen
   ayrı cookie olarak gönderilir.
6. Kullanıcının önceki aktif session'ları revoke edilir.

Bu son adım nedeniyle bir hesapta aynı anda tek aktif oturum vardır; yeni login
eski cihazın oturumunu geçersiz kılar.

## Cookie'ler

| Cookie | Özellik |
| --- | --- |
| Production session | Varsayılan `__Host-ikbenimle_session` |
| Development session | Varsayılan `ikbenimle_session` |
| CSRF | `ikbenimle_csrf` |

Session cookie `HttpOnly`, production'da `Secure`, `SameSite=Lax` ve `Path=/`
özelliklerini kullanır. CSRF cookie HttpOnly değildir; diğer güvenlik
özellikleri aynıdır.

## Oturum Süreleri

- Idle süre: varsayılan 30 dakika
- Mutlak süre: varsayılan 8 saat
- Kapanış uyarısı: varsayılan 30 saniye
- Son görülme güncelleme aralığı: 1 dakika

Passive kullanıcı, revoke edilmiş session ve süresi dolmuş session kabul
edilmez. Frontend odak, `pageshow` ve görünürlük değişimlerinde `/api/session`
ile kontrol yapar. Login ve session yanıtındaki `session_policy`, istemcinin
idle ve uyarı sayaçlarını backend yapılandırmasıyla eşler. Aktif kullanıcı
etkileşiminde en fazla dakikada bir session kontrolü yapılır.

Logout önce yerel kullanıcı durumunu kapatır ve sunucu session'ını revoke eder.
Ağ hatasında çıkış niyeti `localStorage` içinde hassas veri içermeyen bir işaret
olarak tutulur. Uygulama yeniden açıldığında veya bağlantı geldiğinde logout
tamamlanmadan mevcut cookie ile session geri yüklenmez.

İstemcinin oturum kapsamına özel sorgu önbelleği ve gecikmiş oturum yanıtlarını
ayıklama davranışı [Frontend](frontend.md#veri-erişimi) rehberinde açıklanır.

## CSRF

`GET`, `HEAD` ve `OPTIONS` dışındaki authenticated istekler
`X-CSRF-Token` göndermek zorundadır. Middleware header değerinin hash'ini
veritabanındaki değerle timing-safe şekilde karşılaştırır.

Frontend `secureFetch.ts` bu header'ı otomatik ekler. Yeni HTTP istemcisi veya
doğrudan `fetch` kullanımı bu davranışı korumalıdır.

## Login Koruması

`auth_login_guards` tablosu hesap ve IP değerlerinin hash'leriyle başarısız
denemeleri tutar:

- 15 dakika içinde 10 başarısız hesap denemesi
- 30 dakika kilit
- IP için ayrıca yapılandırılabilir rate limit
- Başarılı login sonrası yalnız hesap guard temizliği; ortak IP geçmişi korunur
- Kullanıcının varlığını veya kilit durumunu açığa çıkarmayan genel hata

Login, logout, expiry ve güvenlik olayları `security_audit_events` tablosuna
kaydedilir.

## Parola Saklama

Kullanıcı parolaları bcrypt hash olarak saklanır. Seed kodunda cost 10
kullanılır. Düz metin parola veritabanına veya loga yazılmamalıdır.

TODO: Kod tabanında kullanıcı tarafından işletilen parola değiştirme/sıfırlama,
MFA veya kurumsal SSO akışı bulunmamaktadır.

## Makine Kimlik Doğrulaması

ERP connector istekleri tarayıcı session'ı veya JWT kullanmaz. Yönetim
ekranında üretilen `ikp_` önekli opaque API anahtarı Bearer header ile
gönderilir. Veritabanında yalnız SHA-256 hash, kısa önek, kapsamlar, opsiyonel
son kullanma tarihi ve IP allowlist tutulur. Açık anahtar yalnız oluşturulduğu
anda bir kez gösterilir.

Makine sözleşmesi [Entegrasyonlar](integrations.md) belgesindedir.
