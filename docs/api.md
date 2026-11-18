# API

Tarayıcı API'sinin ortak yanıtları ve modül sözleşmeleri bu belgede özetlenir.
ERP makine API'si için [Entegrasyonlar](integrations.md) kullanılır.

## Temel sözleşme

- Prefix: `/api`
- İçerik: JSON; upload endpoint'lerinde `multipart/form-data`
- Authentication: HttpOnly session cookie
- Mutasyon güvenliği: `X-CSRF-Token`
- Request correlation: `X-Request-Id`
- Tarihler: endpoint sözleşmesine göre ISO tarih veya timestamp

Sayfalama kullanan endpoint için başarılı liste cevabı:

```json
{
  "items": [],
  "pagination": {
    "page": 1,
    "pageSize": 25,
    "total": 0,
    "totalPages": 0
  }
}
```

Ortak hata katmanını kullanan endpoint için hata cevabı:

```json
{
  "error": "ERROR_CODE",
  "message": "Kullanıcıya gösterilebilir açıklama",
  "request_id": "request-id"
}
```

`details` doğrulama gibi güvenli ayrıntılar için isteğe bağlıdır. Eski bazı
endpoint ve auth yanıtları yalnız `error` veya `message` içerebilir; istemci
her yanıtta üç alanın da bulunduğunu varsaymamalıdır. SQL ve
stack bilgisi production cevabına eklenmez.

## Polivalans takvimi ve menü özeti

Polivalans `POST /api/polyvalence/admin/schedules/run` sonucu, mevcut
`opened/closed/skipped/errors` yanında `blocked` listesi içerir: zamanı gelmiş
takvimi açık dönem engelliyorsa `schedule_id`, `period_id`, `department`,
`message` döner. Bu durum takvimin kaydedilemediği veya worker hatası anlamına
gelmez; yeni dönem mevcut dönem kapandıktan sonra açılabilir.

`GET /api/polyvalence/my-tasks/summary`, doğrulanmış oturumun kendi açık dönem
görevi bulunuyorsa `{has_tasks: true}`, aksi halde `{has_tasks: false}` döndürür. Menü
görünürlüğü içindir; çalışan/puan bilgisi döndürmez, `no-store` kullanır ve
teknik summary isteği olarak işlem günlüğünden hariçtir. Görev listesi ve
değerlendirme erişim kontrolleri değişmez.

## Profil yazma sözleşmesi

Profil düzenleme istemcisi `education_entries` içinde yalnız `school`,
`department`, `start_year`, `end_year`, `is_current` gönderir. Okuma yanıtındaki
`id` sunucu alanıdır; strict yazma sözleşmesine gönderilmez. Kayıtlı eğitimi olan
kullanıcıların doğum tarihi ve beden dahil diğer profil güncellemeleri bu
alan yüzünden reddedilmez.

## İşlem günlüğü API

Log Kayıtları (yalnız admin, `Cache-Control: no-store`):

- `GET /api/admin/audit-logs`: `user`, `module`, `action`, `outcome`, `source`,
  `from`, `to`, `held=true`, `page`, `pageSize` filtreleri; ortak sayfalı yanıt
  yanında `summary.total/failed/held`. Tarihler Türkiye gününe göre dahil
  başlangıç ve dahil bitiş günüdür. Geçersiz/ters tarih veya bilinmeyen alan 400.
- `GET /api/admin/audit-logs/policy`: 180/365 gün, son temizlik, gecikme ve
  sonucu tamamlanmamış kayıt sayısı, modül/işlem seçenekleri.
- `GET /api/admin/audit-logs/export`: aynı filtrelerle UTF-8 BOM CSV; 5.000 satır
  üstü 422 `AUDIT_EXPORT_LIMIT`; dosya sessizce kesilmez, formül girdileri kaçırılır.
- `GET /api/admin/audit-logs/:source/:id`: güvenli detay; source activity/security.
- `POST /api/admin/audit-logs/:source/:id/hold`: `{reason}` (10–500 karakter), CSRF.
- `POST /api/admin/audit-logs/:source/:id/release`: boş JSON nesnesi, CSRF.

Olay güncelleme/silme endpoint'i yoktur. Koruma silme politikasına istisna
oluşturur; orijinal olay zamanı/süresi değişmez. Ayrıntılar [Log Kayıtları](audit-logs.md).

## Geri Bildirim Süreci

