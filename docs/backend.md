# Backend

## Teknoloji

- Node.js 22 container runtime
- CommonJS modül sistemi
- Express 5
- Zod 4
- `pg` ve otomatik testler için `sqlite/sqlite3`
- Pino ve `pino-http`
- Multer, PDFKit, `pdf-parse`, QRCode ve Web Push

## Başlangıç Süreci

`backend/index.js` aşağıdaki sırayı uygular:

1. `.env` yüklenir ve ortam doğrulanır.
2. Pino loglama ve hassas alan redaksiyonu kurulur.
3. CORS, cookie, JSON, request ID, hata sözleşmesi, metrik ve rate limit
   middleware'leri eklenir.
4. Veritabanı bağlantısı açılır; bağlantı katmanı şema veya seed çalıştırmaz.
5. Bekleyen migration varsa API başlamaz.
6. Upload erişimi, health endpoint'leri ve domain router'ları bağlanır.
7. HTTP server ve kontrollü kapanış sinyalleri kurulur.

`backend/worker.js` HTTP sunmaz. Aynı migration kontrolünü yapar ve scheduler
işlerini başlatır. Süresi dolan otomatik yenilemeli eğitimler de kullanıcı
ekranına bağlı olmadan bu worker tarafından idempotent olarak yeniden atanır.
Production Compose'ta API process'inde scheduler kapalı, worker process'inde
açıktır.

## Katmanlar

- `routes/`: yalnız HTTP sözleşmesi, middleware ve controller bağlama
- `modules/`: ayrıştırılmış domain controller/service/repository yapıları
- `core/`: HTTP hata sınıfı, request context, validation ve pagination
- `middleware/`: authentication, rate limit, metrics ve upload erişimi
- `services/`: oturum, push, Gemini, backup health ve çapraz domain servisleri
- `db/`: PostgreSQL/SQLite adaptörleri, başlangıç şema tanımları ve development seed'leri
- `migrations/`: checksum kontrollü sürümlü migration'lar

Push bildirim facade'ı dış çağrı sözleşmesini korur. VAPID, abonelik ve teslimat
`pushDeliveryService`; rutin ve dönemsel işler `notificationSchedulerService`
tarafından yürütülür. Polivalans katalog şemaları ve route ortakları da HTTP
route dosyasından ayrıdır.

Yeni büyük özelliklerde `modules/<domain>/` altındaki controller/service/repository/schema
ayrımı izlenir. `backend/routes/` altındaki domain router'ları yalnız
middleware, validation ve controller bağlantısı yapar. SQL erişimi repository,
iş kuralları service ve HTTP yanıtları controller katmanında tutulur. Bu sınır
bütün kök route dosyaları için mimari testle korunur.

## Veritabanı Erişimi

Uygulama `db.get`, `db.all`, `db.run` ve `db.transaction` sözleşmesini kullanır.
PostgreSQL adaptörü `?` placeholder'larını `$1` biçimindeki bağlı parametrelere
dönüştürür, connection pool ve transaction yönetir. SQLite
adaptörü foreign key, WAL ve busy timeout ayarlarını etkinleştirir.

Kullanıcı girdisi SQL kolon adı olarak kullanılmaz. Dinamik sıralama alanları
route içindeki allowlist üzerinden gerçek kolonlara çevrilir.

## HTTP Altyapısı

- JSON body sınırı: `1mb`
- API rate limit: beş dakikalık pencere
- CORS: environment allowlist, credentials açık
- Request ID: gelen güvenilir ID veya üretilen UUID
- Hata sözleşmesi: [API](api.md)
- Yavaş sorgu eşiği: `SLOW_QUERY_MS`, varsayılan 500 ms
- Metrics: yalnız açıkça etkin ve bearer token doğrulamalı
- Makine API'si: ayrı rate limit, scoped opaque anahtar ve idempotency
- Graceful shutdown: 15 saniyelik üst sınır

## Dosya Yükleme

Dosya türü uzantı ve MIME ile sınırlanır; yükleme sonrası magic signature
kontrolü yapılır. Başlıca sınırlar:

- Eğitim video/PDF: 500 MB
- Doküman, geri bildirim ve duyuru eki: 20 MB
- Görseller: ilgili alana göre 5 MB veya 10 MB

Yerel dosyalar `backend/uploads` altında tutulur ve doğrudan public değildir.
`/uploads` oturum, nesne sahipliği ve izin kontrolünden geçer. Cloudinary
yapılandırıldığında desteklenen görsel, eğitim, belge ve geri bildirim ekleri
memory upload üzerinden Cloudinary'ye aktarılır. Belge ve geri bildirim
kayıtları provider/nesne anahtarını saklar; başarısız DB yazımlarında yeni
storage nesnesi sınırlı tekrar ile temizlenir.

## Harici Entegrasyonlar

- Gemini metin ve PDF işleme
- Web Push
- Cloudinary, yapılandırılmışsa
- Nominatim/OSRM ve harita URL'leri
- ERP/Logo connector için sürümlü makine API'si ve outbox teslimatı

Entegrasyon anahtarları yalnız backend environment'ında tutulur. AI ayarları
endpoint'i anahtar değerini döndürmez, yalnız yapılandırılmış olup olmadığını
bildirir.

ERP API anahtarları environment anahtarı değildir; yönetim modülünde üretilir,
yalnız hash olarak veritabanında saklanır ve açık değer yalnız bir kez gösterilir.
Ayrıntılı sözleşme [Entegrasyonlar](integrations.md) belgesindedir.
