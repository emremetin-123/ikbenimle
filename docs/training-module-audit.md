# Eğitim modülü incelemesi

3 Kasım 2026 tarihinde mevcut kaynakla karşılaştırılmıştır. Eski denetimde
çözülen sorunlar aşağıda kapalı olarak listelenir. Yeni özellik önerileri
mevcut davranış veya zorunlu uygulama kuralı değildir.

## Kaynak haritası

| Alan | Kaynak |
| --- | --- |
| Çalışan listesi | `frontend/src/pages/Trainings.tsx` |
| Oynatıcı ve sınav | `frontend/src/VideoPlayer.tsx`, `frontend/src/video-player/` |
| Yönetim | `frontend/src/AdminTraining.tsx`, `frontend/src/admin-training/` |
| Sunucu kuralları | `backend/modules/training/` |
| Yeniden atama | `backend/modules/training/expiredTrainingWorker.js`, `backend/worker.js` |

Eğitim, sıralı modüller ve her modüldeki video/PDF içeriklerinden oluşur.
İlerleme içerik bazında, sınav modülün son içeriğine bağlı tutulur. Profiller,
tamamlama ve sürüm kuralları [İş Kuralları](business-rules.md#eğitim) içindedir.

## Kapatılmış bulgular

| Eski bulgu | Güncel durum |
| --- | --- |
| Paralel eski çalışan dashboard'u | Kullanılmayan kaynak ağacı kaldırıldı. |
| Sınavsız eğitimin başarısız sayılması | Rapor başarı hesabı ve sunucu özeti düzeltildi. |
| Liste/oynatıcı isteği hata verince boş veya sürekli yükleme ekranı | Hata ve yeniden deneme görünümü var. |
| Harici örnek video fallback'i | Eksik içerik hata olarak gösteriliyor. |
| Atamada pozisyon filtresi ve seçili kişi özeti eksikliği | İki kontrol de var. |
| Mobil raporda eksik indirme aksiyonları | Ortak aksiyon sunumu kullanılıyor. |
| Tek harfli rapor düğmeleri | İkon ve erişilebilir ad kullanılıyor. |
| Oynatıcıda tarayıcı alert'leri | Ekran içi hata alanı kullanılıyor. |
| Yeniden atamanın çalışan sayfayı açana kadar gecikmesi | Worker başlangıçta ve 15 dakikada bir kontrol ediyor; veritabanı lease'i kullanıyor. |

## Kalan işler ve kararlar

| Konu | Mevcut durum | Sonraki adım |
| --- | --- | --- |
| PDF ilerlemesi | Sayfa bilgisi kullanıcıdan alınıyor. | Görüntüleyici seçildikten sonra otomatik sayfa bilgisini mevcut ilerleme API'sine bağlamak. |
| Durum sözlüğü | Tamamlama, içerik ilerlemesi ve sınav sonucu farklı ekranlarda ayrı türetiliyor. | Mevcut alanlardan ortak sunum modeli çıkarmak; yeni kalıcı durumları ayrıca değerlendirmek. |
| Oluşturma/düzenleme | Politika ve normalizasyon yardımcıları ortak; tüm içerik dönüşümleri ortak değil. | Aynı sözleşmeyi kullanan dönüşümleri birleştirmek. |
| Harici video | Harici kaynak desteği için açık ürün politikası yok. | İzin verilen kaynakları ve hata davranışını belirlemek. |
| Çalışan kartı | Arama ve sıralama var; mevcut ders/ilerleme özetinin API kapsamı ayrıca doğrulanmalı. | API'nin sağlamadığı ilerlemeyi arayüzde türetmemek. |
| Katalog ve rapor yerleşimi | Aynı yönetim akışında sunuluyor. | Sekme veya ayrı sayfa kararını kullanım ihtiyacına göre vermek. |
| Test kapsamı | Modül, izleme, rozet ve sertifika senaryoları var. | Yeni değişiklikte ilgili profil/içerik kombinasyonunu sınamak. |

## Değişiklikte korunacak ayrımlar

- İçeriğin bitmesi, sınavın geçilmesi ve atamanın tamamlanması ayrı durumlardır.
- Sınavsız tamamlanan eğitim başarısız olarak etiketlenmez.
- Atama anındaki eğitim sürümü ve geçmiş kanıtlar korunur.
- Sertifika PDF'ini sunucu üretir; profil ve eğitim listesi aynı belgeyi açar.
- Sanallaştırma, yeni durum enum'u veya bütün formları tek bileşene toplama
  ölçüm ve ihtiyaç olmadan zorunlu refactor sayılmaz.

Test komutları ve fixture yaklaşımı [Test ve Kalite](testing.md) içindedir.
