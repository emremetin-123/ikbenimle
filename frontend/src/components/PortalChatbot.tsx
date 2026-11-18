import { useEffect, useRef, useState } from 'react';
import { Bot, Send, X } from 'lucide-react';
import { api } from '../services/api';

type ChatMessage = {
  id: number;
  role: 'user' | 'assistant';
  text: string;
};

export const PortalChatbot = () => {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 1, role: 'assistant', text: 'Merhaba, portal hakkında ne öğrenmek istersin?' }
  ]);
  const nextId = useRef(2);

  useEffect(() => {
    let mounted = true;
    api.get<{ enabled: boolean }>('/api/chatbot/settings')
      .then(result => {
        if (mounted) setEnabled(result.enabled !== false);
      })
      .catch(() => {
        if (mounted) setEnabled(false);
      });
    return () => { mounted = false; };
  }, []);

  const addMessage = (role: ChatMessage['role'], text: string) => {
    setMessages(current => [...current, { id: nextId.current++, role, text }]);
  };

  const ask = async () => {
    const question = input.trim();
    if (!question || loading) return;

    setInput('');
    addMessage('user', question);
    setLoading(true);
    try {
      const result = await api.post<{ answer: string }>('/api/chatbot/ask', { message: question });
      addMessage('assistant', result.answer || 'Bu konuda cevap oluşturamadım.');
    } catch (err) {
      addMessage('assistant', err instanceof Error ? err.message : 'Chatbot yanıt veremedi.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      ask();
    }
  };

  if (!enabled) return null;

  return (
    <div className="portal-chatbot">
      {open && (
        <div className="portal-chatbot-panel">
          <div className="portal-chatbot-header">
            <div>
              <strong>Portal Asistanı</strong>
              <span>İKBenimle</span>
            </div>
            <button type="button" className="portal-chatbot-close" onClick={() => setOpen(false)} aria-label="Chatbot kapat">
              <X size={18} />
            </button>
          </div>

          <div className="portal-chatbot-messages">
            {messages.map(message => (
              <div key={message.id} className={`portal-chatbot-message ${message.role}`}>
                {message.text}
              </div>
            ))}
            {loading && (
              <div className="portal-chatbot-message assistant">
                Yanıt hazırlanıyor...
              </div>
            )}
          </div>

          <div className="portal-chatbot-input">
            <textarea
              value={input}
              onChange={event => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              placeholder="Eğitimlerim, izinlerim veya duyurular hakkında sor..."
            />
            <button type="button" onClick={ask} disabled={loading || !input.trim()} aria-label="Mesaj gönder">
              <Send size={17} />
            </button>
          </div>
        </div>
      )}

      <button type="button" className="portal-chatbot-button" onClick={() => setOpen(value => !value)} aria-label="Portal asistanını aç">
        <Bot size={24} />
      </button>
    </div>
  );
};
