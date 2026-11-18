# Docker

İlk kez kuruyorsanız [README'deki adımları](../README.md#ilk-kurulum-docker-ile-çalıştırma)
izleyin. Bu belge servislerin yapısını ve bakım komutlarını açıklar.

## Geliştirme Compose

`docker-compose.yml` servisleri:

| Servis | Görev |
| --- | --- |
| `postgres` | Kalıcı PostgreSQL 17 veritabanı |
| `migration` | API açılmadan önce sürümlü migration'ları uygular |
| `backend` | Express API |
| `worker` | Scheduler işleri |
| `frontend` | Nginx içinde React build |
| `caddy` | TLS ve public 80/443 girişi |

Named volume'lar:

- `backend_uploads`
- `postgres_data`
- `caddy_data`
- `caddy_config`

Yerel Compose da production ile aynı yaşam döngüsünü kullanır: `migration`
başarıyla bitmeden backend başlamaz. Seed otomatik değildir.

## Production Compose

`docker-compose.prod.yml` kaynak kod build etmez; GHCR'dan
`${IMAGE_TAG}` ile immutable backend, frontend ve backup image'larını çeker.

Geliştirme Compose ile karşılaştırıldığında:

- `migration` yine uygulamadan önce migration uygular; ayrı DB hesabı tanımlanabilir.
- `backup`: yalnız `backup` profile'ıyla tek seferlik çalışır

Production ayrıca `backup_status` ve `backup_work` volume'larını kullanır.
Backend, migration başarıyla tamamlanmadan; frontend de backend healthy olmadan
başlamaz.

## Container Güvenliği

Uygulama container'larında:

- read-only root filesystem
- yazılabilir `/tmp` için tmpfs
- `no-new-privileges`
- tüm Linux capability'lerini düşürme
- non-root image kullanıcısı
- backend/frontend resource limitleri

uygulanır. Caddy public olarak yalnız 80 ve 443 portlarını yayınlar; backend ve
frontend yalnız Docker network'e `expose` edilir.

## Image'lar

Backend Dockerfile Node.js 22 Debian slim tabanlıdır ve production dependency
kurar. Frontend multi-stage build sonrası unprivileged Nginx image'ına geçer.
Her iki image healthcheck içerir.

## Komutlar

```powershell
docker compose config
docker compose build
docker compose up -d
docker compose ps
docker compose logs --tail 200 backend
```

Bu komutlar `backend/.env` hazırlandıktan sonra depo kökünde çalıştırılır.
Docker container'ında `npm` bulunmaz; geliştirme seed'i gibi bakım script'leri
doğrudan Node.js ile çalıştırılır:

```sh
docker compose exec backend node scripts/seed-development.js
```

Seed ayarları ve deneme hesapları [README'de](../README.md) açıklanır.

Aşağıdaki örnek yalnız servis başlatmayı gösterir; preflight, yedek ve migration
adımlarının yerine geçmez. Normal sürüm yayını [Dağıtım](deployment.md) akışıyla yapılır:

```bash
IMAGE_TAG=<commit-sha> docker compose -f docker-compose.prod.yml up -d
```

Yedekleme için `IMAGE_TAG` ortamda doğrulanmış sürüm etiketiyle tanımlı olmalıdır:

```bash
docker compose -f docker-compose.prod.yml --profile backup run --rm backup
```

## Kalıcı Veri

Container silmek named volume'u silmez. `docker compose down -v` upload ve
PostgreSQL verisini kaldırabileceği için production'da kullanılmamalıdır.
