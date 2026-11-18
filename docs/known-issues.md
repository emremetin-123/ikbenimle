# Bilinen sorunlar

Bu dosya kodda doğrulanan ve henüz düzeltilmemiş hataları içerir.
Son kontrol: 3 Kasım 2026.

## Kullanıcı yöneticisi sistem yöneticisini pasifleştirebiliyor

`backend/modules/users/adminUserRoutes.js` içindeki DELETE işlemi, PUT işlemindeki
hedef admin denetimini uygulamıyor. Geçici SQLite veritabanı ve gerçek oturum/CSRF
middleware'i ile yapılan yerel kontrolde `manage_users` sahibi employee, başka
bir admin için HTTP 200 aldı; hedef `passive` oldu. Bu işlem hedefin oturumlarını
da iptal ediyor. Normal employee için bu yetki gösterilmedi.

Kapanış koşulu: admin hedeflerin pasifleştirilmesi yalnız admin aktöre açılmalı;
reddedilen istekte hedef ve oturumları değişmemeli, regresyonla doğrulanmalı.

## Dosya yetkilendirmesinde yol normalleştirme farkı

`backend/middleware/uploadAccess.js` ham yolun ilk klasörünü denetlerken
`backend/middleware/privateFiles.js` ve static dosya sunucusu yolu farklı
normalleştiriyor. Doğrudan backend'e yapılan yerel istekte, yapay bir başkasına
ait belge normal yolda 403 verirken izin verilen klasörden üst dizine geçiş
içeren yolda 200 ve dosya içeriği döndürdü. X-Accel modunda da middleware özel
belgeye yönlendirme üretti. Dosya yolunun bilinmesi ve geçerli oturum gerekiyor.

Repository Nginx yapılandırmasıyla izole container denemesinde normal ve kodlanmış
geçiş denemeleri 403/404 verdi; bu bulgu canlı proxy üzerinden sömürülebilirlik
kanıtı değildir. Backend doğrudan erişimi veya proxy değişimi riski artırır.

Kapanış koşulu: dosya yolu bir kez kanonik hale getirilmeli veya kanonik olmayan
yollar reddedilmeli; sahiplik ve dosya sunumu aynı yolu kullanmalı. Doğrudan
backend, static ve X-Accel akışları regresyonla doğrulanmalı.

## Cloudinary kullanıldığında hassas dosyaların teslimat koruması eksik

`backend/services/uploadStorageService.js` ile `backend/config/multer.js`, belge
ve geri bildirim eklerini Cloudinary'ye gönderirken özel teslimat türü veya
erişim kontrolü belirtmiyor; dönen CDN URL'si saklanıyor. Cloudinary varsayılan
`upload` türünü public olarak tanımlar: [resmi erişim belgesi](https://cloudinary.com/documentation/control_access_to_media).
Bu akışta CDN erişimi uygulamanın `/uploads` sahiplik denetiminden geçmez.

Kod yolu doğrulandı; canlı Cloudinary hesabının kullanımı, varsayılan preset'leri
ve mevcut dosyaların dış erişimi incelenmedi. Risk Cloudinary etkinse ve hesapta
ek erişim kısıtı yoksa geçerlidir. Bordro makine API'sinin zorunlu yerel depolama
akışı bu bulguya dahil değildir.

Kapanış koşulu: hassas ekler korumalı yerel depolamada tutulmalı veya Cloudinary
authenticated teslimatı ve yetki kontrolünden sonra süreli erişim uygulanmalı;
mevcut dosyalar da gözden geçirilmeli. Oturumsuz ve ilgisiz kullanıcı erişiminin
reddedildiği doğrulanmalı.

## Yük testi düzeltmelerinin staging doğrulaması

Yük testi araçlarındaki iki kod uyumsuzluğu giderildi: workflow PostgreSQL
ayarlarını kullanır; k6 duygu isteği API şemasına uyar ve günlük durum kontrolü
ile çerezleri korur. Yerel regresyon kapsamı [Test ve kalite](testing.md)
belgesindedir. Ortam doğrulaması olarak `seed_data=true` ile gerçek staging
workflow koşusu hâlâ gereklidir; yerel testler staging bağlantısı, TLS ve
performans eşiklerinin sağlandığını göstermez.

Özellik eksikleri ve teknik sınırlar [Geliştirme konuları](improvements.md) içindedir.
Üretim ortamı kontrolleri [Veri koruma kontrolü](data-protection-checklist.md) içinde izlenir.
