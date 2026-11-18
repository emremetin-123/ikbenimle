# İş Kuralları

## İşlem günlüğü

Log Kayıtları yalnız sistem yöneticisine açıktır. Başarılı genel olaylar 180,
kritik/güvenlik/başarısız veya sonucu doğrulanmamış olaylar 365 gün tutulur.
Worker günlük kontrolle süresi dolan, koruma altında olmayan olayları siler;
kişisel içeriksiz imha adet özeti en az üç takvim yılı saklanır. Koruma açık
gerekçe gerektirir ve kaldırılınca süre yeniden başlamaz. Eğitim, sertifika,
polivalans ve özlük asıl kayıtları bu işten etkilenmez. Anonim duygu/çalışan
geri bildirimleri genel kullanıcı günlüğünün dışındadır. Kapsam ve istisnalar:
[Log Kayıtları](audit-logs.md).

Bu dosya yalnız kodda uygulanan temel kuralları özetler. Kolon ve endpoint
ayrıntıları için [Veritabanı](database.md) ve [API](api.md) kullanılır.

## Eğitim

- Eğitim profilleri `free`, `standard`, `supervised`, `compliance` değerlerini
  destekler.
- İçerik tipi video veya PDF'dir. Sunumlar PDF olarak yüklenir.
- Bir eğitim sıralı modüllerden, modül de ayrı başlıklı ve sıralı video/PDF
  içeriklerinden oluşur. Her içerik ayrı ilerleme kaydı tutar. Modüldeki son
  içeriğe bağlanan sınav varsa, sonraki modül sınav geçilmeden açılmaz.
- Standart/serbest eğitimlerde modül sınavı isteğe bağlıdır. Sınav zorunluluğu
  açılmışsa ve İSG/Kanuni Uyum şablonunda her modülde sınav bulunmalıdır.
- Compliance profilinde tam izleme, sınav ve zorunluluk kuralları zorlanır.
- Video için ileri sarma engeli ve sekme değişiminde durdurma eğitim bazında
  açılıp kapanabilir. Güvenli ilerleme ve aktivite kayıtları eğitim
  tamamlanmasının bütünlüğü için her eğitimde tutulur.
- Tam izleme gereken video derslerinde güvenilir süre tanımlanması zorunludur.
  İlerleme, client toplamı yerine server heartbeat aralıklarından hesaplanır;
  tek bir tamamlandı bildirimi dersi tamamlamaz. Eski bir derste güvenilir süre
  eksikse client'ın bildirdiği video süresi tamamlama hesabında kullanılmaz.
- İzleme oturumu kapatılıp yeniden açıldığında sunucudaki son güvenilir konumdan
  devam eder; yeniden giriş önceki ilerlemeyi sıfırlamaz.
- Son içerik tamamlandıktan sonra sayfadan çıkılıp yeniden girilse de sıradaki
  sınav, içerik veya çalışan onayı aksiyonu yeniden gösterilir. Onay sırasında
  atama durumu eski kalmışsa yalnız bütün dersler gerçekten tamamlandıysa yeniden
  hesaplanır.
- PDF ilerlemesi yüzde, sayfa ve aktif süreyle izlenir.
- Sınav geçme puanı ve deneme sınırı eğitim bazındadır. Deneme sonunda yeniden
  izleme zorunluluğu doğabilir.
- Atama, eğitim ve ders snapshot'ı ile sürüm numarasını saklar.
- Aynı çalışana aynı eğitim kökü için birden fazla aktif atama oluşturulmaz.
  Tamamlanan veya iptal edilen atamalar geçmiş olarak korunur ve sonrasında
  yeni atama yapılabilir. Yeni eğitim sürümü oluşturulduğunda ilerleme içeren
  aktif eski atama kendiliğinden değiştirilmez; yeniden atamada atlanan çalışan
  sayısı yöneticiye açıkça bildirilir.
- İptal edilen atamalar yönetim raporunda `Kaldırıldı` olarak görünür; aktif,
  tamamlanmayan veya süresi geçen atama sayılarına dahil edilmez ve yeniden
  kaldırma aksiyonu sunulmaz.
- Modül sınavı isteğe bağlıdır; eklendiğinde her soru 2-10 adet boş olmayan
  seçenek ve seçeneklerden birine bağlı doğru cevap içerir.
- Geçerliliği dolan ve otomatik tekrar açık olan tamamlanmış eğitim, çalışan
  eğitim listesini açtığında son aktif sürümle yeniden atanır.
