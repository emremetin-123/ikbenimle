import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useNavigate } from './router';
import { Logo } from './components/Logo';
import { ArrowRight, Eye, EyeOff, LockKeyhole, UserRound } from 'lucide-react';

export const Login = () => {
    const [employeeId, setEmployeeId] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const { login, user } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (user) {
            navigate('/employee/anasayfa', { replace: true });
        }
    }, [user, navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (submitting) return;
        setError('');
        setSubmitting(true);
        try {
            await login(employeeId, password);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Giriş başarısız');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="login-page">
            <main className="login-content">
                <section className="premium-card login-card" aria-labelledby="login-title">
                    <div className="login-card-heading">
                        <div className="login-logo">
                             <Logo size="100%" />
                        </div>
                        <h1 id="login-title" translate="no" className="login-product-name">
                            İKBenimle
                        </h1>
                        <p className="login-description">
                            Sicil numaranız ile sisteme güvenli giriş yapın
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} aria-busy={submitting}>
                        <div className="input-group">
                            <label className="input-label" htmlFor="login-employee-id">Sicil Numarası</label>
                            <div className="login-field">
                                <UserRound className="login-field-icon" size={21} aria-hidden="true" />
                                <input
                                    id="login-employee-id"
                                    autoComplete="username"
                                    type="text"
                                    value={employeeId}
                                    onChange={(e) => setEmployeeId(e.target.value)}
                                    required
                                    className="form-control login-input"
                                    placeholder="Örn: 1001"
                                />
                            </div>
                        </div>
                        <div className="input-group">
                            <label className="input-label" htmlFor="login-password">Şifre</label>
                            <div className="login-field">
                                <LockKeyhole className="login-field-icon" size={21} aria-hidden="true" />
                                <input
                                    id="login-password"
                                    type={showPassword ? 'text' : 'password'}
                                    autoComplete="current-password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="form-control login-input"
                                    placeholder="********"
                                />
                                <button
                                    type="button"
                                    className="login-password-toggle"
                                    aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                                    aria-pressed={showPassword}
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? <EyeOff size={21} aria-hidden="true" /> : <Eye size={21} aria-hidden="true" />}
                                </button>
                            </div>
                        </div>
                        {error && (
                            <div className="login-error" role="alert">
                                {error}
                            </div>
                        )}
                        <button type="submit" className="btn-primary login-submit" disabled={submitting}>
                            {submitting ? 'Giriş yapılıyor…' : 'Giriş Yap'}
                            <ArrowRight size={20} aria-hidden="true" />
                        </button>
                    </form>
                </section>
            </main>
        </div>
    );

};

