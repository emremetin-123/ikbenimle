# Arayüz envanteri

Bu belge aktif ekranları ve ortak bileşenleri gösterir. Geliştirme kuralları
[Kodlama Standartları](coding-standards.md), doğrulama komutları
[Test ve Kalite](testing.md), açık işler [Bilinen Sorunlar](known-issues.md) içindedir.
Dosya satır sayıları ve test adetleri ilgili kontrol komutlarından alınır.

## Uygulama yapısı

Bütün yollar, aksi belirtilmedikçe `frontend/src/` altındadır.

| Alan | Kaynak | Sorumluluk |
| --- | --- | --- |
| Sayfa seçimi | `App.tsx` | Yol eşleme, yetkili sayfa ve lazy yükleme |
| Yönlendirme altyapısı | `router.tsx` | Konum, gezinme, bağlantı ve query parametreleri |
| Uygulama kabuğu | `layouts/DashboardLayout.tsx`, `components/BottomNav.tsx` | Yan menü, üst bar, mobil gezinme |
| Çalışan sayfaları | `pages/` | Ana sayfa, profil ve çalışan modülleri |
| Yönetim | `AdminDashboard.tsx`, `Admin*.tsx` | İzinli modül seçimi, sorgular ve ekran durumu |
| Alt bileşenler | `admin-*/`, `pages/personal-info/`, `video-player/` | Form, rapor, oynatıcı ve detaylar |

## Ortak bileşenler

| Bileşen | Kullanım |
| --- | --- |
| `ModulePageHeader` | Modül giriş başlığı, ikon, açıklama ve sağ aksiyon alanı |
| `PageHeader` | Kendi yerleşimini kullanan ekranların başlık kabuğu |
| `ModalShell` | Portal, odak kilidi, Escape, kaydırma kilidi ve odak dönüşü |
| `AppFeedback` | Bildirim, onay ve kısa metin istemi |
| `AsyncState`, `LoadingIndicator` | Yükleme, hata, yeniden deneme ve boş durum |
| `FormField` | Etiket, açıklama ve hata bağlantısı |
| `IconButton`, `StatusBadge` | Erişilebilir ikon kontrolü ve metinli durum tonu |
| `Toolbar`, `FilterBar`, `PaginationControls` | Liste araçları, arama bölgesi ve sayfalama |
| `ExportExcelButton` | Dışa aktarma düğmesi; dosya biçimini çağıran ekran belirler |
| `ProfileAvatarImage`, `AchievementBadgeCard` | Avatar ve kazanılmış rozet |
| `TrainingCertificateModal` | Sunucunun ürettiği sertifika PDF'inin önizlemesi ve indirilmesi |
| `ServiceRouteMap` | Leaflet haritası ve servis durakları |

Bu bileşenler bütün ekranlarda aynı ölçüde kullanılmaz. Polivalans matrisi,
harita ve oynatıcı gibi farklı etkileşimler ayrı bileşenlerde kalır.

## Modüle özgü yapılar

| Alan | Kaynak | İçerik |
| --- | --- | --- |
| Ana sayfa | `pages/Home.tsx`, `components/home/` | Karşılama, özet, hızlı erişim, haber/duyuru, yemek, doğum günleri ve hatırlatmalar |
| Profilim | `pages/PersonalInfo.tsx`, `pages/personal-info/` | Profil özeti, fotoğraf, rozet/sertifika, bölüm bazında düzenlenen kişisel bilgiler |
| Eğitim | `admin-training/`, `video-player/`, `pages/Trainings.tsx` | Katalog, modül/içerik, atama, sınav, rapor |
| Polivalans | `admin-polyvalence/`, `pages/PolyvalenceTasks.tsx` | Değerlendirme, ayarlar, dönem ve rapor |
| Geri bildirim | `feedback/`, `pages/feedback/`, `admin-feedback/` | Liste, form, yazışma ve karar |
| Profil | `pages/personal-info/` | Profil alanları, eğitim kayıtları ve rozetler |
| Yemek | `admin-meal-menu/` | Menü editörü ve değerlendirme analizi |
| Bildirim | `admin-notifications/` | Şablon, rutin ve cihaz abonelikleri |
| İşlem günlüğü | `audit/`, `AdminAuditLogs.tsx` | Filtre, kayıt detayı, dışa aktarma ve saklama koruması |

## Stil sorumlulukları

Yükleme sırası `index.css` içinde tanımlıdır:

1. `tokens.css`: renk, tipografi ve hareket değişkenleri.
2. `app-shell.css`, `base-and-layout.css`: uygulama kabuğu ve temel yerleşim.
3. `components.css`: ortak kontroller; ardından `employee-theme.css`: kişisel alan teması.
4. `module-*.css`: modül stilleri; ortak modül başlığı `module-page-header.css` içindedir.
5. `responsive.css`: uygulama genelindeki ekran boyutu kuralları.

Ana sayfa ve Profilim'in ortak içerik paleti `employee-theme.css` içindedir.
Bütün sayfaların mobil üst barı `MobileHeader`, alt barı `BottomNav` bileşenidir;
mobil kabuk stilleri `responsive.css` tarafından yönetilir. Eski yüzen profil
düğmesi ve sayfaya özel bar stilleri kaldırılmıştır.
Profil yerleşimi ve form stilleri `module-profile.css` tarafından
yönetilir; eski renkli panel teması kaldırılmıştır.
Ana sayfanın yerleşimi `home.css`, duygu/bildirim kartları ve portal
detayları `module-home-widgets.css`, hatırlatma kontrolleri
`module-home-reminders.css` içindedir. Bu dosyalar yalnız ana sayfa ile
yüklenir; eski haber slider ve global modal stilleri kullanılmaz.
Polivalans dosyaları yalnız `.poly-*`
seçicileri taşır. Statik inline stiller ve yeni `!important` bildirimleri mimari
kontrol tarafından reddedilir. Veriye bağlı CSS değişkenleri, kontrol script'indeki
izin listesiyle izlenir; güncel adet için `npm run check:architecture` çalıştırılır.

`EmployeeDashboard.tsx`, `employee-dashboard/`, `App.css` ve
`personalInfoStyles` eski envanterde yer alıyordu; güncel kaynakta bulunmaz.
