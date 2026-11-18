# Dağıtım

## Production Modeli

Production, tek VPS üzerinde Docker Compose ile çalışır. Kaynak kod sunucuya
kopyalanmaz; backend, frontend ve backup image'ları GitHub Container
Registry'den commit SHA etiketiyle çekilir.

Sunucu yerleşimi workflow tarafından `/opt/ikbenimle` olarak kabul edilir:

```text
/opt/ikbenimle/docker-compose.prod.yml
/opt/ikbenimle/Caddyfile
/opt/ikbenimle/backend/.env
/opt/ikbenimle/ops/backup/.env.backup
/opt/ikbenimle/secrets/restic_password
/opt/ikbenimle/.last-successful-release
/opt/ikbenimle/.last-successful-frontend-release
/opt/ikbenimle/.release.env
```

Secret dosyaları Git'e girmez ve group/other tarafından okunamaz olmalıdır.

## CI/CD Akışı

`.github/workflows/build-and-deploy.yml`:

1. Değişiklik kapsamını sınıflandırır.
2. Gitleaks, test, lint, build, bundle ve dependency audit çalıştırır.
3. Image'ları build eder ve Trivy ile tarar.
4. Image'ları commit SHA etiketiyle GHCR'a yollar.
5. GitHub `production` environment kurallarını uygular; reviewer tanımlıysa
   onay bekler, ardından VPS'e bağlanır.
6. Production preflight çalıştırır; `REQUIRE_OFFSITE_BACKUP=true` ise off-site
   backup'ı dağıtım ön koşulu olarak doğrular ve çalıştırır.
7. Migration container'ını çalıştırır.
8. Uygulama servislerini yeni image ile açar.
9. Readiness ve CSP smoke testlerini yapar.
10. Başarısızlıkta `.last-successful-release` image'ına döner.

Yalnız frontend değiştiğinde workflow frontend image'ını günceller;
migration ve backend/worker yeniden dağıtımı yapmaz. Bu dal ana sayfa ile
readiness'i kontrol eder; tam dağıtım dalındaki ayrı CSP kontrolünü çalıştırmaz.
Son başarılı frontend etiketi `.last-successful-frontend-release` içinde tutulur.

## GitHub Yapılandırması

Gerekli secret/variable adları workflow dosyasından yönetilir. Başlıca değerler:

- VPS host, kullanıcı, port ve SSH private key
- GHCR için read yetkili deployment token
- production deployment'ını açan environment variable

Gerçek değerler dokümana veya repository dosyasına yazılmaz. Production
environment için required reviewer ayarı GitHub üzerinde doğrulanmalıdır;
bu ayarın etkinliği depo dosyalarından anlaşılamaz.

## Migration ve Uyum

- Production'da şema yazma yetkisi migration hesabıyla sınırlandırılmalıdır.
  Compose'taki ayrı hesap değişkenleri opsiyoneldir; yetki ayrımı DB grant'larıyla doğrulanır.
- Boş production veritabanı dahil bütün kurulumlar `000_initial_schema` ile
  başlayan aynı sürümlü migration zincirini kullanır.
- API ve worker bağlantı açarken tablo oluşturmaz, legacy upgrade veya seed
  çalıştırmaz.
- Uygulama ve worker bekleyen migration ile başlamaz.
- Migration için `MIGRATION_DB_USER` ve `MIGRATION_DB_PASSWORD` kullanılabilir.
- Migration önceki image ile uyumlu expand-contract yaklaşımında olmalıdır.
- Destructive down yalnız doğrulanmış yedek ve açık izinle çalıştırılır.

Boş production veritabanında migration sonrasında ilk yönetici hesabı
`npm run bootstrap:admin` ile oluşturulur. Komut yalnız `users` tablosu tamamen
boşken, `ALLOW_INITIAL_ADMIN_BOOTSTRAP=true` ve en az 12 karakterli geçici parola
ile çalışır. İşlemden sonra bootstrap değişkenleri production environment
dosyasından kaldırılır.

## Sağlık Kontrolleri

