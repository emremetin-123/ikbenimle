# Yetkilendirme

## Temel Model

Kullanıcı rolleri:

- `admin`
- `employee`

`admin` rolü tüm izin kontrollerini geçer. `employee` kullanıcılara JSON izin
listesi verilebilir. Backend güvenlik sınırıdır; frontend izinleri yalnız
navigasyon ve kontrol görünürlüğünü düzenler.

## İzinler

Yönetim izinleri:

- `manage_education`
- `manage_users`
- `manage_announcements`
- `manage_news`
- `manage_documents`
- `manage_feedback`
- `manage_careers`
- `manage_knowledge_portal`
- `manage_surveys`
- `manage_meal_menu`
- `manage_ai_settings`
- `manage_mood_analytics`
- `manage_notifications`
- `manage_service_routes`
- `manage_polyvalence`
- `manage_integrations`

Görüntüleme izinleri:

- `view_polyvalence_reports`
- `view_education`
- `view_announcements`
- `view_documents`
- `view_feedback`
- `view_careers`
- `view_knowledge_portal`
- `view_news`
- `view_surveys`
- `view_service_routes`

Yeni employee formu varsayılan olarak genel `view_*` izinlerini seçer.

## Middleware

| Middleware | Davranış |
| --- | --- |
| `authenticateToken` | Session ve mutasyonlarda CSRF doğrular |
| `isAdmin` | Yalnız gerçek `admin` rolünü kabul eder |
| `requirePermission(name)` | Admin veya belirtilen izin |
| `hasAdminPanelAccess(user)` | Admin veya en az bir `manage_*` iznini denetleyen yardımcı; middleware değildir |

Kullanıcı oluşturma/güncelleme işlemleri, `manage_users` sahibi employee'nin
kendisini admin yapmasını veya kritik izin yükseltmesini engelleyen ek servis
kontrollerine sahiptir.

## Nesne Kapsamı

Bildirim aboneliklerinin kullanıcı-cihaz listesi `manage_notifications` izni
veya admin rolü gerektirir; `manage_users` tek başına erişim vermez. Liste
push endpoint/anahtarlarını içermez; cihaz aktifliği çevrimiçi izleme değildir.

İzin kontrolüne ek olarak aşağıdaki alanlarda kayıt kapsamı uygulanır:

- Eğitim: çalışan yalnız kendi atamasına bağlı içeriği ve belgeyi kullanır.
- Belge: çalışan kendi belge ve taleplerini görür.
- Geri bildirim: sahibi, atanmış sorumlu veya açıkça eklenmiş katılımcı,
  rolüne açık yazışmalara erişir; iç karar notu yönetim kapsamındadır.
- Upload: nesne sahipliği ya da ilgili yönetim izni gerekir.
- Kariyer/anket/yemek kayıtlarında sahiplik uygulanır. Duygu yanıtı kimliksizdir;
  yalnız ayrı geri aranma talebi kullanıcıya aittir.
- Polivalans: değerlendirici kendi görevini görür; rapor izni olan employee
  yalnız kendi departmanını, `manage_polyvalence` veya admin tüm kapsamı görür.

## Yalnız admin'e açık alanlar

Log Kayıtları şirket genelinde işlem ve IP bilgisi içerdiği için bilinçli olarak
yalnız `isAdmin` kullanır; `manage_users` veya başka modül izinleri erişim vermez.
Yeni bir delege izin eklenmemiştir. Liste, detay, CSV ve saklama koruması aynı
sunucu kontrolüne tabidir; koruma mutasyonları CSRF gerektirir.

İzin talebi yönetim endpoint'leri `manage_*` izni yerine yalnız `isAdmin`
kullanır. Bu davranış mevcut kod sözleşmesidir.

NOTE: Yeni yönetim modüllerinde rol kontrolü yerine ilgili `manage_*` izni
tercih edilmelidir; istisnalar bilinçli olarak dokümante edilmelidir.

## Entegrasyon Kapsamları

`manage_integrations` yalnız bağlantı ve API anahtarı yönetimi içindir. Makine
API'si her anahtar için ayrıca şu en az yetki kapsamlarını uygular:

- `employees:write`
- `leave-balances:write`
- `leave-requests:read`
- `leave-requests:ack`

Bir anahtar yalnız atanmış kapsamlarla işlem yapabilir. Opsiyonel IP allowlist
tam IP eşleşmesi uygular.
