# Şifreli yedekleme ve geri yükleme

Komutlar üretim sunucusunda `/opt/ikbenimle` altında çalıştırılır. Yapılandırma
örneği `ops/backup/.env.backup.example`, script'ler `backup.sh` ve `restore.sh`
içindedir. Gerçek bağlantı bilgileri ve Restic parolası Git'e eklenmez.

## Kurulum

1. `.env.backup.example` dosyasını aynı dizinde `.env.backup` olarak kopyalayın.
2. `/opt/ikbenimle/secrets/restic_password` dosyasını rastgele uzun parola ve
   `0600` izniyle oluşturun.
3. S3, DB ve zorunlu `BACKUP_HEALTHCHECK_URL` değerlerini doldurun. Yedek hesabı
   DB'yi okuyup dışa aktarabilmelidir.
4. İlgili image etiketinin `.release.env` içinde bulunduğunu doğrulayın.
5. `ops/systemd/` altındaki servis ve timer dosyalarını `/etc/systemd/system/`
   altına kurun ve etkinleştirin:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now ikbenimle-backup.timer
sudo systemctl list-timers ikbenimle-backup.timer
```

Tam dağıtım workflow'u, `REQUIRE_OFFSITE_BACKUP=true` olduğunda timer'ı kurar.
Kapalı olduğunda timer'ı devre dışı bırakır.

Timer Türkiye saatiyle 02:30'da çalışır. PostgreSQL custom-format dump ve
upload dosyaları SHA-256 manifestiyle hazırlanır. Restic, veriyi sunucudan
çıkmadan şifreler; 30 günlük, 12 haftalık ve 12 aylık snapshot saklar.
Son durum eksik/hatalı veya 36 saatten eskiyse `/health/backup` 503 döner.

## Geri yükleme tatbikatı

Kaynakla aynı adı taşımayan, boş bir hedef PostgreSQL veritabanı önceden
oluşturulmalıdır. Script hedefi kendisi oluşturmaz. Geri yüklemede kullanılan
hesap bu hedefe tablo ve veri yazabilmelidir; yalnız okuma yetkili yedek hesabı
yeterli değildir. Üretim hesabının yetkisini genişletmek yerine tatbikat için
ayrı bağlantı yapılandırması kullanın.

Aşağıdaki komutta `IMAGE_TAG`, doğrulanmış sürüm etiketi olarak ortamda tanımlı
olmalıdır. Compose'un kullandığı yedek bağlantı bilgilerinin tatbikat hedefi
ve yazma yetkili hesap için ayarlandığını kontrol edin.

```bash
docker compose -f docker-compose.prod.yml --profile backup run --rm \
  --entrypoint /usr/local/bin/restore.sh \
  -e RESTORE_DB_NAME=ikbenimle_restore_test backup
```

Script kaynak `DB_NAME` ile aynı hedefi ve dolu PostgreSQL hedefini reddeder.
SQLite tatbikatında kaynakla aynı dosya yolu reddedilir. Geri yükleme upload
hash'lerini doğrular; tablo kayıt sayıları ayrıca karşılaştırılmalıdır.
Tarih, snapshot kimliği, işlemi yapan kişi ve sonuç kaydedilir.

GitHub Actions tatbikatı geçici MinIO ile hem SQLite hem PostgreSQL/Restic
akışını sınar. En az üç ayda bir gerçek üretim yedeğiyle ayrı hedefe tatbikat
yapılmalıdır. Script'in `/work/restore` çıktısı, üretim upload volume'una
otomatik taşınmış sayılmaz.
