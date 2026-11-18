# Veritabanı

## Desteklenen Motorlar

| Motor | Kullanım |
| --- | --- |
| PostgreSQL 17 | Production ve yerel Docker hedefi |
| SQLite | İzole otomatik testler ve yedekleme testi |

Motor `DB_TYPE` ile seçilir. Uygulama domain kodu ortak `db` adaptörü üzerinden
çalışır; motor özel başlangıç şeması ve migration işlemleri migration katmanında
ayrılır. Veritabanı bağlantısı açmak hiçbir ortamda tablo oluşturmaz veya seed
çalıştırmaz.

## Şema Alanları

| Alan | Ana tablolar |
| --- | --- |
| Kullanıcı ve güvenlik | `users`, `personal_info`, `profile_education_entries`, `profile_interests`, `auth_sessions`, `auth_login_guards`, `security_audit_events` |
| Eğitim | `videos`, `training_modules`, `lessons`, `assignments`, `quizzes`, `lesson_progress`, `training_activity_logs`, `training_attempts`, `training_evidence_files` |
| Belge | `documents`, `document_request_types`, `document_request_fields`, `document_requests` |
| İletişim | `announcements`, `company_news`, `feedback`, `feedback_participants`, `feedback_comments`, `feedback_status_history` |
| Çalışan süreçleri | `job_postings`, `applications`, `leave_requests` |
| Bilgi ve anket | `knowledge_categories`, `knowledge_items`, `surveys`, `survey_questions`, `survey_responses`, `survey_answers` |
| Günlük deneyim | `meal_menus`, `meal_menu_ratings`, `anonymous_mood_checks`, `mood_callback_requests` |
| Kişisel araçlar | `personal_reminders` |
| Bildirim | `push_subscriptions`, `notification_routines`, `app_settings`, `scheduler_locks` |
| Servis | `service_routes`, `service_stops` |
| Polivalans | departman, rol, beceri, hedef, üyelik, dönem, değerlendirme, görev ve audit tabloları |
| ERP entegrasyonu | `integration_connections`, `integration_api_keys`, `integration_employee_mappings`, `integration_leave_balances`, `integration_outbox`, `integration_idempotency_records`, `integration_audit_events` |

Belge, belge talebi yanıtı ve geri bildirim eki kayıtları mevcut URL alanlarına
ek olarak nullable storage provider ve nesne anahtarı tutar. Eski URL-only
kayıtlar okunmaya devam eder; Cloudinary nesne anahtarı gerektiğinde eski
Cloudinary URL'sinden türetilir.

Başlangıç kolon sözleşmesi `backend/db/schema/<dialect>/` altında tutulur ve
yalnız `000_initial_schema` migration'ı tarafından çalıştırılır. Sonraki bütün
şema değişikliklerinin kaynağı `backend/migrations/definitions/` dosyalarıdır.

`020_training_modules` eski her dersi tek içerikli modüle bağlar. Yeni
eğitimlerde bir modül birden fazla `lessons` kaydı taşır; sınav modülün son
içeriğine bağlı kalır. Atanmış eski eğitimler ve ilerleme kayıtları korunur.

## Son şema değişiklikleri

### Uygulama işlem günlüğü

`024_application_audit_logs`; `application_audit_events`, `audit_log_holds`,
`audit_log_purge_runs` ve eş zamanlı koruma/temizlik için `audit_log_control`
tablolarını ekler. Olaylar UUID, UTC metin zamanı ve 180/365 gün sınıfı taşır.
Kullanıcıya FK ile cascade bağlanmaz; kullanıcı silinince geçmiş korunur.
Mevcut `security_audit_events` tablosuna aktör adı/sicili ve indeksli UTC metin
zamanı eklenip güvenli biçimde doldurulur. SQLite ve PostgreSQL desteklenir;
PostgreSQL'de eski TIMESTAMPTZ UTC'ye dönüştürülür. Down yeni tabloları/kolonları
kaldırır, asıl eğitim/personel ve eski güvenlik tablosunu korur. Üretimde up
uygulama başlamadan ayrı migration adımında çalıştırılır.

### Eğitim rozet görselleri

`023_training_badge_images`, `videos.badge_image_url` nullable TEXT kolonunu
ekler; down kolonu kaldırır. Görsel eğitim sürümüne aittir; yeni sürüm oluşturulunca
eski tamamlanma kayıtları ve görseli korunur. Eski satırlar NULL kalır; hazır
rozet tasarımı veya görsel dosyası oluşturulmaz. Migration uygulama öncesinde
ayrı dağıtım adımında çalıştırılmalıdır.

### Geri bildirim inceleme tamamlaması

`022_feedback_review_completion`, `feedback_participants.review_completed_at`
nullable TEXT kolonunu ekler. Sorumlunun kendi incelemesini tamamlaması kayıt
kapanışından bağımsız saklanır. SQLite ve PostgreSQL için aynı ALTER TABLE
ifadesi kullanılır; down kolonu kaldırır. Uygulama dağıtımından önce migration
ayrı adımda çalıştırılmalıdır; uygulama açılışı migration çalıştırmaz.

### Geri bildirim yorum ekleri

`026_feedback_comment_attachments`, `feedback_comments` tablosuna nullable
`attachment_key` ve `attachment_name` kolonlarını ekler. Dosya içeriği kalıcı
`uploads/feedback-comments` dizininde rastgele anahtarla tutulur ve yüklemeler
ile birlikte yedeklenir. Down işlemi iki kolonu kaldırır.