- Rozet yalnız eğitimde `awards_badge` açıkken; sertifika yalnız
  `certificate_enabled` açık ve atama tamamlanmışken üretilir.
- Yeni/kaydedilen eğitimde rozet verilecekse yöneticinin rozet görselini
  yüklemesi zorunludur. Görsel eğitim sürümünde saklanır ve profil ile rehberde
  aynı dosyadan gösterilir. Görselsiz eski kazanımlar metin olarak korunur;
  otomatik rozet çizimi kullanılmaz. Rozet kapatıldığında görsel zorunlu değildir.
- Sertifika doğrulama referansı public, rate limited endpoint üzerinden
  kontrol edilir.

## Duyuru ve Haber

- Duyuru İşlemleri listesinde yalnız başlık ve yayın tarihi başlangıçta
  görünür. İçerik, yayınlayan, hedef kitle, son görünme tarihi ve ek dosya
  satır açıldığında gösterilir. Silme butonu satır kapalıyken de kullanılabilir;
  mevcut silme onayı korunur.

- Duyuru son görünme tarihi zorunludur.
- Çalışan listesi yalnız bugünün tarihinden önce sona ermemiş duyuruları
  döndürür.
- Hedef departman boşsa herkese, doluysa seçilen bir veya daha fazla departmana
  görünür.
- Duyuru PDF veya görsel ek taşıyabilir.
- Süresi dolmuş kayıt admin listesinde kalır.

## Geri Bildirim

- Kullanıcı öneri veya şikayet oluşturabilir; öneriye dosya eklenebilir.
- Kullanıcı kendi kayıtlarını ve katılımcı olarak eklendiği süreçleri görür.
- Katılımcı, genel geri bildirim modülü açık olmasa da ilgili kayda nesne
  kapsamıyla erişebilir.
- Yönetici sorumlu atar, katılımcı ekler, yorum yazar, kayıtları sonuçlandırır ve yeniden açabilir.
- Talebe atanan sorumlu, açık talebine aktif çalışanları katılımcı olarak
  ekleyebilir. Bu işlem mevcut sorumluyu ve katılımcıları korur.
- Durum geçmişi ayrı tabloda tutulur.
- Öneri formu ve sonuç PDF'i yönetim akışında üretilebilir.
- Çalışan açılışta Gönderdiklerim tablosunu görür; Dahil Olduklarım rozeti erişebildiği
  dahil olunan kayıtların sayısıdır. Mobilde satırlar kart olarak gösterilir.
- Talep sahibi yalnız kendisine açık yazışmaları görür ve açık mesaj gönderir.
  Sorumlu ve katılımcılar görüşlerini `Yalnız ekip` veya `Çalışana açık` olarak seçer.
  Talep sahibi süreç ekibine de eklense sahiplik önceliklidir; ekip içi notlar açılmaz.
- Yorumla birlikte en fazla 10 MB boyutunda bir PDF, JPEG, PNG, GIF veya WebP
  dosyası eklenebilir. Dosya, yorumun görünürlüğünü ve erişim kurallarını izler.
- İç karar notu yalnız yönetim API'sinde bulunur. Çalışan liste, detay ve geçmiş
  yanıtlarından çıkarılır; eski geçmiş kayıtlarındaki serbest notlar da gizlenir.
- Açık kayıtlar Alındı, Atandı ve İnceleniyor aşamalarından otomatik geçer.
  İlk atama Alındı durumunu Atandı yapar. Atama sonrası ilk yorum veya sorumlunun
  yeni katılımcı eklemesi incelemeyi başlatır. Atama notu ekip içi görüş olarak
  kaydedilir ve atamanın parçası olarak değerlendirilir.
  `replace_participants=true` ile gönderilen katılımcı listesi mevcut listeyi değiştirir;
  atanan sorumlu her zaman listeye eklenir. Alan verilmezse eski eklemeli davranış korunur.
- Sorumlu kendi incelemesini tamamlayabilir. Bu işlem idempotenttir ve talebi kapatmaz.
  Kayıt Atandı aşamasındaysa İnceleniyor durumuna geçer.
- Sonuçlandırmada karar ve çalışana resmi yanıt gerekir. `resolved`, eski `completed`
  ve `rejected` kayıtlar kapalıdır; yeni görüş, atama ve katılımcı ekleme sunucuda
  engellenir. Yönetici kaydı İnceleniyor aşamasına alarak yeniden açabilir. Yeniden açılınca
  sorumlu incelemesi sıfırlanır. Sorumlu değiştiğinde yeni sorumlunun incelemesi sıfırlanır.
