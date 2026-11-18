# Geliştirme konuları

Bu liste hata kaydı veya onaylanmış iş planı değildir. Konular ihtiyaç ve kapsam belirlendiğinde ele alınabilir.

## Özellik ve API eksikleri

- Kullanıcının parola değiştirme/sıfırlama akışı, MFA ve kurumsal SSO yok. Mevcut giriş yapısı [Kimlik Doğrulama](authentication.md) içindedir.
- OpenAPI tanımı yok. Tarayıcı API'si sürümsüz; ERP API'si `/api/integrations/v1` altında sürümlü. Dış istemci eklenecekse belgelendirme ve sürüm ihtiyacı belirlenmeli.
- İzin talebi yönetimi admin rolüne bağlı. Başka bir role bu iş verilecekse ayrı bir yönetim izni tasarlanmalı; mevcut davranış tek başına hata değildir.

## Teknik sınırlar

- PostgreSQL adaptörü SQLite `?` parametrelerini dönüştüren sınırlı bir parser kullanıyor. Yeni SQL yazarken desteklenen sözdizimi korunmalı; [Veritabanı](database.md) rehberine bakılmalı.
- CSV/Excel dışa aktarımları `api.listAll` ile bütün kayıtları topluyor. Büyük veriyle süre veya bellek sorunu ölçülürse sunucudan parça parça dışa aktarma değerlendirilebilir.
- Upload dosyaları tek sunucunun volume'unda tutuluyor. Birden fazla uygulama sunucusuna geçilecekse ortak dosya depolaması gerekir.

## Test kapsamı

Tarayıcı testlerinin çoğu hazırlanmış API yanıtlarıyla çalışıyor; gerçek API ve veritabanıyla uçtan uca doğrulamanın yerini tutmuyor. Onaylı görsel karşılaştırma referansları ve fiziksel cihaz test kayıtları depoda yok. Mevcut kapsam [Test ve Kalite](testing.md) içindedir.

Eğitime özgü PDF takibi ve durum gösterimi gibi kararlar [Eğitim incelemesi](training-module-audit.md) içinde tutulur.
