interface FooterProps {
    onShowLegal: (type: 'tos' | 'privacy' | 'kvkk') => void;
    className?: string;
}

export const Footer = ({ onShowLegal, className = '' }: FooterProps) => (
    <footer className={`app-footer ${className}`.trim()}>
        <div className="app-footer-content">
            <div>
                <p className="app-footer-owner">
                    © 2026 Emre Metin
                </p>
                <p className="app-footer-copyright">
                    Tüm hakları saklıdır. Platform içerik ve yazılım hakları koruma altındadır.
                </p>
            </div>

            <div className="app-footer-links">
                <button 
                    type="button"
                    onClick={() => onShowLegal('tos')} 
                    className="app-footer-link"
                >
                    Kullanım Şartları
                </button>
                <button 
                    type="button"
                    onClick={() => onShowLegal('privacy')} 
                    className="app-footer-link"
                >
                    Gizlilik Politikası
                </button>
                <button 
                    type="button"
                    onClick={() => onShowLegal('kvkk')} 
                    className="app-footer-link"
                >
                    KVKK Metni
                </button>
            </div>
        </div>
    </footer>
);
