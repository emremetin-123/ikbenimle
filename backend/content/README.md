# Günün sözü içerikleri

`dailyQuotes.json`, çevrim dışı kullanılabilen 365 farklı Türkçe atasözü içerir.
Kişilere doğrulanmamış sözler atfedilmez; yazar alanı `Türk atasözü` olarak
gösterilir. Sözcük seçimleri kaynak derlemedeki geleneksel biçimlerdir;
bunlar güncel sağlık, finans veya iş talimatı değildir.

Kaynak: [Vikisöz — Türkçe atasözleri](https://tr.wikiquote.org/wiki/Türkçe_atasözleri).
Her kayıt `source` alanıyla `sources` tablosundaki sayfa adı ve sabit revizyon
URL'sine bağlanır. Kaynaklar 28 Ekim 2026 tarihinde incelendi. Sözlerin açıklamaları
alınmadı; geleneksel kısa atasözleri seçildi, noktalama ve boşlukları düzenlendi.
Vikisöz derlemesi için kaynak/katkı geçmişi ilgili revizyon URL'sindedir;
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.tr).

`id`, sözün kalıcı kimliğidir. Mevcut kimlikleri değiştirmeyin; ilerleme bunlarla
saklanır. Havuzdaki sıra, gönderim sırasıdır. Bildirim kapalı kaldığında sıra
ilerlemez; 365 gönderim tamamlanınca yeniden başlar. İçerik değiştirilirse yeni
kimlik verilir. Eski sürümdeki 31 söz için sıra kaydı bulunmadığından genişletilmiş
havuz yeni bir döngüyle başlar.

`dailyContent.test.js`, havuzun 365 benzersiz söz ve kimlik taşıdığını, kaynak
bağlantılarını, tam döngüyü, kesintilerden sonra devamı ve başarısız/atlanan
gönderimlerin sırayı ilerletmediğini doğrular.