- Sonuçlandırılan kayıtların durumunda Onaylandı, Reddedildi, Revizyon istendi
  veya Ertelendi kararı görünür. Kararı bulunmayan eski kapalı kayıtlar Tamamlandı,
  kaldırılan açık aşamalardaki eski kayıtlar İnceleniyor olarak gösterilir.
  Geçmiş kayıtları yeniden yazılmaz.
- Anonim kayıtlarda sahip kimliği tutulmaz; Gönderdiklerim listesinde gösterilmez.
  Yeni anonim kayıtların oluşturma geçmişine de kullanıcı kimliği yazılmaz.

## Belge Talepleri

- Talep tipleri ve tipe bağlı alanlar yönetilebilir.
- Alanlar required/optional olabilir ve çalışan formu tipe göre oluşur.
- Çalışan yalnız kendi taleplerini ve kendisine yüklenen sonucu görür.
- Yönetim durum, açıklama ve sonuç dosyasını günceller.
- Kodda kullanılan durumlar: `Beklemede`, `Hazırlanıyor`, `Tamamlandı`,
  `Reddedildi`.

## Anket

- Durumlar `draft`, `active`, `closed` değerleridir.
- Çalışan yalnız aktif anketleri yanıtlar.
- Her kullanıcı bir anketi bir kez yanıtlayabilir; veritabanı unique constraint
  ile de korur.
- Soru tipleri tek seçim, çoklu seçim, metin ve puanlamadır.
- Zorunlu sorular boş bırakılamaz.

## Duygu Durumu

- Arayüz aynı cihazdan gün başına tek yanıtı HttpOnly tarih çereziyle sınırlar.
  Sunucuda kullanıcı katılım kaydı tutulmadığı için çerez silme veya farklı cihaz
  yoluyla kesin tek-yanıt garantisi verilmez.
- Duygular 1-5 skoruna eşlenir.
- Düşük duygu için neden seçilebilir: iş yükü, kişisel, sağlık, iş ortamı,
  yönetici/iletişim, servis/ulaşım, yemekhane veya diğer.
- Yanıt yalnız departman anlık görüntüsüyle saklanır; kullanıcı, sicil ve pozisyon
  alanı içermez.
- Geri aranma talebi ayrı tabloda kimlikle tutulur; duygu, sebep veya yanıt
  kimliğiyle bağlantı içermez.
- Raporlar departman-gün bazında toplulaştırılır. En az üç yanıt içermeyen
  kohortlar rapor, export ve AI analizinden çıkarılır.

## Yemek Menüsü

- Menü tarihi benzersizdir.
- Kullanıcı gün ve kişi başına tek değerlendirme yapar; tekrar gönderim mevcut
  kaydı günceller.
- Yemek, çalışan tutumu ve temizlik ayrı 1-5 puanlarıdır; yorum opsiyoneldir.
- Admin tarih/ay filtresiyle özet, kişi detayı ve export alır.
- Menü PDF'i Gemini ile yapılandırılmış menü verisine dönüştürülebilir.
- Yemek Menüsü İşlemleri doğrudan değerlendirmeleri gösterir. Başlıktaki
  `Menü Ekle` butonu PDF okuma, günlük düzenleme, yayınlama ve kaldırma
  araçlarını bir pencerede açar. Pencere kapanırken taslak satırlar korunur;
  değerlendirme alanı yalnız yayınlanmış menüyü gösterir.

## Kariyer

- Çalışan yalnız aktif ilanları görür.
- İlan tarihi varsa son başvuru tarihi ondan önce olamaz.
- Kullanıcı aynı ilana bir kez başvurabilir.
- Başvuru durumları `pending`, `reviewing`, `approved`, `rejected` değerleridir.

## Bildirimler

- Push aboneliği kullanıcı ve tarayıcı endpoint'i ile tutulur.
- Rutin tipi günlük veya tek seferliktir; tek seferlik rutin gönderimden sonra
  pasifleşir.
- Duygu hatırlatma, doğum günü ve polivalans görev bildirim şablonları vardır.
- Scheduler veritabanı lease'i ile tekrar çalışmayı sınırlar.
- Bildirimler → olay bildirimlerinde `Tarihte Bugün` ve `Günün Sözü` şablonları
  bulunur. Başlangıçta pasiftir; yönetici ayrı ayrı açar, metinlerini ve günlük
  saatlerini ayarlar. Saatler `Europe/Istanbul` içindir; worker dakika başı kontrol
  eder, saat geçmişse o günün gönderimini yapar. Aynı gün saat değişmesi ikinci
  gönderim başlatmaz. Push izni ve aktif cihaz aboneliği gerekir.