- `PUT /api/admin/feedback/:id/assignment`: `replace_participants: true`
  gönderildiğinde `participant_user_ids` mevcut katılımcı listesini değiştirir;
  atanan sorumlu her zaman listede tutulur. Alan gönderilmezse eski eklemeli
  sözleşme korunur. Yalnız ilk `pending` ataması durumu `assigned` yapar.
- Çalışan yorumunda `is_public` yalnız sorumlu/katılımcı için geçerlidir;
  talep sahibinin mesajı her zaman açıktır. Çalışan detay/listelerinde
  `decision_note`, çalışan geçmişinde özel notlar döndürülmez.
- Açık talebin sorumlusu `GET /api/feedback/:id/participant-options` ile
  aktif adayları sayfalı olarak arayabilir ve `POST /api/feedback/:id/participants`
  çağrısında `{ "user_ids": [...] }` ile katılımcı ekleyebilir. Mevcut
  katılımcılar korunur. Çalışan detayı `can_add_participants` yetkisini bildirir.
- `POST /api/feedback/:id/comments` ve yönetim karşılığı JSON yorum gövdesine
  ek olarak `multipart/form-data` kabul eder. Alanlar `comment`, isteğe
  bağlı `is_public` (`true` veya `false`) ve tek bir `file` alanıdır.
  Yazışma listesindeki `attachment_name` indirme adını verir. Dosya
  `GET /api/feedback/:id/comments/:commentId/attachment` veya `manage_feedback`
  gerektiren `/api/admin/feedback` karşılığından indirilir.
- `POST /api/feedback/:id/review-completion` gövde gerektirmez ve idempotenttir.
  Atanmamış kullanıcı `403 FEEDBACK_REVIEW_DENIED` alır; işlem talebi kapatmaz.
- Atama sonrasında ilk yorum, sorumlunun yeni katılımcı eklemesi veya kendi
  incelemesini tamamlaması `assigned` durumunu `in_review` yapar.
- `PUT /api/admin/feedback/:id/decision` için `decision` ve dolu `public_response`
  zorunludur (`400 FEEDBACK_RESULT_REQUIRED`). Durum karardan türetilir.
  Eski istemcilerin gönderdiği `status: resolved` veya `status: rejected` kabul edilir.
- Liste ve detay yanıtlarındaki `display_status` açık kayıtta aşamayı, kapalı kayıtta
  varsa kararı verir. Yönetim listesinin `status` filtresi bu değerleri kabul eder.
  Eski `status=resolved` filtresi ret dışındaki `resolved` kayıtları döndürmeye devam eder.
- Kapalı kayıt yorum, atama, katılımcı ekleme veya karar değişikliği için
  `409 FEEDBACK_CLOSED` döndürür. Yönetici `PUT /api/admin/feedback/:id/status`
  çağrısında `{ "status": "in_review" }` ile kapalı kaydı yeniden açabilir.

## Pagination

Liste endpoint'leri genel olarak `page`, `pageSize`, `search`, `sort`, `order`
ve domain filtreleri alır. `pageSize` üst sınırı 100'dür. Export endpoint'leri
pagination'dan bağımsızdır, ancak aynı filtre ve yetki kapsamını kullanır.

Sayfalı yönetim seçim listeleri aynı yanıt sözleşmesini kullanır. Polivalans
kurulumunda küçük metadata `/api/polyvalence/admin/setup?includeLarge=false`
ile alınır. Büyük `users` ve `memberships` koleksiyonları
`resource=users|memberships` parametresiyle ayrı ve sayfalı yüklenir.

## Route aileleri

Aşağıdaki yollar `/api` köküne göredir. Hücredeki kısaltılmış ikinci yollar da
aynı kökü kullanır; bunlar doğrudan sunucu köküne yapılan istekler değildir.

