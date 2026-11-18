# Ortam Değişkenleri

Gerçek değerler `.env`, GitHub Environment secrets veya sunucudaki izinleri
kısıtlı secret dosyalarında tutulur. Bu dokümandaki örnekler placeholder'dır.

## Uygulama

| Değişken | Amaç | Varsayılan/not |
| --- | --- | --- |
| `NODE_ENV` | Runtime ortamı | `development` |
| `PORT` | Backend portu | `5000` |
| `TRUST_PROXY_HOPS` | Express'in güveneceği ara sunucu sayısı, `0`, `1` veya `2` | `1`, production Compose için `2` |
| `CORS_ORIGINS` | Virgülle ayrılmış origin allowlist | Kodda production ve local fallback var |
| `PUBLIC_APP_URL` | Sertifika/link gibi public URL | Production'da zorunlu |
| `LOG_LEVEL` | Pino seviyesi | `info` |
| `API_RATE_LIMIT_5M` | IP başına 5 dakikalık API limiti | `30000` |
| `LOGIN_IP_RATE_LIMIT_15M` | IP başına login limiti | `500` |
| `SLOW_QUERY_MS` | Yavaş sorgu eşiği | `500` |
| `INTEGRATION_RATE_LIMIT_PER_MINUTE` | API anahtarı başına makine API limiti | `600` |
| `INTEGRATION_BALANCE_STALE_HOURS` | İzin bakiyesinin eski sayılacağı süre | `36` |
| `X_ACCEL_REDIRECT_ENABLED` | Korumalı dosyayı Nginx ile sun | Compose'ta `true` |

## Veritabanı

| Değişken | Amaç |
| --- | --- |
| `DB_TYPE` | Runtime için `postgres`; izole test için `sqlite` |
| `DATABASE_URL` | Opsiyonel PostgreSQL bağlantı URL'si |
| `SQLITE_FILENAME` | SQLite dosya yolu |
| `ALLOW_PRODUCTION_SQLITE` | Production SQLite için açık risk onayı |
| `DB_SERVER`, `DB_PORT` | PostgreSQL host ve port |
| `DB_NAME` | Veritabanı |
| `DB_USER` | Uygulama DB hesabı |
| `DB_PASSWORD` | Uygulama DB parolası |
| `DB_SSL` | PostgreSQL TLS bağlantısını etkinleştirir |
| `DB_SSL_REJECT_UNAUTHORIZED` | PostgreSQL sertifika doğrulaması |
| `DB_SSL_CA` | Opsiyonel CA PEM içeriği |
| `DB_POOL_MAX` | Connection pool üst sınırı |
| `DB_POOL_IDLE_MS` | Boş bağlantı süresi |
| `DB_CONNECTION_TIMEOUT_MS` | Bağlantı timeout |
| `DB_REQUEST_TIMEOUT_MS` | Sorgu timeout |
| `MIGRATION_DB_USER` | Ayrı schema migration hesabı |
| `MIGRATION_DB_PASSWORD` | Migration hesabı parolası |
| `ALLOW_DESTRUCTIVE_MIGRATION` | Destructive down için açık onay |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | PostgreSQL container ilk kurulumu |

## Oturum ve başlangıç verisi

| Değişken | Amaç | Varsayılan |
| --- | --- | --- |
| `SESSION_IDLE_MINUTES` | Hareketsizlik süresi | `30` |
| `SESSION_ABSOLUTE_HOURS` | Mutlak session süresi | `8` |
| `SESSION_WARNING_SECONDS` | Idle kapanış uyarısının süresi | `30` |
| `MOOD_ANONYMITY_THRESHOLD` | Duygu raporunda gösterilecek en küçük departman-gün kohortu; en az `3` uygulanır | `3` |
| `SESSION_COOKIE_NAME` | Opsiyonel özel cookie adı | Ortama göre seçilir |
| `SEED_DEFAULT_USERS` | Varsayılan kullanıcı seed'i | `false` |
| `SEED_SAMPLE_DATA` | Örnek domain verisi | `false` |
| `DEFAULT_ADMIN_PASSWORD` | Admin seed parolası | Seed açıksa zorunlu |
| `DEFAULT_EMPLOYEE_PASSWORD` | Örnek employee seed parolası | Örnek çalışan üretilecekse zorunlu |
| `ALLOW_INITIAL_ADMIN_BOOTSTRAP` | Boş veritabanında tek seferlik production admin oluşturma izni | `false` |
| `INITIAL_ADMIN_EMPLOYEE_ID` | İlk yöneticinin sicil/kullanıcı adı | Bootstrap sırasında zorunlu |
| `INITIAL_ADMIN_NAME` | İlk yöneticinin görünen adı | Bootstrap sırasında zorunlu |
| `INITIAL_ADMIN_PASSWORD` | İlk yöneticinin en az 12 karakterli geçici parolası | Bootstrap sonrasında kaldırılır |

