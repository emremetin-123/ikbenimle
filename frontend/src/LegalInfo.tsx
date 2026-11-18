import { X } from 'lucide-react';

type LegalType = 'tos' | 'privacy' | 'kvkk';

interface LegalInfoProps {
    type: LegalType;
    onClose: () => void;
}

export const LegalInfo = ({ type, onClose }: LegalInfoProps) => {
    const getContent = () => {
        switch (type) {
            case 'tos':
                return {
                    title: 'Kullanım Şartları',
                    content: (
                        <>
                            <section>
                                <h3>1. Kabul</h3>
                                <p>Bu platformu kullanarak aşağıdaki şartları kabul etmiş sayılırsınız.</p>
                            </section>
                            <section>
                                <h3>2. Fikri Mülkiyet Hakları</h3>
                                <p className="legal-info-highlight">
                                    Bu platformun yazılımı, tasarımı ve içerikleri Emre Metin’e aittir. İzinsiz kopyalanamaz, çoğaltılamaz ve ticari amaçla kullanılamaz.
                                </p>
                            </section>
                            <section>
                                <h3>3. Kullanıcı Sorumluluğu</h3>
                                <p>Kullanıcılar, kendilerine sağlanan giriş bilgilerini korumakla yükümlüdür. Platformun kötüye kullanımı tespit edildiğinde hesap askıya alınabilir.</p>
                            </section>
                            <section>
                                <h3>4. Değişiklikler</h3>
                                <p>Emre Metin, kullanım şartlarını dilediği zaman güncelleme hakkını saklı tutar.</p>
                            </section>
                        </>
                    )
                };
            case 'privacy':
                return {
                    title: 'Gizlilik Politikası',
                    content: (
                        <>
                            <section>
                                <h3>1. Veri Toplama</h3>
                                <p>Eğitim portalı üzerinden adınız, soyadınız, departmanınız ve eğitim ilerleme verileriniz toplanmaktadır.</p>
                            </section>
                            <section>
                                <h3>2. Veri Kullanımı</h3>
                                <p>Toplanan veriler sadece eğitim süreçlerinin takibi, başarının ölçülmesi ve raporlanması amacıyla kullanılır.</p>
                            </section>
                            <section>
                                <h3>3. Üçüncü Taraflar</h3>
                                <p>Verileriniz hiçbir şekilde reklam veya ticari amaçla üçüncü taraf kurumlarla paylaşılmaz.</p>
                            </section>
                            <section>
                                <h3>4. Güvenlik</h3>
                                <p>Verileriniz güvenli sunucularda şifrelenmiş olarak saklanmaktadır.</p>
                            </section>
                        </>
                    )
                };
            case 'kvkk':
                return {
                    title: 'KVKK Aydınlatma Metni',
                    content: (
                        <>
                            <section>
                                <h3 className="legal-info-intro-title">6698 Sayılı KVKK Uyarınca Bilgilendirme</h3>
                                <p>Kişisel verileriniz, 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") uyarınca veri sorumlusu sıfatıyla Emre Metin tarafından aşağıda açıklanan kapsamda işlenebilecektir.</p>
                            </section>
                            <section>
                                <h3>İşleme Amaçları</h3>
                                <p>Kişisel verileriniz; personelin eğitim faaliyetlerinin yürütülmesi, performans takibi ve kurumsal gelişim süreçlerinin yönetilmesi amacıyla işlenmektedir.</p>
                            </section>
                            <section>
                                <h3>Haklarınız</h3>
                                <p>KVKK'nın 11. maddesi uyarınca başvurarak; verilerinizin işlenip işlenmediğini öğrenme, işlenmişse bilgi talep etme, silinmesini veya düzeltilmesini isteme haklarına sahipsiniz.</p>
                            </section>
                        </>
                    )
                };
            default:
                return { title: '', content: null };
        }
    };

    const { title, content } = getContent();

    return (
        <div className="legal-info-overlay">
            <div
                className="premium-card legal-info-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="legal-info-title"
            >
                <button
                    onClick={onClose}
                    className="btn-icon-round legal-info-close"
                    title="Kapat"
                    aria-label="Yasal bilgilendirmeyi kapat"
                >
                    <X size={20} />
                </button>
                
                <div className="legal-info-header">
                    <span className="legal-info-eyebrow">
                        Yasal Bilgilendirme
                    </span>
                    <h1 id="legal-info-title">{title}</h1>
                </div>

                <div className="legal-info-content">
                    {content}
                </div>

                <div className="legal-info-actions">
                    <button className="btn-primary" onClick={onClose}>
                        Anladım, Kapat
                    </button>
                </div>
            </div>
        </div>
    );
};