| Prefix | İşlev | Yetki özeti |
| --- | --- | --- |
| `/api/login`, `/logout`, `/session` | Oturum yaşam döngüsü | Login hariç oturum |
| `/api/videos`, `/video`, `/lesson`, `/assignment` | Çalışan eğitim akışı | Oturum ve atama sahipliği |
| `/api/admin/video`, `/admin/assign*` | Eğitim yönetimi | `manage_education` |
| `/api/admin/audit-logs*` | İşlem günlüğü, dışa aktarma ve koruma | Yalnız admin |
| `/api/admin/users` | Kullanıcı yönetimi | `manage_users` |
| `/api/announcements` | Aktif duyurular | Oturum |
| `/api/admin/announcements` | Duyuru yönetimi | `manage_announcements` |
| `/api/news`, `/api/admin/news` | Haber görüntüleme/yönetim | Oturum / `manage_news` |
| `GET /api/news/home-preview`, `GET /api/announcements/home-preview` | Ana sayfa için en yeni 6 haber ve çalışana görünür en yeni 3 duyuru | Oturum |
| `/api/personal-info` | Profil ve belge talepleri | Kendi kayıtları |
| `/api/admin/documents*` | Belge ve talep yönetimi | `manage_documents` |
| `/api/feedback` | Kendi/dahil olunan geri bildirim | Nesne kapsamı |
| `/api/admin/feedback` | Geri bildirim süreci | `manage_feedback` |
| `GET /api/admin/feedback/:id/detail` | İç karar notu dahil yönetici detayı | `manage_feedback` |
| `POST /api/feedback/:id/review-completion` | Sorumlunun incelemesini tamamlaması | Atanan sorumlu + açık kayıt |
| `/api/leave-requests` | İzin talebi | Kendi kayıtları; admin işlemleri rol kontrolü |
| `/api/directory` | Rehber ve profil görünümü | Oturum |
| `/api/careers` | İlan ve başvuru | Oturum / `manage_careers` |
| `/api/knowledge` | Bilgi portalı | Oturum |
| `/api/admin/knowledge` | Kategori/içerik yönetimi | `manage_knowledge_portal` |
| `/api/surveys` | Aktif anket ve yanıt | Oturum |
| `/api/admin/surveys` | Anket yönetimi/rapor | `manage_surveys` |
| `/api/meal-menu` | Menü ve kendi puanı | Oturum |
| `/api/admin/meal-menu` | Menü ve değerlendirme analizi | `manage_meal_menu` |
| `/api/service-routes` | Aktif servis hatları | Oturum |
| `/api/admin/service-routes` | Hat/durak yönetimi | `manage_service_routes` |
| `/api/polyvalence` | Görev, katalog, dönem ve rapor | Kapsama göre değişir |
| `/api/mood-check` | Kimliksiz günlük duygu kaydı | Oturum |
| `/api/mood-check/today` | Günlük gönderim ve geri arama durumu | Oturum |
| `/api/mood-check/callback-request` | Duygu içeriğinden ayrı geri aranma talebi | Oturum |
| `/api/mood-check/admin` | Eşik üstü toplulaştırılmış duygu analizi/export | `manage_mood_analytics` |
| `/api/mood-check/admin/callbacks` | Ayrı geri aranma talepleri | `manage_mood_analytics` |
| `/api/notifications` | Push aboneliği ve test | Oturum |
| `/api/notifications/admin` | Rutin ve teknik ayarlar | `manage_notifications` |
| `/api/chatbot` | Chatbot ayarı ve soru | Oturum, AI rate limit |
| `/api/admin/ai-settings` | AI model/özellik ayarı | `manage_ai_settings` |
| `/api/admin/integrations*` | ERP bağlantısı, anahtar, kuyruk ve audit yönetimi | `manage_integrations` |
| `/api/integrations/v1` | ERP connector makine API'si | Scoped opaque API key |
| `/api/reminders` | Kişisel hatırlatma CRUD işlemleri | Oturum ve kayıt sahipliği |
| `/api/weather/today` | Bursa için günlük hava durumu özeti | Oturum |

`GET /api/user/profile` yanıtı düz metin profil alanlarına ek olarak
`education_entries`, `skill_tags` ve `hobby_tags` alanlarını döndürür. `PUT`
aynı alanları opsiyonel kabul eder; göndermeyen eski istemciler mevcut
yapılandırılmış kayıtları değiştirmez. Rehber detay yanıtı da bu alanları
salt okunur olarak sunar.

