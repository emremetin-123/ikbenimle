# Doküman haritası

İlk kurulum için kök [README](../README.md) ile başlayın. Bu klasördeki belgeler
konularına göre ayrılır; aynı teknik kuralın ayrıntısı bir ana belgede tutulur,
diğer belgeler ona bağlantı verir.

## Okuma sırası

1. Geliştirme görevi: [AGENTS.md](../AGENTS.md), ilgili alan rehberi ve gerekirse
   [Kodlama Standartları](coding-standards.md).
2. İlk kurulum ve deneme: [README'deki Docker adımları](../README.md#ilk-kurulum-docker-ile-çalıştırma).
   Kod geliştirme için [Geliştirme](development.md), container ayrıntıları için [Docker](docker.md).
3. Üretim: [Dağıtım](deployment.md), [Ortam Değişkenleri](environment-variables.md)
   ve [Operasyon](production-runbook.md).

## Ana kaynaklar

| Konu | Belge | Burada tutulacak bilgi |
| --- | --- | --- |
| Ürün | [Proje](project.md) | Modüller ve dış sistemler |
| Mimari | [Mimari](architecture.md) | Bileşenler, veri akışı ve süreç sınırları |
| Backend | [Backend](backend.md) | Başlangıç, katmanlar ve HTTP altyapısı |
| Frontend | [Frontend](frontend.md) | Yönlendirme, ortak kontroller ve istemci veri erişimi |
| Kod kuralları | [Kodlama Standartları](coding-standards.md) | Yeni değişiklikte uygulanacak kurallar |
| İş kuralları | [İş Kuralları](business-rules.md) | Kodda uygulanan modül davranışları |
| API | [API](api.md) | HTTP yolları, girdi ve yanıt sözleşmeleri |
| ERP | [Entegrasyonlar](integrations.md) | Makine API'si, senkronizasyon ve kuyruk teslimatı |
| Oturum | [Kimlik Doğrulama](authentication.md) | Cookie, CSRF, süre ve giriş koruması |
| Erişim | [Yetkilendirme](authorization.md) | Roller, izinler ve kayıt kapsamı |
| Şema | [Veritabanı](database.md) | Tablolar, migration ve veri hazırlığı |
| İşlem günlüğü | [Log Kayıtları](audit-logs.md) | Kapsam, güvenilirlik ve saklama politikası |
| Güvenlik | [Güvenlik](security.md) | Uygulanan kontroller ve sınırları |
| Kalite | [Test ve Kalite](testing.md) | Komutlar ve testlerin kapsamı |
| Hatalar | [Bilinen Sorunlar](known-issues.md) | Doğrulanmış açık hatalar |
| Geliştirme | [Geliştirme konuları](improvements.md) | Özellik eksikleri ve teknik sınırlar |

## Kurulum ve operasyon

- [Geliştirme](development.md), [Docker](docker.md), [Ortam Değişkenleri](environment-variables.md)
- [Dağıtım](deployment.md), [Üretim operasyon rehberi](production-runbook.md)
- [Sorun Giderme](troubleshooting.md), [Üretim veri koruma kontrolü](data-protection-checklist.md)
- [Yedekleme](../ops/backup/README.md), [Staging yük testi](../performance/README.md)

Kök [DEPLOYMENT.md](../DEPLOYMENT.md) yalnız yönlendirmedir.
[Frontend README](../frontend/README.md) de ayrıntılı rehberlere bağlantı verir.

## Arayüz ve içerik notları

- [Arayüz envanteri](ui-inventory.md): aktif bileşenler ve stil sahipliği.
- [Arayüz düzenlemelerinin durumu](ui-final-report.md): önceki çalışmanın sonuç özeti.
- [Eğitim incelemesi](training-module-audit.md): kapatılmış bulgular ve kalan kararlar.
- [Polivalans arayüzü](polyvalence-ui.md): ekran davranışı, rapor ve hesaplama ayrımları.
- [Giriş arka planı](login-background.md): görsel dosyası ve özgün üretim istemi.
- [Günün sözü içeriği](../backend/content/README.md): kaynak, lisans ve kalıcı kimlikler.

## Bakım kuralı

- Mevcut davranış, geliştirme kuralı ve öneriyi ayrı yazın.
- Test başarısını, kapasiteyi veya güvenlik durumunu tarihsiz kesin sonuç olarak yazmayın.
- Değişen komut, ortam değeri veya sözleşmeyi ilgili ana kaynakta düzeltin.
- Ortamda kontrol edilmesi gereken bir ayarı kodda zorunluymuş gibi anlatmayın.
- Ayrıntıyı başka belgeye kopyalamak yerine bağlantı verin.
- Tamamlanan işi açık sorun listesinde bırakmayın. Yeni işlerin gerekçesini kaynak dosyasıyla belirtin.
