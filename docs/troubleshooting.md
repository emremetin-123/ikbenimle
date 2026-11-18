# Sorun Giderme

Komutlar üretim sunucusunda `/opt/ikbenimle` altında çalıştırılır. Compose
komutlarından önce `IMAGE_TAG`, incelenen veya çalışan sürüm etiketiyle ortamda
tanımlı olmalıdır. Sürüm kaydı için [Üretim operasyon rehberi](production-runbook.md) kullanılır.

## Siteye Ulaşılamıyor

`ERR_CONNECTION_REFUSED` uygulama hatasından önce VPS/proxy seviyesini gösterir:

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail 200 caddy
docker compose -f docker-compose.prod.yml logs --tail 200 frontend
curl -I -H "Host: ikbenimle.com" http://127.0.0.1/health/live
```

80/443 portları, VPS firewall, DNS A kaydı ve Caddy sertifika logları kontrol
edilir. Container'ı yalnız yeniden başlatmak yerine kapanma nedeni kaydedilir.

## Backend Başlamıyor

```bash
docker compose -f docker-compose.prod.yml logs --tail 200 backend
docker compose -f docker-compose.prod.yml run --rm migration \
  node scripts/migrate.js status
```

Sık nedenler:

- eksik/zayıf production environment
- veritabanı bağlantısı
- bekleyen migration
- secret dosya izni
- production'da izin verilmeyen SQLite

## Login Olmuyor

- `/health/ready` başarılı mı kontrol edin.
- Kullanıcı `status` değerinin `active` olduğunu doğrulayın.
- Çok sayıda başarısız deneme sonrası 30 dakikalık hesap guard'ı oluşabilir.
- Yeni cihazdan login eski aktif session'ı sonlandırır.
- Tarayıcı cookie engeli veya yanlış `Secure`/alan adı yapılandırmasını kontrol
  edin.

Kullanıcıya hesap varlığı veya kilit ayrıntısı gösterilmez; backend audit
event'i ve request ID ile inceleme yapılır.

## 401 veya 403

- `401 SESSION_EXPIRED`: tekrar login gerekir.
- `403 CSRF_VALIDATION_FAILED`: sayfayı yenileyip güncel CSRF cookie alın.
- `403 PERMISSION_REQUIRED`: backend izin listesini kontrol edin.
- Nesneye özel 403: kullanıcı kayıt sahibi, katılımcı veya ilgili yönetici
  değildir.

## Migration Hatası

- Uygulama ve migration `DB_TYPE` değerleri aynı olmalıdır.
- Migration hesabının schema yetkisi olmalıdır.
- Checksum değişmiş eski migration dosyası düzenlenmemelidir; yeni migration
  eklenir.
- Destructive down yalnız backup sonrası ve açık environment onayıyla yapılır.

## Upload Açılmıyor

- Kullanıcının nesne erişimini kontrol edin.
- `backend_uploads` volume'unun backend ve frontend'e doğru bağlandığını
  doğrulayın.
- `X_ACCEL_REDIRECT_ENABLED` ve Nginx internal alias eşleşmelidir.
- Dosyanın MIME, uzantı veya signature kontrolünde reddedilip reddedilmediğine
  request ID ile bakın.

## Push Bildirimi Gelmiyor

- HTTPS ve tarayıcı site bildirim izni gerekir.
- Kullanıcı `/api/notifications/subscribe` ile kayıtlı olmalıdır.
- VAPID public/private key çifti ve subject birlikte doğru olmalıdır.
- Scheduler yalnız worker'da açık olmalıdır.
- Key rotasyonu sonrası aboneliği kaldırıp yeniden etkinleştirin.

iOS/PWA davranışı cihaz ve tarayıcı sürümüne bağlıdır; depoda native push
uygulaması yoktur.

## Gemini Hatası

- `GEMINI_API_KEY` yalnız backend'de tanımlı olmalıdır.
- AI Ayarları'ndaki bağlantı göstergesi yalnız anahtarın varlığını bildirir;
  geçerlilik, kota veya Google erişim izni testi değildir. Sohbet botu anahtarı
  PDF analizini açıp kapatmaz; model ayarı ortaktır.
- PDF ve metin analizinde güvenli hata mesajları geçersiz/engellenmiş anahtar,
  izin reddi, kota, bulunamayan model ve hatalı istek durumlarını ayırır.
  Provider hata gövdesi PDF `raw_text` alanına aktarılmaz; secret veya belge
  içeriğinin hata üzerinden geri yansıtılması önlenir. HTTP kodu mesajda kalır.
- Upload PDF imza ve boyut kontrollerinden geçmiş olmalıdır.

## Backup Health 503

```bash
systemctl status ikbenimle-backup.timer
systemctl status ikbenimle-backup.service
journalctl -u ikbenimle-backup.service --since today
```

S3, Restic parola dosyası, backup DB hesabı ve webhook kontrol edilir. Manuel
başarılı yedekten sonra `/health/backup` 200 dönmelidir.

## Görsel/Metin Bozukluğu

Kaynak dosyanın UTF-8 olduğunu ve yaygın mojibake başlangıç karakterlerini
içermediğini kontrol edin. Bu denetim backend test paketine dahildir:

```powershell
cd backend
npm test
```

Metin yalnız görünümde düzeltilmemeli; kaynak string doğru UTF-8 ile
değiştirilmelidir.
