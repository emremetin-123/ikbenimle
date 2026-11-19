# İKBenimle Çalışan Portalı

İKBenimle, çalışanların iş yerindeki günlük bilgilere tek yerden ulaşmasını
ve taleplerini takip etmesini sağlayan açık kaynaklı bir çalışan portalıdır.
Çalışanlar duyuruları telefonlarından okuyabilir, eğitimlerini takip edebilir
ve izin ya da belge talebi gönderebilir. İK ekipleri ve yöneticiler de yetkileri
dahilinde duyuru yayınlayabilir, eğitim atayabilir, talepleri yanıtlayabilir ve
sonuçları raporlayabilir.

## Tanıtım videosu

<a href="docs/media/ikbenimle-tanitim.mp4">
  <img src="docs/media/ikbenimle-tanitim.jpg" width="640" alt="İKBenimle tanıtım videosu kapağı. Ana sayfa ve profil ekranları yan yana.">
</a>

[Tanıtım videosunu izle (24 saniye)](docs/media/ikbenimle-tanitim.mp4)

Müzik, [Sascha Ende](https://ende.app/en) imzalı *Happy Beats / Business Moves Vol. 11*
([CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)). Parça kısaltıldı ve
ses düzeyi ayarlandı. Ses efektleri [Kenney](https://kenney.nl/) arşivinden.

## Mobil ekranlar

![İKBenimle mobil önizlemesi. Ana sayfa, profil, çalışan rehberi, servis güzergahları, eğitimler ve modül menüsü altı telefon çerçevesinde gösteriliyor.](docs/images/mobil-portal.png)

*Mobil önizlemede örnek veriler kullanılmıştır.*

## Portalda neler yapılabilir?

- **Güncel bilgilere ulaşın.** Duyuruları, haberleri ve günlük yemek menüsünü
  görün. Servis hattınızı ve durakları haritadan inceleyin.
- **İşlerinizi takip edin.** Çalışan rehberinde ekip arkadaşlarınızı bulun.
  İzin ve belge taleplerinizi gönderin, durumlarını görün ve bildirim alın.
- **Eğitimlerinizi tamamlayın.** Atanan eğitimleri izleyin, sınavlara katılın
  ve kazandığınız rozetleri ve sertifikaları görüntüleyin.
- **Görüşünüzü paylaşın.** Anketleri yanıtlayın, öneri veya şikayet gönderin
  ve talebinizle ilgili gelişmeleri takip edin. Günlük ruh halinizi paylaşabilir
  ve yemek menüsünü değerlendirebilirsiniz.
- **Fırsatları keşfedin.** Şirket içi kariyer ilanlarını inceleyip başvurun,
  sık sorulan konulara Bilgi Portalı'ndan ulaşın.
- **Ekip becerilerini değerlendirin.** Yetkili kullanıcılar pozisyonlara göre
  beceri hedefleri belirleyebilir, dönemsel değerlendirme yapabilir ve sonuçları
  raporlayabilir. Bu süreç Polivalans modülünde yürütülür.

Projeyi denemek için [Docker ile ilk kurulum adımlarını](#ilk-kurulum-docker-ile-çalıştırma)
izleyebilirsiniz.

## Teknik yapı

- React 19, TypeScript ve Vite tabanlı web arayüzü
- Express 5 tabanlı Node.js API ve arka plan worker'ı
- PostgreSQL 17 üretim adaptörü ve izole otomatik testler için SQLite adaptörü
- Docker Compose, Caddy ve Nginx tabanlı dağıtım yapısı
- Test, güvenlik taraması, image üretimi ve VPS dağıtımı için GitHub Actions iş akışları
- Restic ve S3 uyumlu depolama ile şifreli uygulama yedekleri

## İlk Kurulum: Docker ile Çalıştırma

Projeyi bilgisayarınızda denemek için bu akışı izleyin. Git ve Docker Compose
v2 gerekir. Windows/macOS'ta Docker Desktop kurulu ve çalışır durumda olmalıdır;
Windows'ta Linux container modu kullanılmalıdır. Node.js veya PostgreSQL'i
ayrıca kurmanız gerekmez. 80 ve 443 portları boş olmalıdır.

### 1. Projeyi indirin

```sh
git clone https://github.com/emremetin-123/ikbenimle.git
cd ikbenimle
```

Sonraki bütün Docker komutlarını bu klasörde (`docker-compose.yml` yanında)
çalıştırın.

### 2. Ayar dosyasını hazırlayın

Windows PowerShell:

```powershell
Copy-Item backend/.env.example backend/.env
```

macOS/Linux:

```sh
cp backend/.env.example backend/.env
```

`backend/.env` zaten varsa kopyalama adımını atlayın; mevcut ayarlarınızın üzerine
yazmayın.

`backend/.env` dosyasındaki ilgili satırları aşağıdaki gibi düzenleyin.
Parola alanlarına kendi belirlediğiniz, en az 12 karakterlik deneme parolaları
yazın; `<...>` ifadelerini olduğu gibi bırakmayın.

```dotenv
SEED_DEFAULT_USERS=true
DEFAULT_ADMIN_PASSWORD=<yonetici-icin-belirlediginiz-parola>
DEFAULT_EMPLOYEE_PASSWORD=<calisan-icin-belirlediginiz-parola>
SEED_SAMPLE_DATA=true
```

Diğer ayarlar Docker ile yerel deneme için hazırdır. Bu parolalar ve Compose'taki
yerel veritabanı ayarları canlı ortam için kullanılmamalıdır.

### 3. Servisleri başlatıp deneme kullanıcılarını oluşturun

```sh
docker compose up -d --build
docker compose ps -a
```

İlk çalıştırmada image indirme ve derleme zaman alabilir. `migration` servisinin
`Exited (0)` olması normaldir; veritabanını hazırlayıp kapanır. Diğer servisler
başladıktan ve `backend` healthy olduktan sonra:

```sh
docker compose exec backend node scripts/seed-development.js
```

Komut başarılı olduğunda `Development seed completed.` mesajı görünür. Kullanıcılar
yalnız bu komutla oluşturulur; uygulamayı başlatmak tek başına yeterli değildir.

### 4. Giriş yapın

Tarayıcıda **http://localhost** adresini açın.

| Hesap | Sicil Numarası | Parola |
| --- | --- | --- |
| Yönetici | `admin` | `DEFAULT_ADMIN_PASSWORD` için yazdığınız parola |
| Çalışan | `1001` | `DEFAULT_EMPLOYEE_PASSWORD` için yazdığınız parola |

**http://localhost/health/ready** adresinin HTTP 200 dönmesi API ve veritabanının
hazır olduğunu gösterir. Yönetici hesabıyla giriş yapıp ana sayfanın açıldığını
da kontrol edin. AI ve web push gibi harici servisler ek ayar gerektirir;
ilk giriş için bu ayarlar zorunlu değildir.

### Durdurma ve tekrar açma

```sh
docker compose down
docker compose up -d
```

Veriler volume'larda saklanır; tekrar açarken seed çalıştırmanız gerekmez.
`docker compose down -v` veritabanı ve yüklenen dosyaları da siler. Seed komutunu
tekrar çalıştırmak mevcut kullanıcıların parolasını değiştirmez.

### Kurulumda takılırsanız

- Docker'a bağlanılamıyorsa Docker Desktop/Engine'in çalıştığını kontrol edin.
- 80/443 portu kullanımda hatası varsa bu portları kullanan diğer servisi durdurun.
- Servis durumları için `docker compose ps -a`, hata ayrıntısı için
  `docker compose logs --tail 100 migration backend` çalıştırın.
- Giriş olmuyorsa seed komutunun başarılı olduğunu ve yukarıdaki sicil/parola
  eşleşmesini kontrol edin. `.env` değişikliğinden sonra
  `docker compose up -d` çalıştırıp seed komutunu yeniden deneyin.

Kod geliştirirken API ve Vite'ı ayrı çalıştırmak için
[Geliştirme Rehberi](docs/development.md), container ayrıntıları için
[Docker Rehberi](docs/docker.md) kullanılır.

## Temel Komutlar

```powershell
cd backend
npm test
npm run migrate:status
```

```powershell
cd frontend
npm run lint
npm run check:architecture
npm run build
npm run check:bundle
```

## Dokümantasyon

- Tüm belgeler ve okuma sırası: [Doküman Haritası](docs/README.md)
- Kod yapısı: [Mimari](docs/architecture.md)
- Canlı sunucuya kurulum: [Dağıtım](docs/deployment.md)
- Ayarların açıklamaları: [Ortam Değişkenleri](docs/environment-variables.md)
- Test komutlarının kapsamı: [Test](docs/testing.md)

## Depo Kuralları

- Secret, parola, özel anahtar, gerçek `.env`, veritabanı veya upload dosyası
  Git'e eklenmez.
- Üretim şeması uygulama açılışında değiştirilmez; migration dağıtımdan önce
  ayrı adım olarak çalışır.
- Backend yetkilendirmesi güvenlik sınırıdır. Arayüzde buton gizlemek erişim
  kontrolü sayılmaz.
- API, veritabanı veya iş kuralı değişikliklerinde ilgili doküman aynı commit
  içinde güncellenir.
- AI kod asistanları için bağlayıcı çalışma talimatları
  [AGENTS.md](AGENTS.md) içindedir.

## Lisans

İKBenimle kaynak kodu [GNU Affero Genel Kamu Lisansı 3.0](LICENSE)
(AGPL-3.0-only) kapsamında lisanslanmıştır.
[Günün sözü içeriğinin](backend/content/README.md) kaynak ve lisans bilgileri
kendi belgesinde yer alır.