- `GET /health/live`: process canlı
- `GET /health/ready`: veritabanına erişilebilir
- `GET /health/backup`: son doğrulanmış yedek 36 saatten yeni
- CSP: production Nginx header'ı

`.github/workflows/production-health.yml` readiness, backup health ve CSP'yi
15 dakikada bir kontrol eder. Backup health kontrolü yalnız GitHub repository
variable `REQUIRE_OFFSITE_BACKUP=true` olduğunda zorunludur. Harici yedek
yapılandırılana kadar bu değer `false` kalabilir; bu durumda deploy öncesi yerel
upload snapshot'ı alınır fakat VPS kaybına karşı koruma sağlanmaz.

## Geri Dönüş

Tam dağıtım başarısızlığında workflow `.last-successful-release` etiketini;
yalnız frontend dağıtımında ayrı frontend etiketini kullanır.
Veritabanı değişikliği image rollback ile otomatik geri alınmaz. Schema
rollback ancak uyumlu down migration ve doğrulanmış yedek varsa yapılır.

Operasyon adımları için [Production Runbook](production-runbook.md) kullanılır.

## İşlem günlüğü dağıtımı

Log Kayıtları dağıtımı `024_application_audit_logs` migration'ını ve backend ile
worker'ın birlikte güncellenmesini gerektirir; yalnız frontend dağıtımı yeterli
değildir. Başlangıçta migration bekleyen servis hazır sayılmaz. Worker günlük
log temizliğini çalıştırır; modüldeki son başarılı kontrol/36 saat gecikme bilgisi
izlenmelidir. Önceki yedekler geriye dönük değişmez; yedekten dönüşte uygulama
dışarı açılmadan saklama politikası tekrar uygulanmalıdır. Sabit 180/365 günlük
log politikası için yeni bir ortam değişkeni gerekmez.

## Staging Yük Testi

Staging yük testi ayrı `Staging Load Test` workflow'u ile çalıştırılır.
`seed_data=true`, test verilerini PostgreSQL üzerinde sürümlü migration'larla
hazırlar; bağlantı TLS ve sertifika doğrulaması kullanır. Gerekli staging
secret/variable listesi ve k6 günlük duygu davranışı
[Yük testi rehberi](../performance/README.md) içindedir.

## Sunum Verisi Operasyonu

GitHub Actions içindeki `Manage Presentation Data` workflow'u production
ortamında elle `seed` veya `clean` seçilerek çalıştırılır. Workflow son başarılı
backend image'ını tek seferlik container olarak açar ve
`ALLOW_PRESENTATION_DATA=true` onayını yalnız bu işlem için verir.

- `seed`: geri alınabilir sunum içeriklerini bir kez ekler; tekrar çalıştırma
  kayıt çoğaltmaz.
- `clean`: manifestteki sunum kayıtlarını ve bu menülere sonradan verilen yemek
  değerlendirmelerini kaldırır; diğer içeriklere dokunmaz.

Sunum verisi migration veya normal deploy sırasında otomatik üretilmez.

## Alan Adı ve TLS

Caddy production alan adları için TLS sertifikasını yönetir, HSTS uygular ve
frontend Nginx'e proxy eder. Mevcut `Caddyfile` belirli production alan adını
içerir; başka ortama kurulumda alan adı ve TLS iletişim adresi açıkça
değiştirilmelidir.

Production'da API yolu Caddy → frontend Nginx → backend şeklindedir.
Compose backend için `TRUST_PROXY_HOPS=2` tanımlar. Yalnız Caddy'nin portları
dışarı açılır. Nginx veya backend'i doğrudan yayınlamayın. Farklı bir ağ
yerleşiminde değer, istemcinin erişebildiği en kısa güvenilir yola göre
ayarlanmalıdır.

## Şirket Sunucusuna Taşıma

Aynı immutable image'lar yeni Docker host'a kurulabilir. Taşınması gerekenler:

- production environment/secret'ları, yeni ortamda yeniden tanımlanarak
- upload volume veya restore edilmiş object verisi
- hedef PostgreSQL'e uygulanmış migration'lar ve doğrulanmış veri aktarımı
- Caddy alan adı/TLS yapılandırması
- doğrulanmış backup ve restore kaydı
