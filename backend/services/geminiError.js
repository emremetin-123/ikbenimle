// Provider text may contain request details; return only controlled messages.
const geminiError = (status, responseText = '') => {
    const text = String(responseText);
    let message;
    if (/API_KEY_INVALID|API_KEY_EXPIRED|API key not valid|API key expired/i.test(text)) {
        message = 'Gemini anahtarı geçersiz veya süresi dolmuş. Sunucu anahtarı kontrol edilmeli.';
    } else if (/leaked|compromised/i.test(text)) {
        message = 'Gemini anahtarı Google tarafından engellenmiş. Sunucu anahtarı yenilenmeli.';
    } else if (status === 401 || status === 403) {
        message = 'Gemini erişimi reddedildi. Anahtarın API izinleri ve proje kısıtlamaları kontrol edilmeli.';
    } else if (status === 429) {
        message = 'Gemini kullanım kotası veya istek sınırı dolmuş. Proje kotası ve faturalandırma kontrol edilmeli.';
    } else if (status === 404) {
        message = 'Seçili Gemini modeli veya API adresi bulunamadı. Model ayarı kontrol edilmeli.';
    } else if (status === 400) {
        message = 'Gemini PDF veya analiz isteğini kabul etmedi. İstek biçimi ve model uyumluluğu kontrol edilmeli.';
    } else {
        message = 'Gemini hizmeti isteği tamamlayamadı. Daha sonra tekrar deneyin.';
    }
    return `${message} (HTTP ${status})`;
};
module.exports = { geminiError };