`GET /api/notifications/admin/event-templates` listesi `history_today` (Tarihte
Bugün) ve `quote_daily` (Günün Sözü) şablonlarını da içerir. Mevcut
`PUT /api/notifications/admin/event-templates/:key` sözleşmesiyle `enabled`,
`time` (`HH:mm`, Türkiye saati), `title`, `body` ve `url` düzenlenir;
`manage_notifications` izni ve mutasyonlarda CSRF gerekir. İki şablon da
başlangıçta pasiftir. Tarih şablonu `{date}`, `{event}`, `{sourceUrl}`;
söz şablonu `{date}`, `{quote}`, `{author}`, `{sourceUrl}` değişkenlerini destekler.
İki günlük şablonda `delivery.last_processed_date` ve `delivery.last_attempt`
son işlenen günü ve son denemenin zamanını, sonucunu, kabul edilen/başarısız
cihaz sayılarını, varsa yeniden deneme zamanını gösterir. Eski tarih işareti
tek başına cihaz teslim başarısı kanıtı değildir.
İçerik kaynağı: [MediaWiki Action API](https://www.mediawiki.org/wiki/API:Parsing_wikitext).

`GET /api/notifications/admin/subscriptions`, `manage_notifications` izniyle
sayfalı cihaz aboneliklerini döndürür. `page`, `pageSize` (en çok 100), `search`
(kullanıcı/sicil/bölüm) ve `status=all|active|passive` filtreleri vardır.
Her satır bir cihazdır; ad/sicil/bölüm, hesap durumu, cihaz etiketi, abonelik
durumu, oluşturma ve güncelleme tarihleri sunulur. Endpoint,
`subscription_json`, auth/p256dh anahtarları ve IP verilmez. Yanıt `no-store`'dur.

Oturum cookie'si gerektirmeyen endpoint'ler:

- `POST /api/login`
- `GET /api/certificates/:reference/verify` (rate limited)
- `GET /health/live`
- `GET /health/ready`
- `GET /health/backup`

`/internal/metrics` oturum yerine ayrı bearer token ister; yalnız açıkça
etkinleştirildiğinde kullanılabilir.

Login ve `GET /api/session` kullanıcı bilgisine ek olarak `session_policy`
döndürür. Bu nesne idle, mutlak ve uyarı süreleriyle oturuma ait gerçek bitiş
zamanlarını içerir. `POST /api/logout` için istemci `401` veya `403` yanıtını
zaten kapanmış oturum olarak kabul edebilir.

## Eğitim rozet yüklemesi

Eğitim oluşturma/güncelleme (`POST /api/admin/video`, `PUT /api/admin/video/:id`)
multipart gövdede `badge_image_file` kabul eder: tek JPEG/PNG/GIF/WebP, en fazla
10 MB, uzantı/MIME/içerik imzası doğrulanır. `awards_badge` açıkken yüklenmiş
veya güncellemede korunmuş bir rozet görseli zorunludur. `remove_badge_image`
mevcut görsel bağlantısını kaldırır; rozet açık kalacaksa yerine görsel gerekir.
Gönderilen `badge_image_url` mevcut dosyayı değiştiremez; URL sunucuda belirlenir.
Yönetim kataloğu, çalışan eğitim listesi ve rehber rozetleri `badge_image_url`
alanını döndürür. Kazanılmış rozet görsellerini oturum açmış rehber kullanıcıları
görebilir; eğitim video ve içerik dosyalarının erişim kapsamı korunur.

## Dosya Erişimi

`/uploads/*` statik public klasör değildir. Oturum, izin ve nesne sahipliği
kontrolünden sonra backend ya dosyayı sunar ya da Nginx internal redirect
header'ı üretir.

Rehber, yerel `/uploads/avatars/:dosya?avatarSize=160` (kart) veya
`avatarSize=320` (profil) isteğiyle WebP küçük görsel alır. Yalnız bu iki boyut
desteklenir. Oturum ve upload erişim kontrolleri dönüşümden önce uygulanır.
Desteklenmeyen resimlerde mevcut orijinal dosya sunumuna dönülür; uzak fotoğraf
URL'leri değiştirilmez. Mevcut fotoğraflar da ilk istekte dönüştürülür.

Yerel rozetler `/uploads/videos/:dosya?badgeSize=256` ile WebP önizleme alır.
Yalnız veritabanında rozet olarak bağlı dosyalar dönüştürülür; video, kapak ve
ders dosyaları rozet önizlemesine çevrilmez. Oturum ve mevcut upload nesne erişim
kontrolleri önbellekten yanıtlarda da önce çalışır. 256px içine sığdırma kırpmaz,
şeffaflığı korur, orijinali değiştirmez. Önizleme `private, no-cache` ve ETag
ile yeniden doğrulanır; en fazla 128 küçük çıktı bellekte tutulur. 36 milyon
giriş pikseli sınırı vardır. Hareketli/desteklenmeyen görselde orijinale dönülür.
Uzak URL'ler değiştirilmez. Daha önce yüklenmiş rozetler de ilk istekte
önizleme alır; yeniden yüklemek gerekmez.

Eğitim oluşturma ve güncelleme istekleri `multipart/form-data` kullanır.
Yönetim ekranındaki birleşik eğitim kanıtı
`GET /api/admin/assignments/:id/evidence.pdf` üzerinden PDF olarak indirilir.
Rapor; atama özeti, içerik katılımı, sınav denemeleri, aktivite zaman çizelgesi
ve ek kanıt dosyalarının özetini içerir. Sertifika PDF'i ayrı kalır. Geriye
dönük uyumluluk için mevcut JSON kanıtı ile katılım ve sınav PDF endpointleri
korunur.
Yeni içerik sözleşmesinde `modules` alanı JSON dizisidir: her modül `title`,
isteğe bağlı `description`, sıralı `contents` ve isteğe bağlı `quizData` taşır.
Her içerik `title`, `content_type` (`video`/`pdf`), URL veya dosya ve izleme
alanlarını taşır. Dosyalar düz içerik sırasına göre `lesson_0_file`,
`lesson_1_file` biçiminde gönderilir. Eski `lessons` alanı tek içerikli
modüller için kabul edilir. Yönetim detay yanıtındaki derslere `module_id`,
`module_title` ve `module_index` alanları eklenmiştir; mevcut alanlar korunur.
İsteğe bağlı `cover_image_file` alanı JPEG, PNG, GIF veya WebP biçiminde ve en
fazla 10 MB olabilir. Backend yüklenen dosyanın erişim adresini
`cover_image_url` alanında saklar. Düzenleme isteğinde `remove_cover_image=true`
gönderilmesi mevcut kapağı eğitim kaydından kaldırır.

Video ilerlemesi `POST /api/lesson/:id/watch/start` ile alınan kısa ömürlü
`progress_token` ve `POST /api/lesson/:id/watch` heartbeat istekleriyle
kaydedilir. Client tarafından gönderilen tamamlanma ve süre değerleri tek
başına eğitim tamamlama kanıtı değildir.

Toplu eğitim atama cevabı mevcut `success` alanına ek olarak oluşturulan ve
aktif atama bulunduğu için atlanan çalışan sayılarını `created` ve `skipped`
alanlarında döndürür.

## Sürümleme Durumu

Tarayıcı ve yönetim API'leri URL tabanlı sürümleme kullanmaz; frontend ve
backend aynı release içinde birlikte dağıtılır. Harici ERP connector sözleşmesi
ise geriye uyumluluk sınırı olarak `/api/integrations/v1` altında sürümlüdür.

OpenAPI tanımı henüz yoktur. Makine API'sinin kimlik doğrulama, idempotency,
payload ve teslimat ayrıntıları [Entegrasyonlar](integrations.md) belgesindedir.

TODO: Connector geliştirmesi başladığında route şemalarından üretilen OpenAPI
dosyası ve açık deprecation politikası eklenmelidir.

## Polivalans Eşleşmeleri

`GET /api/polyvalence/tasks/:id` görev sahipliği/yönetim kontrolünden sonra
görev detayına ek olarak ortak `levels` listesini (`level_value`, `label`,
`description`) döndürür. Puanlama aralığı ve sürüm doğrulaması değişmez.

`GET /api/polyvalence/admin/periods/:id/audit` mevcut dizi yanıtını korur;
rapor ve CSV ile aynı bölüm kapsam denetimini uygular. Rapor izni olan
employee yabancı bölüm için 403, olmayan dönem için 404 alır.

`GET /api/polyvalence/admin/setup?resource=memberships` eksik otomatik
eşleşmeleri kullanıcıların bölüm, pozisyon ve `manager_id` alanlarından üretir.
`PUT /api/polyvalence/admin/memberships` bu varsayılanların üzerine manuel
istisna kaydeder. `DELETE /api/polyvalence/admin/memberships/:id/override`
kaydı silmeden manuel istisnayı kaldırır ve güncel kullanıcı bilgilerine döner.
Bu yönetim endpoint'leri `manage_polyvalence` izni gerektirir.

## Bordro entegrasyonu

Bordro yükleme: POST /api/integrations/v1/payrolls/upsert; payrolls:write kapsamı, multipart PDF ve çalışan/dönem/revizyon sözleşmesi kullanır. Ayrıntılar: [Entegrasyonlar](integrations.md#erp-bordro-pdf-aktarımı).