- Tarihte Bugün, Türkçe Vikipedi Action API üzerinden ilgili günün `Olaylar`
  bölümünden okunabilir bir olay seçer. Günlük içerik `app_settings` içinde
  önbelleklenir; varsayılan mesaj kaynak/lisans bilgisini taşır ve tıklanınca
  kaynak gün sayfası açılır. Yönetici başka URL tanımlayabilir. API hatasında boş
  içerik gönderilmez; aynı worker 15 dakika sonra yeniden dener.
- Günün Sözü, `backend/content/dailyQuotes.json` içindeki 365 farklı Türkçe
  atasözünü kullanır; harici servis/anahtar gerektirmez. Her sözün kaynağı
  sabit Vikisöz revizyonuna bağlıdır; kişi atfı yerine `Türk atasözü` gösterilir.
  Kaynak ve içerik notları: `backend/content/README.md`.
- Söz sırası `app_settings.daily_quote_progress` değerinde son gönderilen
  sözün kalıcı kimliği ve Türkiye tarihiyle saklanır. En az bir cihaz için push
  servisi isteği kabul ettiğinde sıra ilerler; pasif geçen günler, eksik VAPID ayarı veya gönderimi başlatamayan
  hatalar söz atlatmaz. Worker yeniden başlatıldığında kaldığı yerden devam eder.
  365 sözün tamamı kullanılmadan aynı söz tekrar seçilmez; havuz bitince başa
  döner. İlk sürümdeki 31 söz için geçmiş sıra bilgisi bulunmadığından genişletilmiş
  havuz ilk gönderiminde yeni bir döngü başlatır.
- İki içerik mevcut push teslimatını kullanır. En az bir cihaz için push servisi
  isteği kabul ettiğinde gün tamamlandı sayılır; kısmi cihaz hataları aynı gün
  topluca tekrar gönderilmez. Kabul, cihazda görüntülendi/okundu kanıtı değildir.
  Tüm cihazların başarısız olması veya aktif cihaz bulunmaması günün kaydını ve
  söz sırasını ilerletmez; 15 dakika sonra tekrar denenir. Bu bekleme worker
  yeniden başlasa da korunur. VAPID eksikliği veya gönderimi başlatamayan hata
  günün kaydını kapatmaz. Son deneme özeti yalnız sayaç/zaman/durum içerir.
  Eski tarih işaretleri geriye dönük başarıya çevrilmez veya silinmez; aynı gün
  saati değiştirmek ikinci gönderim başlatmaz.
- Aktif cihaz/Toplam abonelik kartları ilgili filtreyle kullanıcı-cihaz listesini
  açar. Aynı kullanıcının birden fazla aboneliği olabilir. Aktif durumu gönderime
  açık aboneliktir; çevrimiçi/okudu anlamına gelmez. Son güncelleme abonelik
  kaydına aittir; son giriş saati değildir. Liste `manage_notifications` iznine
  veya admin rolüne açıktır; push anahtarları ve endpoint gösterilmez.

## Kişisel Hatırlatmalar

- Hatırlatmalar yalnız oluşturan kullanıcı tarafından listelenebilir, güncellenebilir
  ve silinebilir.
- Hatırlatma metni en fazla 300 karakterdir.
- Tamamlanma ve sabitleme durumu kullanıcı tarafından bağımsız olarak değiştirilebilir.
- Hatırlatmalar yönetici iş akışına, görev atamasına veya raporlamaya dahil edilmez.

## ERP Entegrasyonu

- Logo ürünlerine doğrudan bağımlı kod bulunmaz; şirket ağındaki connector,
  ürünün resmi API/SDK sözleşmesini portalın sürümlü makine API'sine uyarlar.
- ERP, çalışan temel bilgileri ve izin bakiyesi için kaynak sistemdir.
- ERP payload'ı rol, izin veya parola belirleyemez; mevcut admin hesabı
  entegrasyon üzerinden değiştirilemez.
- ERP'den yeni oluşturulan employee parola belirlenene kadar giriş yapamaz ve
  yalnız güvenli varsayılan görüntüleme izinlerini alır.
- Passive çalışanların aktif portal oturumları iptal edilir.
- İzin talebi ve aktarım kuyruğu kaydı aynı transaction içinde yazılır.
- Aktarım bağlantı ayarına göre talep oluşturulduğunda veya onaylandığında
  kuyruğa girer; connector kiralar ve Logo sonucu ile ACK gönderir.
