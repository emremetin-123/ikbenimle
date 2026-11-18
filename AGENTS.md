# AGENTS.md

Bu dosya, bu depoda çalışan insan ve AI geliştiriciler için bağlayıcı çalışma
kurallarını tanımlar. Kod davranışı ile dokümantasyon çelişirse kod incelenir;
fark aynı değişiklikte giderilir.

## Önce Okunacaklar

Her görevde:

1. `AGENTS.md`
2. Değiştirilecek alana ait rehber; dosya seçimi için [doküman haritası](docs/README.md)

Yalnız gerektiğinde:

- Proje geneli veya mimari değişiklikte `README.md` ve
  `docs/architecture.md`
- Kod yapısı değişikliklerinde `docs/coding-standards.md`
- Test ekleme veya davranış değişikliğinde `docs/testing.md`

## Depo Haritası

- `frontend/`: React 19, TypeScript, Vite ve Nginx yapılandırması
- `backend/`: Express API, worker, veri erişimi ve migration'lar
- `ops/`: yedekleme, restore, preflight ve systemd araçları
- `performance/`: k6 yük testi
- `.github/workflows/`: CI/CD ve operasyon kontrolleri
- `docs/`: mimari ve operasyon dokümantasyonu

## Değişmez Kurallar

- Secret, gerçek parola, API anahtarı, özel anahtar, `.env`, SQLite dosyası
  veya kullanıcı upload'ı commitlenmez.
- Tarayıcı oturumu için bearer JWT eklenmez. Mevcut sistem veritabanı destekli
  opaque oturum cookie'si ve CSRF doğrulaması kullanır.
- Kritik yetki kontrolü yalnız backend'de `authenticateToken`,
  `requirePermission` veya kapsam denetimi ile yapılır.
- SQL değerleri parametreli sorgularla bağlanır. Kullanıcı girdisi doğrudan
  SQL parçasına eklenmez. Sıralama alanları allowlist ile seçilir.
- Mutasyon endpoint'leri CSRF korumasını atlamaz.
- Veritabanı bağlantısı hiçbir ortamda schema bootstrap veya seed çalıştırmaz.
  Şema yalnız sürümlü migration ile hazırlanır; production'da migration ayrı
  dağıtım adımıdır.
- Upload tipleri MIME, uzantı ve dosya imzası kontrollerini korur.
- Mevcut API URL'leri, hata sözleşmesi ve RBAC davranışı açık bir migration
  planı olmadan kırılmaz.

## Kod Yerleşimi

- Route: HTTP sözleşmesi, middleware ve response yönetimi
- Controller: HTTP girdisini servis çağrısına dönüştürme
- Service: iş kuralı ve transaction sınırı
- Repository: SQL ve veri eşleme
- Schema: Zod doğrulama sözleşmesi

Yeni büyük özellikler `backend/modules/<domain>/` altında bu ayrımı izlemelidir.
React sayfaları veri erişimini `frontend/src/services/api.ts` ve TanStack Query
üzerinden yürütmelidir. Büyük modal, panel ve form parçaları ayrı bileşenlere
ayrılır.

## Zorunlu Kontroller

Backend değişikliğinde:

```powershell
cd backend
npm test
```

Frontend değişikliğinde:

```powershell
cd frontend
npm run lint
npm run check:architecture
npm run build
npm run check:bundle
```

Docker veya deployment değişikliğinde ilgili Compose yapılandırması doğrulanır
ve [docs/deployment.md](docs/deployment.md) güncellenir.

Yalnız Markdown değiştiğinde uygulama testleri zorunlu değildir. Yerel
bağlantılar, komut ve dosya adları, kodla uyum ve `git diff --check` doğrulanır.

## Dokümantasyon Bakımı

- Yeni endpoint: `docs/api.md`
- Yeni/yenilenen iş kuralı: `docs/business-rules.md`
- Yeni environment değişkeni: `backend/.env.example` ve
  `docs/environment-variables.md`
- Yeni izin: frontend `Permission` tipi, kullanıcı ayarları ve
  `docs/authorization.md`
- Şema/migration değişikliği: `docs/database.md`
- Güvenlik kontrolü veya risk: `docs/security.md`

Doğrulanmamış davranış mevcut özellik olarak yazılmaz. Mevcut uygulama,
geliştirme kuralı ve öneri ayrı belirtilir. Doğrulanmış açık hatalar `docs/known-issues.md`
içinde, kaynak dosyası ve kapanış koşuluyla izlenir. Özellik eksikleri ve teknik
sınırlar `docs/improvements.md`, üretim kontrolleri
`docs/data-protection-checklist.md` içinde tutulur. Geçmiş test
başarısı güncel sonuç gibi sunulmaz; ilgili commit veya CI kaydı belirtilir.
