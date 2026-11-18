# Staging yük testi

Profil yalnız ayrı staging ortamı ve test hesapları içindir. Üretim URL'si,
veritabanı veya hesapları kullanılmaz.

## Hedef ortam

`.github/workflows/load-test.yml` içindeki `seed_data` adımı PostgreSQL kullanır.
Workflow'un URL kontrolü belirli üretim alan adını reddeder; her olası üretim
adresini tanıyan genel bir koruma değildir. Hedef operatör tarafından doğrulanır.

## Veri ve yapılandırma

`backend` klasöründe, ayrı staging DB bağlantısıyla veri hazırlanır:

```bash
LOAD_TEST_CONFIRM=staging \
DB_TYPE=postgres \
DATABASE_URL='<staging-postgresql-baglanti-adresi>' \
LOAD_TEST_PASSWORD='<staging-test-parolasi>' \
LOAD_TEST_USER_COUNT=500 \
npm run seed:load-test
```

GitHub `staging` environment'ında `STAGING_BASE_URL` variable'ı ve
`LOAD_TEST_PASSWORD` secret'ı tanımlanır. Veri hazırlığı için `STAGING_DB_SERVER`,
`STAGING_DB_NAME`, `STAGING_DB_USER`, `STAGING_DB_PASSWORD` secret'ları gerekir.
`STAGING_DB_PORT` variable'ı verilmezse 5432 kullanılır. Workflow TLS ve sunucu
sertifikası doğrulamasını etkinleştirir; özel CA gerekiyorsa `STAGING_DB_SSL_CA`
secret'ına PEM içeriği yazılır. Yerel komutta TLS için `DB_SSL=true` ve
gerekirse `DB_SSL_CA` kullanılır.
Seed, sürümlü migration'ları çalıştırır; tekrar çalıştırıldığında mevcut test
kayıtlarını çoğaltmaz. Kullanıcı sayısı ve önek, k6 değerleriyle
aynı olmalı; sanal kullanıcı sayısı hesap sayısını aşmamalıdır.

## Profil ve eşikler

`k6-smoke.js`, varsayılan olarak 100 rutin sanal kullanıcı ve ek bir giriş yükü
senaryosu çalıştırır. Oturum, duyuru, haber, günlük yemek menüsü ve eğitim
listesini okur; belirli aralıklarla duygu yanıtı gönderir. Rapor endpoint'leri
bu profilin kapsamında değildir. Duygu gönderimi yalnız `mood_id` ve `reason_key`
alanlarını kullanır. Her beş iterasyonda `/api/mood-check/today` kontrol edilir;
`submitted=false` ise yanıt gönderilir. Çerezler iterasyonlar arasında korunur;
böylece cihazın günlük gönderim sınırı uygulanır. Durum okuma veya gönderim
hataları başarısız kontrol olarak raporlanır, beklenmeyen 409 yanıtı gizlenmez.

| Ölçüm | Eşik |
| --- | --- |
| Hatalı HTTP oranı | %1'den az |
| Başarılı kontrol oranı | %99'dan fazla |
| Genel istek p95 | 800 ms altında |
| Okuma p95 | 500 ms altında |
| Yazma p95 | 800 ms altında |

Eşikler bir performans garantisi değildir. Sonuçla birlikte commit, ortam,
veri miktarı ve yük ayarları kaydedilmelidir.
