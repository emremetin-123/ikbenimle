# Geliştirme

Uygulamayı yalnız denemek için [README'deki Docker kurulumu](../README.md#ilk-kurulum-docker-ile-çalıştırma)
yeterlidir. Bu rehber, kod değiştirirken API ve Vite'ı bilgisayarınızda ayrı
çalıştırmak içindir.

## Gereksinimler

- Node.js 22
- npm (Node.js ile gelir)
- Git
- Yerel veya erişilebilir PostgreSQL 17 ve veritabanı hazırlamak için `psql`

## Yerel Kurulum

### 1. Projeyi ve ayar dosyasını hazırlayın

```sh
git clone https://github.com/emremetin-123/calisanportal.git
cd calisanportal
```

Windows PowerShell:

```powershell
Copy-Item backend/.env.example backend/.env
```

macOS/Linux:

```sh
cp backend/.env.example backend/.env
```

Depo zaten bilgisayarınızdaysa tekrar klonlamayın. Ayar dosyası zaten varsa
kopyalama adımıyla üzerine yazmayın.

### 2. Veritabanını hazırlayın

PostgreSQL kurulu ve çalışır durumda olmalıdır. Yeni bir yerel kurulumda
aşağıdaki komutla PostgreSQL yönetici hesabına bağlanın. Yönetici adı farklıysa
`postgres` yerine kendi hesabınızı yazın.

```sh
psql -h localhost -U postgres -d postgres
```

Açılan `psql` oturumunda aşağıdaki SQL komutlarını çalıştırın. Parola yerine kendi
yerel geliştirme parolanızı yazın. Hesap ve veritabanı zaten varsa bu oluşturma
adımlarını atlayın.

```sql
CREATE ROLE ikbenimle LOGIN PASSWORD '<yerel-veritabani-parolaniz>';
CREATE DATABASE ikbenimle OWNER ikbenimle;
```

`\q` yazarak `psql` oturumundan çıkın. `backend/.env` dosyasındaki ilgili
satırları aşağıdaki gibi düzenleyin; `DB_PASSWORD` yukarıda belirlediğiniz
veritabanı parolası olmalıdır. Deneme hesapları için de kendi parolalarınızı yazın
(en az 12 karakter). `<...>` ifadelerini olduğu gibi bırakmayın.

```dotenv
NODE_ENV=development
DB_TYPE=postgres
DB_SERVER=localhost
DB_PORT=5432
DB_NAME=ikbenimle
DB_USER=ikbenimle
DB_PASSWORD=<yerel-veritabani-parolaniz>
DB_SSL=false
CORS_ORIGINS=http://localhost:5173
PUBLIC_APP_URL=http://localhost:5173
SEED_DEFAULT_USERS=true
DEFAULT_ADMIN_PASSWORD=<yonetici-icin-belirlediginiz-parola>
DEFAULT_EMPLOYEE_PASSWORD=<calisan-icin-belirlediginiz-parola>
SEED_SAMPLE_DATA=true
```

Yerelde çalışan API için PostgreSQL'e host üzerinden erişilebilmelidir.
Depodaki Compose servisi host portu açmaz; `docker compose up -d postgres`
komutu bu akış için tek başına yeterli değildir. Erişilebilir bir PostgreSQL
kurulumu kullanın ve yukarıdaki bağlantı değerlerini ona göre doldurun.
Veritabanını da bu depodaki Compose ile çalıştırmak istiyorsanız aşağıdaki
Docker akışını kullanın; API de aynı Docker ağı içinde çalışır.

### 3. Backend'i başlatın — birinci terminal

Proje kökünden:

```powershell
cd backend
npm ci
npm run db:setup
npm start
```

`db:setup`, önce bütün migration'ları uygular, ardından yalnız development
ortamında çalışabilen açık seed komutunu çağırır. Örnek kullanıcı veya domain
verisi istenmiyorsa bunun yerine yalnız `npm run migrate` kullanılır.

Bu terminali açık bırakın. `db:setup` başarılı olmadan sonraki adıma geçmeyin.

### 4. Frontend'i başlatın — ikinci terminal

Yeni bir terminal açıp proje köküne (`calisanportal`) gidin, ardından:

```powershell
cd frontend
npm ci
npm run dev
```

Tarayıcıda **http://localhost:5173** adresini açın. Yönetici için sicil `admin`,
çalışan için `1001` kullanılır; parolalar `.env` içinde belirlediğiniz değerlerdir.
API hazır kontrolü **http://localhost:5000/health/ready** adresinde HTTP 200
dönmelidir. Frontend varsayılan olarak `http://localhost:5000` API adresini
kullanır; ek frontend ayar dosyası gerekmez.

Vite farklı port önerirse önce 5173 portunu boşaltın; farklı port kullanacaksanız
`CORS_ORIGINS` ve `PUBLIC_APP_URL` değerlerini de güncelleyip backend'i yeniden
başlatın.

### Sonraki çalıştırmalar

Veritabanı çalışırken birinci terminalde `backend` klasöründen `npm start`, ikinci
terminalde `frontend` klasöründen `npm run dev` çalıştırın. Durdurmak için her iki
terminalde `Ctrl+C` kullanın. Yeni migration içeren kod değişikliği aldıysanız
API'yi başlatmadan önce backend'de `npm run migrate` çalıştırın.

## Kullanıcı Verisi

Varsayılan kullanıcılar kendiliğinden üretilmez. Yerel seed gerekiyorsa
`SEED_DEFAULT_USERS=true` ve seed parola environment değerleri açıkça
tanımlanır. Örnek domain verisi için `SEED_SAMPLE_DATA=true` gerekir. Bu
bayraklar ancak `npm run seed:development` veya `npm run db:setup` çalıştırılırsa
etki eder.

Örnek hesap/veri istemiyorsanız iki seed bayrağını `false` bırakıp `db:setup`
yerine `npm run migrate` kullanın. Bu durumda deneme hesaplarıyla giriş
yapamazsınız. Seed mevcut kullanıcıların parolasını güncellemez. AI ve web push
ayarları ilk giriş için zorunlu değildir.

Production verisi veya production veritabanı yerel geliştirmeye kopyalanmaz.

## Yerel Kurulumda Sorun Giderme

- `psql` bulunamıyorsa PostgreSQL'in komut satırı araçlarını kurup `bin`
  klasörünü PATH'e ekleyin veya PostgreSQL'in SQL Shell aracını açın.
- Veritabanına bağlantı reddediliyorsa PostgreSQL servisini ve `DB_SERVER` /
  `DB_PORT` değerlerini kontrol edin. Parola hatasında `DB_USER` / `DB_PASSWORD`
  değerlerini oluşturduğunuz hesapla karşılaştırın.
- API'de tablo bulunamadı hatası varsa backend'de `npm run migrate` çalıştırın.
- `EADDRINUSE` hatasında 5000 portunu kullanan eski backend sürecini durdurun.
- Giriş olmuyorsa backend'de `npm run seed:development` çıktısını kontrol edin.
  `.env` değişikliğinden sonra backend'i yeniden başlatın.

## Migration Geliştirme

- Yeni schema değişikliği `backend/migrations/` altında PostgreSQL için
  tanımlanır; SQLite test uyumluluğu korunur.
- Version ve checksum sırası korunur.
- Uygulama başlangıcına schema değişikliği eklenmez.
- Geri alma güvenli değilse `down` açıkça desteklenmez.
- PostgreSQL entegrasyon testi ve SQLite birim/HTTP testleri birlikte değerlendirilir.

Durum kontrolü:

```powershell
cd backend
npm run migrate:status
```

## Desteklenen Bakım Komutları

Bakım ve veri hazırlama işlemleri yalnız `backend/package.json` içindeki
komutlarla yürütülür:

- `npm run migrate`
- `npm run migrate:status`
- `npm run migrate:down`
- `npm run db:setup`
- `npm run seed:development`
- `npm run seed:load-test`

Tek seferlik veri düzeltmeleri yerine sürümlü migration veya belgelenmiş
bakım komutu kullanılır. Salt okunur inceleme ile veri değiştirme ayrılır.
İlişki denetimi için `npm run db:audit-relations`, ilk üretim yöneticisi için
`npm run bootstrap:admin` kullanılır; koşulları [Veritabanı](database.md) ve
[Dağıtım](deployment.md) belgelerindedir.

## Docker ile Çalıştırma

İndirme, ayar dosyası, seed ve ilk giriş adımları
[README'de](../README.md#ilk-kurulum-docker-ile-çalıştırma) birlikte anlatılır.
Servisler ve volume'lar için [Docker Rehberi](docker.md) kullanılır.

## Ortam Ayrımı

- `.env` dosyaları Git'e girmez.
- Frontend yalnız `VITE_` prefix'li build-time değerleri görür.
- Backend secret'ları hiçbir zaman frontend environment'ına taşınmaz.
- Production yapılandırması için [Ortam Değişkenleri](environment-variables.md)
  ve [Dağıtım](deployment.md) kullanılır.
