import { useState } from 'react';
import { Braces, Check, Clipboard, Download, KeyRound, PlugZap } from 'lucide-react';
import { API_BASE } from '../config';
import { endpoints, postmanCollection, downloadJson } from './reference';

export function IntegrationDocs() {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  const baseUrl = new URL(API_BASE || '/', window.location.origin).href.replace(/\/$/, '') + '/api/integrations/v1';

  const copyBaseUrl = async () => {
    try {
      await navigator.clipboard.writeText(baseUrl);
      setCopied(true);
      setCopyError('');
    } catch {
      setCopyError('Adres kopyalanamadı. Metni seçip elle kopyalayın.');
    }
  };

  return (
    <section className="premium-card integration-docs">
      <div className="integration-section-heading">
        <div>
          <span className="integration-eyebrow">3. Yazılımcı kurulumu</span>
          <h2>Bağlantıyı tamamlayın</h2>
          <p>Bu üç bilgiyi bağlanacak uygulamanın yazılımcısıyla paylaşın.</p>
        </div>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => downloadJson('ikbenimle-api.postman_collection.json', postmanCollection(baseUrl))}
        >
          <Download size={17} aria-hidden="true" /> Postman dosyasını indir
        </button>
      </div>

      <div className="integration-setup-steps">
        <article>
          <span className="integration-step-icon" aria-hidden="true"><KeyRound size={19} /></span>
          <div><strong>1. Erişim anahtarı</strong><p>Yukarıdan oluşturun ve yalnız bağlanacak uygulamanın sunucusunda saklayın.</p></div>
        </article>
        <article>
          <span className="integration-step-icon" aria-hidden="true"><Clipboard size={19} /></span>
          <div><strong>2. API adresi</strong><p>Aşağıdaki tek ana adres tüm İK ve bordro uygulamalarında aynıdır.</p></div>
        </article>
        <article>
          <span className="integration-step-icon" aria-hidden="true"><PlugZap size={19} /></span>
          <div><strong>3. Bağlantı testi</strong><p>Yazılımcınız önce durum adresini çağırır, ardından örnek bir çalışan gönderir.</p></div>
        </article>
      </div>

      <div className="integration-api-address">
        <div>
          <span>API adresi</span>
          <code>{baseUrl}</code>
        </div>
        <button type="button" className="btn-secondary" onClick={copyBaseUrl}>
          {copied ? <Check size={17} aria-hidden="true" /> : <Clipboard size={17} aria-hidden="true" />}
          {copied ? 'Kopyalandı' : 'Adresi kopyala'}
        </button>
      </div>
      {copyError && <p className="integration-inline-error" role="alert">{copyError}</p>}

      <div className="integration-plain-note">
        Hazır Logo, Mikro veya Netsis bağlantısı seçmeniz gerekmez. Karşı uygulama bu standart API’ye bağlandığı sürece aynı veri akışları çalışır.
      </div>

      <details className="integration-developer-details">
        <summary><Braces size={18} aria-hidden="true" /> Geliştirici ayrıntılarını göster</summary>
        <div className="integration-developer-body">
          <p>Her istekte <code>Authorization: Bearer &lt;ERİŞİM_ANAHTARI&gt;</code> kullanın. JSON isteklerinde <code>Content-Type: application/json</code> ekleyin. Anahtarı tarayıcı uygulamasına veya kaynak koda koymayın.</p>

          <div className="integration-endpoints">
            {endpoints.map(endpoint => (
              <article key={endpoint.title}>
                <div><strong>{endpoint.title}</strong><small>{endpoint.description}</small></div>
                <code>{endpoint.method} {baseUrl}{endpoint.path}</code>
                <span>{endpoint.scope}</span>
                {endpoint.body && (
                  <details>
                    <summary>Örnek isteği göster</summary>
                    <pre>{JSON.stringify(endpoint.body, null, 2)}</pre>
                  </details>
                )}
              </article>
            ))}
            <article>
              <div><strong>Bordro PDF yükle</strong><small>Çalışan önce aynı bağlantıdan aktarılmış olmalıdır.</small></div>
              <code>POST {baseUrl}/payrolls/upsert</code>
              <span>payrolls:write</span>
            </article>
          </div>

          <details className="integration-reference">
            <summary>Alan eşleştirme ve aktarım kuralları</summary>
            <div>
              <p><code>external_employee_id</code> diğer uygulamadaki kalıcı çalışan kimliğidir. <code>employee_id</code> portal sicil numarasıdır. Çalışan adı ve bölümü de zorunludur.</p>
              <p>Çalışan durumu <code>active</code> veya <code>passive</code> olabilir. Pasif çalışan silinmez; erişimi kapatılır ve geçmiş kayıtları korunur. Rol, parola ve portal yetkileri entegrasyonla değiştirilemez.</p>
              <p>Çalışan ve izin bakiyesi isteklerinde 16–128 karakterlik <code>Idempotency-Key</code> başlığı zorunludur. Aynı işlemi yeniden denerken aynı değeri koruyun.</p>
              <p><code>source_updated_at</code> alanı saat dilimi içeren ISO-8601 biçimindedir ve eski verinin yeni veriyi ezmesini önler.</p>
              <p>İzin taleplerinde kuyruktan dönen kayıt kimliğiyle aktarım sonucunu bildirin. Başarılı sonuçta karşı uygulamadaki kayıt numarasını <code>external_reference</code> alanında gönderin.</p>
            </div>
          </details>

          <details className="integration-reference">
            <summary>Hata kodları ve tekrar deneme</summary>
            <div>
              <ul>
                <li><strong>400:</strong> Alanları, tarihleri ve Idempotency-Key başlığını kontrol edin.</li>
                <li><strong>401:</strong> Erişim anahtarı eksik, geçersiz, iptal edilmiş veya süresi dolmuş olabilir.</li>
                <li><strong>403:</strong> Bağlantı, veri akışı veya IP izni kapalı olabilir.</li>
                <li><strong>409:</strong> Çalışan eşleşmesi ya da kayıt durumu uygun değildir.</li>
                <li><strong>429:</strong> İstekleri yavaşlatın ve Retry-After başlığına uyun.</li>
                <li><strong>5xx:</strong> Artan bekleme süresiyle yeniden deneyin.</li>
              </ul>
              <p>Destek kaydına erişim anahtarını, parolayı veya kişisel veriyi eklemeyin.</p>
            </div>
          </details>
        </div>
      </details>
    </section>
  );
}
