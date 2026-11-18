# Arayüz düzenlemelerinin durumu

3 Kasım 2026 tarihinde kaynak kodla karşılaştırılmıştır. Bu belge önceki arayüz
çalışmasının sonuçlarını özetler; sürekli güncellenen test başarı kaydı değildir.
Güncel test sonucu ilgili commit'in CI kaydından alınmalıdır.

## Uygulanan düzenlemeler

- Aktif olmayan çalışan dashboard'u ve kullanılmayan `App.css` kaldırıldı.
- İş modalları `ModalShell` üzerinden ortak odak, Escape ve kaydırma davranışı kullanıyor.
- `IconButton`, `FormField`, `StatusBadge`, `AsyncState`, `Toolbar` ve
  `FilterBar` var; bütün ekranların bunlara geçişi tamamlanmış değil.
- Modül girişlerinde `ModulePageHeader` kullanılıyor. İstisnalar ve yerleşim kuralları
  [Kodlama Standartları](coding-standards.md) içinde tanımlı.
- CSS'teki `!important` kullanımı sıfırlandı. Mimari kontrol yeni kullanım,
  statik inline stil, dosya bütçesi ve polivalans kapsam ihlallerini denetliyor.
- Mobil yakınlaştırma kısıtları kaldırıldı.
- Eğitim raporunda mobil aksiyonlar masaüstüyle ortak sunuluyor; harfli kontroller
  yerine ikon ve erişilebilir ad kullanılıyor.
- Eğitim listesi ve oynatıcıda hata/yeniden deneme durumları var. Oynatıcıdaki işlem
  hataları tarayıcı `alert` penceresi yerine ekran içinde gösteriliyor.
- Sınavsız tamamlanan eğitimler başarı hesabında ayrı ele alınıyor.
- Süresi dolan eğitimlerin yeniden atanması liste isteğine bağlı değil;
  `expiredTrainingWorker.js` worker başlangıcında ve 15 dakikada bir çalışıyor.
- Polivalans raporu renkli özet kartları, hedef karşılama halkası, karşılaştırma
  çubukları ve beceri matrisi kullanıyor. Ayrıntılar [Polivalans arayüzü](polyvalence-ui.md).

## Açık konular

- Onaylı görsel karşılaştırma referansları ve fiziksel cihaz testi kayıtları yok.
- PDF ilerlemesinde manuel sayfa girişi sürüyor; otomatik takip için görüntüleyici seçimi gerekiyor.
- Eğitim listesi, oynatıcı ve yönetim raporunun tüm durumları tek bir sunum
  modelinde birleşmiş değil.
- Oluşturma/düzenleme formlarındaki içerik dönüşümlerinin bir bölümü ayrı kalıyor.
- Harici video kaynakları için ürün politikası netleştirilmeli.
- Erişilebilirlik testleri belirli senaryoları kapsıyor; bütün uygulamanın
  erişilebilirlik onayı olarak yorumlanmamalı.

Ayrıntılar [Eğitim denetimi](training-module-audit.md) ve
[Geliştirme konuları](improvements.md) içinde; test komutları [Test ve Kalite](testing.md) içindedir.
Eski test adetleri, satır sayıları ve statik tarama eşleşmeleri güncel ölçüm
olmadığı için kaldırılmıştır.