## AI ve Dosya Depolama

| Değişken | Amaç |
| --- | --- |
| `GEMINI_API_KEY` | Gemini server-side anahtarı |
| `GEMINI_MODEL` | Kullanılacak model |
| `GOOGLE_API_KEY` | Legacy Gemini anahtar fallback'i |
| `CLOUDINARY_CLOUD_NAME` | Opsiyonel Cloudinary hesabı |
| `CLOUDINARY_API_KEY` | Cloudinary API anahtarı |
| `CLOUDINARY_API_SECRET` | Cloudinary secret |
| `TRAINING_PROGRESS_ENFORCEMENT` | Eğitim izleme doğrulaması: `enforce` (varsayılan) veya geçici `observe` |

`GOOGLE_API_KEY` yeni kurulumlarda kullanılmamalı; `GEMINI_API_KEY` tercih
edilmelidir.

## Push ve Scheduler

| Değişken | Amaç |
| --- | --- |
| `VAPID_PUBLIC_KEY` | Web Push public key |
| `VAPID_PRIVATE_KEY` | Web Push private key |
| `VAPID_SUBJECT` | `mailto:<kurumsal-adres>` benzeri iletişim |
| `SCHEDULER_ENABLED` | Scheduler process'ini etkinleştirir |
| `POLYVALENCE_CRON_SECRET` | Polivalans scheduler operasyon secret'ı |
| `PUSH_MOOD_REMINDER_ENABLED` | Duygu rutinini aç/kapat |
| `PUSH_MOOD_REMINDER_TIME` | `HH:mm` gönderim saati |
| `PUSH_MOOD_REMINDER_TITLE` | Varsayılan başlık |
| `PUSH_MOOD_REMINDER_BODY` | Varsayılan mesaj |

Production'da scheduler yalnız worker container'ında açık olmalıdır.

## Metrics ve Backup Health

| Değişken | Amaç |
| --- | --- |
| `METRICS_ENABLED` | Prometheus endpoint'ini etkinleştirir |
| `METRICS_TOKEN` | En az 32 karakter bearer token |
| `BACKUP_STATUS_FILE` | Backup status JSON dosyası |

Metrics kapalıysa endpoint `404` döner.

## Frontend

| Değişken | Amaç |
| --- | --- |
| `VITE_API_BASE` | Build-time API base URL |

Production Docker build bu değeri boş verir ve same-origin proxy kullanır.
Frontend environment'ına secret konmaz; `VITE_*` değerleri build çıktısında
görünür.

## Backup Container

`ops/backup/.env.backup.example` kaynak dosyadır:

| Değişken | Amaç |
| --- | --- |
| `RESTIC_REPOSITORY` | S3 uyumlu Restic repository |
| `RESTIC_PASSWORD_FILE` | Container içi parola dosyası |
| `AWS_ACCESS_KEY_ID` | S3 erişim kimliği |
| `AWS_SECRET_ACCESS_KEY` | S3 secret |
| `S3_ENDPOINT` | S3 uyumlu servis adresi |
| `DB_TYPE` | `postgres` veya test amaçlı `sqlite` backup modu |
| `BACKUP_DB_USER` | Yalnız export/backup DB hesabı |
| `BACKUP_DB_PASSWORD` | Backup DB parolası |
| `DB_SERVER`, `DB_PORT`, `DB_NAME` | Yedeklenecek PostgreSQL hedefi |
| `SQLITE_FILENAME` | SQLite backup dosyası |
| `BACKUP_HEALTHCHECK_URL` | Zorunlu başarı/hata webhook'u |
| `BACKUP_HOST` | Snapshot host etiketi |
| `RESTIC_CHECK_SUBSET` | Günlük okunacak veri alt kümesi |

## Yük Testi

`LOAD_TEST_CONFIRM`, `LOAD_TEST_PASSWORD`, `LOAD_TEST_USER_COUNT` ve
`LOAD_TEST_USER_PREFIX` yalnız staging seed komutunda kullanılır. GitHub
workflow ayrıca `STAGING_BASE_URL` ve staging DB secret'larını bekler.
Veri hazırlama adımındaki eski motor ayarı için [Bilinen Sorunlar](known-issues.md)
ve [Yük testi rehberi](../performance/README.md) okunmalıdır.

## Sunum verisi

`ALLOW_PRESENTATION_DATA=true`, yalnız açıkça başlatılan `presentation:seed`
ve `presentation:clean` komutlarına izin verir. Normal uygulama başlangıcı
bu veriyi üretmez. Kapsam ve temizleme davranışı [Veritabanı](database.md) içindedir.
