# Proje

## Amaç

İKBenimle, şirket içi çalışan ve yönetici süreçlerini web tabanlı tek portalda
toplar. Kod tabanında çok kiracılı (multi-tenant) müşteri ayrımı bulunmaz;
uygulama tek kurum bağlamında çalışır.

## Kullanıcı Grupları

- `employee`: kendisine açık modülleri ve kendi kayıtlarını kullanır.
- `admin`: tüm izin kontrollerini geçen sistem yöneticisidir.
- İzinli çalışan: rolü `employee` iken belirli `manage_*` veya rapor izni
  verilmiş kullanıcıdır.

## Modüller

| Alan | Sağlanan işlev |
| --- | --- |
| Ana sayfa | Günlük içerik, duygu seçimi, yemek değerlendirmesi ve haberler |
| Eğitim | Ders, video/PDF, sınav, atama, ilerleme, rozet, sertifika ve kanıt |
| Duyuru ve haber | Departman hedefli içerik, ek dosya ve görünürlük süresi |
| Öneri ve şikayet | Kayıt, katılımcı, yorum, durum, karar ve PDF çıktıları |
| Belgeler | Çalışan belgeleri, dinamik belge talebi ve sonuç dosyası |
| Anket | Anket oluşturma, yanıtlama, sonuç ve dışa aktarma |
| Duygu durumu | Günlük yanıt, neden, geri arama talebi ve departman analizi |
| Yemek menüsü | Menü yönetimi, yapay zeka ile PDF ayrıştırma ve puanlama |
| Bildirimler | Web Push aboneliği, rutinler ve olay bildirimleri |
| Kariyer | İlan, başvuru ve başvuru durumu |
| Bilgi portalı | Kategori, içerik ve metin araması |
| Servis güzergahları | Hat, durak, harita, rota ve yol tarifi bağlantısı |
| Polivalans | Beceri kataloğu, hedef, dönem, değerlendirme ve raporlama |
| Rehber ve izin | Çalışan rehberi ve izin talebi |
| Yapay zeka | Menü ayrıştırma, metin iyileştirme, analiz ve portal chatbot'u |
| API entegrasyonları | ERP çalışan/bakiye senkronu ve izin talebi aktarım köprüsü |

## Kaynak Kapsamı

Uygulama web tarayıcısı ve PWA manifesti sağlar. Depoda Android/iOS native
uygulama, ücretlendirme, çoklu şirket izolasyonu veya genel kullanıma açık
tenant kayıt akışı bulunmaz.

## Harici Sistemler

- PostgreSQL 17
- Google Gemini API
- Web Push tarayıcı altyapısı ve VAPID
- İsteğe bağlı Cloudinary
- OpenStreetMap/Nominatim ve OSRM
- Google Maps yönlendirme URL'leri
- S3 uyumlu depolama ve Restic
- GitHub Container Registry ve GitHub Actions
- Şirket ağında çalışacak ERP/Logo connector'ı; ürün özel adapter henüz bu
  depoda bulunmaz

Harici servislerin kurumsal sözleşmeleri ve hizmet seviyesi hedefleri bu
depoda tutulmaz. Üretim ortamı kontrolleri [Veri koruma kontrolü](data-protection-checklist.md)
ile izlenir.
