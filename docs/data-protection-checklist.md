# Üretim veri koruma kontrolü

Bu liste, kodun varlığından çıkarılamayan ortam kontrolleri içindir. Üretim
kabulünde her madde için kontrol tarihi, sorumlu ve kanıt kaydedilmelidir.
Tamamlanmış bir denetim veya mevzuata uyum belgesi değildir.

- [ ] PostgreSQL veri diskinin şifreli olduğu doğrulandı.
- [ ] Uygulama ve yedek bağlantılarında doğrulanmış TLS kullanımı veya iç ağ
  için kabul edilmiş taşıma güvenliği kararı belgelendi. Mevcut Compose
  PostgreSQL bağlantısı TLS kullanmaz.
- [ ] Uygulama, migration ve yedek DB hesaplarının gerekli yetkilerle ayrıldığı doğrulandı.
- [ ] Restic parolası depo dışında ve kısıtlı erişimle saklanıyor.
- [ ] En az üç ayda bir üretim yedeğinden farklı hedefe geri yükleme yapılıyor;
  DB kayıtları ve upload bütünlüğü doğrulanıyor.
- [ ] Üretim secret'larına ve DB günlüklerine erişebilen kişiler kayıtlı.
- [ ] Saklama, silme, yedek rotasyonu ve geri yükleme sonrası silme süreçleri tanımlı.

Telefon, adres ve doğum tarihi uygulama düzeyinde kolon şifrelemesi kullanmaz.
Böyle bir özellik eklenirse anahtar saklama, rotasyon ve arama gereksinimleri
ayrıca tasarlanmalıdır. Mevcut log politikası [Log Kayıtları](audit-logs.md),
yedekleme adımları [Yedekleme](../ops/backup/README.md) belgesindedir.