- Çalışan ve bakiye senkronizasyonları `Idempotency-Key` gerektirir. Eski `source_updated_at`
  kayıtları yeni ERP verisini ezemez.
- İzin bakiyesi portalda salt okunurdur; güncellik eşiği aşılırsa kullanıcıya
  eski veri uyarısı verilir.

## Polivalans

- Seviye aralığı 0-3'tür: 0 bilgisiz, 1 gelişmeli, 2 yeterli, 3 uzman.
- Eğitim verebilir işareti yalnız seviye 3 için kaydedilebilir.
- Beceri ve kategoriler silinmez; arşivlenir.
- Dönem durumları `draft`, `open`, `closed`, `cancelled` değerleridir.
- Dönem açıldığında üye/beceri snapshot'ları, değerlendirmeler ve değerlendirici
  görevleri hazırlanır; önceki dönem puanları klonlanabilir.
- Kapanan dönem değiştirilemez; değişiklikler audit log'a yazılır.
- Üyelik departman ve pozisyonu kullanıcı havuzundan, değerlendiriciyi varsayılan
  olarak üst amirden alır; eksik otomatik eşleşmeler dönem açılmadan önce
  oluşturulur ve yönetim gerektiğinde manuel istisna tanımlayabilir.
- Manuel eşleşme kaldırıldığında kayıt silinmez; kullanıcının güncel bölüm,
  pozisyon ve üst amir bilgisine döndürülür. Açılmış dönemlerin snapshot'ları
  ve geçmiş görevleri bu değişiklikten etkilenmez.
- Eşleşme ayrıca pasifleştirilebilir; otomatik senkronizasyon bu tercihi korur.
  Pasif çalışan sonraki dönemlere alınmaz, açılmış dönemler değişmez.
- Aktif polivalans takvimleri worker tarafından dakikada bir kontrol edilir.
  Aynı bölümde açık dönem varsa ikinci dönem açılmaz; görevlerin tamamlanması
  dönemi kendiliğinden kapatmaz. Takvim kontrolü bu engeli `blocked` listesinde
  bildirir. Takvim ekranı mevcut açık dönemi ve son tarihi gösterir. Tamamlanmış
  değerlendirici görevleri bulunan bölümün raporunda yönetici, onayla dönemi
  kapatabilir; tüm bölümler kapsamından toplu kapatma yapılmaz.
  Elle kapatma, takvimdeki sonraki başlangıcı korur (eski dönem başlangıcından
  ilerideyse). Oluşan taslak otomatik zamanlayıcıyla aynı dönem adı ve dahil
  bitiş hesabını kullanır: başlangıç + süre - 1 gün.
  Hatırlatma günleri son tarihten önceki gün sayılarıdır; 0 son gündür.
  Yalnız açık dönemlerdeki tamamlanmamış/iptal edilmemiş görevlerin
  değerlendiricileri hedeflenir. Bildirim şablonu ve etkin cihaz aboneliği gerekir.
  Takvim kaydından sonra da zamanı gelmiş dönemler kontrol edilir; açma
  başarısızsa neden yöneticiye gösterilir. Gün hesabı Türkiye saatine göredir.
  Zamanlanmış bir dönem ilk denemede açılamazsa takvimin oluşturduğu taslak,
  eksikler giderildikten sonra yeniden denenir.
- Rapor izni olan employee yalnız kendi departmanının verisini görür; admin veya
  yönetim izni tüm şirket kapsamını görür.
- Beceri açığı eğitimle ilişkilendirilebilir ve eğitim ataması başlatılabilir.

## Servis ve Bilgi Portalı

- Çalışan yalnız aktif servis hatlarını görür.
- Duraklar sıralı koordinatlarla tutulur; rota OSRM üzerinden hesaplanabilir.
- Bilgi portalı araması kategori adı ve içerik alanlarında çalışır.
- Bilgi portalı içerik penceresi kendi stil sınıflarını kullanır; ana sayfanın
  modal stillerinden etkilenmez. Alt kategori filtreleri dar ekranda satırlara
  yayılır; çok sayıda filtrede filtre alanı ayrıca kaydırılır. Başlık ve
  kapatma alanı sabit kalırken içerik pencere içinde kayar.

## Bordro entegrasyonu

Dış sistem bordroları bağlantıya özel çalışan eşleştirmesiyle Bordrolarım alanına eklenir. Aynı dönem için bir bordro tutulur; düzeltme artan revizyonla aynı belgeyi günceller. Aynı kimlik ve revizyonda değişen dosya reddedilir. [Sözleşme](integrations.md#erp-bordro-pdf-aktarımı).
