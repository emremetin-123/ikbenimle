# Üretim operasyon rehberi

Dağıtım akışı [Dağıtım](deployment.md), yedek komutları
[Yedekleme](../ops/backup/README.md), hata teşhisi [Sorun Giderme](troubleshooting.md)
belgesindedir. Buradaki adımlar sunucunun `/opt/ikbenimle` dizinini esas alır.

## Sağlık kontrolü

| Kontrol | Beklenen sonuç |
| --- | --- |
| `GET /health/ready` | Veritabanına erişim varsa 200 |
| `GET /health/backup` | Son durum başarılı ve en fazla 36 saatlikse 200; eksik, hatalı veya eskiyse 503 |
| Ana sayfa yanıt başlıkları | Nginx tarafından verilen CSP |
| `/internal/metrics` | Varsayılan kapalı; açıksa ayrı bearer token gerekli |

GitHub `REQUIRE_OFFSITE_BACKUP=true` ayarı uzak yedeği dağıtım ve izleme koşulu
yapar. Ayar kapalıyken alınan yerel upload snapshot'ı veritabanı yedeği veya
VPS kaybına karşı koruma sayılmaz. Bu ayar yedek endpoint'inin anlamını değiştirmez.

## Yedek başarısızlığı

1. `systemctl status ikbenimle-backup.service` ve journal çıktısını inceleyin.
2. S3 erişimini, Restic parola mount'unu, DB hesabını ve webhook'u kontrol edin.
3. Servisi elle çalıştırıp `/health/backup` sonucunu yeniden doğrulayın.
4. Uzak yedek başarılı olmadan yerel dağıtım snapshot'larını silmeyin.

## Geri yükleme tatbikatı

1. Kaynaktan farklı, boş bir veritabanı veya farklı bir SQLite yolu hazırlayın.
2. Seçilen snapshot'ı yedekleme rehberindeki komutla bu hedefe yükleyin.
3. Tablo kayıt sayılarını ve `uploads.sha256` doğrulamasını kontrol edin.
4. Tarihi, snapshot kimliğini, işlemi yapan kişiyi ve sonucu kaydedin.

`RESTORE_DB_NAME=DB_NAME` veya `RESTORE_SQLITE_PATH=SQLITE_FILENAME` kullanılmaz.
Üretime geri dönüşte saklama/silme politikası, uygulama erişime açılmadan önce
ayrıca uygulanmalıdır; eski yedekler sonradan yapılan silmeleri içermez.

## Sürüm geri alma

1. Tam sürüm için `.last-successful-release`, yalnız frontend için
   `.last-successful-frontend-release` değerini okuyun. Frontend kaydı yoksa
   tam sürüm etiketi kullanılır.
2. Doğrulanmış etiketi `IMAGE_TAG` olarak verip ilgili servisleri Compose ile açın.
   Yalnız frontend geri alınıyorsa `up -d --no-deps frontend` kullanın ve Caddy'yi yeniden başlatın.
3. Readiness, ana sayfa ve ilgili oturumlu iş akışlarını kontrol edin.
4. Veritabanı şemasını image geri alma işlemiyle geri alınmış saymayın.
   Şema geri alma, uyumlu down migration ve doğrulanmış yedek gerektirir.

## Güvenlik olayı

1. Etkilenen oturumları iptal edin ve ilgili kimlik bilgilerini değiştirin.
2. Uygulama ve proxy loglarını koruyun; gerekiyorsa günlük kayıtlarına saklama koruması koyun.
3. Veri erişimi sürüyorsa dış erişimi kısıtlayın.
4. İstek kimliklerini, zaman aralığını, etkilenen hesapları ve yapılan işlemleri kaydedin.
