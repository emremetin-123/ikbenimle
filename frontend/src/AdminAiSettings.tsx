import { useEffect, useState } from 'react';
import { Bot, Save, ShieldCheck, ShieldX } from 'lucide-react';
import { api } from './services/api';

type AiSettings = {
    has_gemini_api_key: boolean;
    gemini_model: string;
    chatbot_enabled: boolean;
};

export const AdminAiSettings = () => {
    const [settings, setSettings] = useState<AiSettings | null>(null);
    const [model, setModel] = useState('gemini-3.5-flash');
    const [chatbotEnabled, setChatbotEnabled] = useState(true);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const data = await api.get<AiSettings>('/api/admin/ai-settings');
            setSettings(data);
            setModel(data.gemini_model || 'gemini-3.5-flash');
            setChatbotEnabled(data.chatbot_enabled !== false);
            setMessage('');
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'AI ayarları alınamadı.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    const saveSettings = async (event: React.FormEvent) => {
        event.preventDefault();
        setLoading(true);
        try {
            await api.put('/api/admin/ai-settings', {
                gemini_model: model,
                chatbot_enabled: chatbotEnabled
            });
            setModel(model.trim());
            setMessage('AI ayarları kaydedildi.');
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'AI ayarları kaydedilemedi.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="premium-card ai-settings-card">
            <div className="ai-settings-heading">
                <Bot size={24} color="var(--primary)" />
                <h2>AI Ayarları</h2>
            </div>

            <form onSubmit={saveSettings} className="ai-settings-form">
                <div className="input-group ai-settings-field">
                    <label className="input-label">Gemini bağlantısı</label>
                    <div className={`form-control ai-settings-connection${settings?.has_gemini_api_key ? ' is-configured' : ' is-missing'}`}>
                        {settings?.has_gemini_api_key
                            ? <><ShieldCheck size={18} /> Sunucuda güvenli olarak yapılandırıldı</>
                            : <><ShieldX size={18} /> Sunucu yapılandırması eksik</>}
                    </div>
                    <small className="ai-settings-help">
                        API anahtarı yalnız sunucu secret alanında tutulur ve panelde gösterilmez.
                    </small>
                </div>

                <div className="input-group ai-settings-field">
                    <label className="input-label">Gemini Model</label>
                    <input
                        className="form-control"
                        value={model}
                        onChange={event => setModel(event.target.value)}
                        placeholder="gemini-3.5-flash"
                    />
                </div>

                <label className="ai-settings-toggle">
                    <input
                        type="checkbox"
                        checked={chatbotEnabled}
                        onChange={event => setChatbotEnabled(event.target.checked)}
                    />
                    <div>
                        <div className="ai-settings-toggle-title">Portal sohbet botu aktif olsun</div>
                        <small className="ai-settings-help">
                            Kapalıyken çalışan ekranındaki asistan gizlenir ve API soru kabul etmez.
                        </small>
                    </div>
                </label>

                {message && <div className="ai-settings-message" role="status">{message}</div>}

                <button type="submit" className="btn-primary ai-settings-submit" disabled={loading}>
                    <Save size={17} /> Kaydet
                </button>
            </form>
        </div>
    );
};
