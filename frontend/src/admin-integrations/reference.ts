export const employeeExample = { employees: [{ external_employee_id: 'person-1001', employee_id: '1001', name: 'Örnek Çalışan', department: 'Üretim', status: 'active', source_updated_at: '2026-11-03T09:00:00+03:00' }] };
export const balanceExample = { balances: [{ external_employee_id: 'person-1001', balance_days: 12.5, as_of_date: '2026-11-03', source_updated_at: '2026-11-03T09:05:00+03:00' }] };
export const endpoints = [
  { title: 'Bağlantıyı test et', method: 'GET', path: '/status', scope: 'Geçerli herhangi bir anahtar', description: 'Anahtarı ve açık API erişimini doğrular. Veri aktarmaz.' },
  { title: 'Çalışanları ekle veya güncelle', method: 'POST', path: '/employees/upsert', scope: 'employees:write', description: 'Tek istekte en fazla 100 çalışan. Sicil numarası portalda benzersizdir.', body: employeeExample, idempotent: true },
  { title: 'İzin bakiyelerini güncelle', method: 'POST', path: '/leave-balances/upsert', scope: 'leave-balances:write', description: 'Tek istekte en fazla 500 bakiye. Çalışanın önce bu bağlantıdan eşleştirilmiş olması gerekir.', body: balanceExample, idempotent: true },
  { title: 'Bekleyen izin taleplerini al', method: 'GET', path: '/leave-requests?limit=25', scope: 'leave-requests:read', description: 'Kayıtları 120 saniye bu anahtara ayırır. Sonuç aynı anahtarla bildirilmelidir. Bu çağrı kuyruk durumunu değiştirir.' },
  { title: 'Başarılı aktarımı bildir', method: 'POST', path: '/leave-requests/{{job_id}}/ack', scope: 'leave-requests:ack', description: 'job_id, talep numarası değil, kuyruktan alınan kaydın id alanıdır.', body: { status: 'succeeded', external_reference: 'remote-1001' } },
  { title: 'Başarısız aktarımı bildir', method: 'POST', path: '/leave-requests/{{job_id}}/ack', scope: 'leave-requests:ack', description: 'Hata mesajına parola veya kişisel veri eklemeyin.', body: { status: 'failed', error_code: 'REMOTE_UNAVAILABLE', error_message: 'Hedef sisteme ulaşılamadı.', retry_after_seconds: 300 } },
];
export function postmanCollection(baseUrl: string) {
  return {
    info: { name: 'İKBenimle Entegrasyon API v1', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
    variable: [{ key: 'base_url', value: baseUrl }, { key: 'api_key', value: '' }, { key: 'job_id', value: '' }],
    auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{api_key}}', type: 'string' }] },
    item: [...endpoints.map(endpoint => ({ name: endpoint.title, request: {
      method: endpoint.method, url: '{{base_url}}' + endpoint.path, description: endpoint.description + ' Yetki: ' + endpoint.scope,
      header: [{ key: 'Content-Type', value: 'application/json' }, ...(endpoint.idempotent ? [{ key: 'Idempotency-Key', value: 'operation-{{$guid}}', description: 'Aynı işlemi tekrar denerken ilk anahtarı yeniden kullanın. Yeni mantıksal işlemde yeni anahtar üretin.' }] : [])],
      ...(endpoint.body ? { body: { mode: 'raw', raw: JSON.stringify(endpoint.body, null, 2), options: { raw: { language: 'json' } } } } : {}),
    } })), { name: 'Bordro PDF yükle', request: {
      method: 'POST', url: '{{base_url}}/payrolls/upsert',
      description: 'Çalışan önce bu bağlantıdan eşleştirilmelidir. Aynı kimlik ve revizyon aynı PDF ile tekrar gönderilebilir. Düzeltme için revizyonu artırın. En fazla 20 MB PDF.',
      body: { mode: 'formdata', formdata: [
        { key: 'external_employee_id', value: 'person-1001', type: 'text' },
        { key: 'external_payroll_id', value: 'payroll-1001-2026-11', type: 'text' },
        { key: 'period', value: '2026-11', type: 'text' },
        { key: 'revision', value: '1', type: 'text' },
        { key: 'file', type: 'file', src: '' },
      ] },
    } }],
  };
}
export function downloadJson(name: string, value: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