## Migration

CLI:

```powershell
cd backend
npm run migrate
npm run migrate:status
npm run migrate:down
```

Migration kayıtları `schema_migrations` tablosunda version ve checksum ile
tutulur. PostgreSQL migration çalışması transaction-scoped advisory lock alır. `down` yıkıcı kabul
edilir ve `ALLOW_DESTRUCTIVE_MIGRATION=true` olmadan çalışmaz.

Production API ve worker migration çalıştırmaz. Bekleyen migration varsa
readiness yerine process başlangıcı başarısız olur. CI/CD önce migration container'ını çalıştırır. Ayrı hesap tanımlanmışsa
`MIGRATION_DB_USER` ve `MIGRATION_DB_PASSWORD` kullanılır; ayrım kendiliğinden sağlanmaz.

`000_initial_schema`, başlangıç şema fonksiyonlarının kaynaklarını checksum
hesabına dahil eder. Uygulanmış migration kaynağı değiştirilirse checksum
uyuşmazlığı başlangıcı durdurur.

FK adayları eklenmeden önce production verisi salt-okunur denetlenmelidir:

```powershell
cd backend
npm run db:audit-relations
```

Komut `users.manager_id`, `videos.parent_video_id` ve
`feedback.assigned_to_user_id` orphan sayılarını raporlar; orphan varsa çıkış
kodu `2` olur. Temiz sonuç tek başına migration onayı değildir; silme davranışı
ve `ON DELETE` kuralı ayrıca ürün sahibiyle kararlaştırılmalıdır.

## Ortam Yaşam Döngüleri

| Ortam | Şema hazırlığı | Örnek veri |
| --- | --- | --- |
| Yeni yerel kurulum | Docker PostgreSQL üzerinde `npm run migrate` veya `npm run db:setup` | Yalnız `db:setup` içindeki açık development seed adımı |
| Otomatik test | Her test için boş geçici SQLite ve bütün migration'lar | Test fixture'ları; development seed çalışmaz |
| Production | Ayrı `migration` container'ında `npm run migrate` | Otomatik seed yasak; sunum paketi yalnız açık operasyon onayıyla çalıştırılabilir |

## Seed

- Geliştirme seed'i `npm run seed:development` veya onu çağıran `db:setup`
  ile açıkça çalıştırılır.
- `SEED_DEFAULT_USERS=true` development kullanıcı üretimini açar.
- Seed parolaları environment üzerinden verilmelidir.
- `SEED_SAMPLE_DATA=true` örnek veriyi açar.
- Zorunlu belge talep tipleri ve polivalans seviye tanımları development seed
  değildir; `000_initial_schema` migration'ının sürümlü referans verisidir.

`seed:development` production ortamında hata vererek durur.

### Sunum Verisi

Sunum ortamını geçici içerikle doldurmak için `presentation:seed`, yalnız
`ALLOW_PRESENTATION_DATA=true` açıkken çalışır. Paket duyuru, haber, bilgi
portalı içeriği, aktif anket ve ileri tarihli yemek menüsü ekler. Gerçek anket
yanıtı veya yemek değerlendirmesi üretmez.

İşlem `app_settings.presentation_seed_manifest_v1` kaydında yalnız kendi
oluşturduğu kimlikleri saklar. `presentation:clean` bu manifesti kullanarak
gerçek kayıtları korur. Aynı isimli mevcut bilgi kategorileri yeniden
oluşturulmaz; dolu yemek tarihleri atlanır. Paket uygulama başlangıcına veya
migration zincirine bağlı değildir.

## Bağlantı ve Performans

- PostgreSQL connection pool boyutu ve timeout'lar environment ile yönetilir.
- Harici PostgreSQL bağlantısı TLS ve doğrulanmış CA ile yapılandırılabilir.
- SQLite foreign key, WAL ve 5 saniye busy timeout kullanır.
- Sorgu süresi endpoint ve query fingerprint ile ölçülür.
- Liste endpoint'leri pagination, explicit kolon ve allowlist sıralama
  kullanmalıdır.

## Yedek ve Geri Yükleme

Backup container:

- PostgreSQL için `pg_dump` custom archive,
- SQLite için tutarlı `.backup`,
- upload dosyaları ve SHA-256 manifesti

üretir; Restic ile istemci tarafında şifreleyip S3 uyumlu depoya gönderir.
Saklama politikası 30 günlük, 12 haftalık ve 12 aylık snapshot'tır. Restore
script'i production hedefinin üzerine yazmayı reddeder.

Operasyon ayrıntıları [Docker](docker.md), [Dağıtım](deployment.md) ve
[Yedekleme rehberi](../ops/backup/README.md) içindedir.

## Bordro entegrasyonu

025_payroll_integration migration integration_payrolls tablosunu ekler. Bağlantı+dış bordro kimliği ve bağlantı+çalışan+dönem benzersizdir. Belge silindiğinde eşleştirme CASCADE ile silinir. PostgreSQL adaptörü INTEGER PRIMARY KEY AUTOINCREMENT ve DATETIME ifadelerini SERIAL ve TIMESTAMPTZ olarak dönüştürür. Üretimde migration dağıtımdan önce ayrı adımda uygulanır.
