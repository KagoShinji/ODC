import { motion as Motion } from 'framer-motion';
import LoadingButton from './LoadingButton';
import {
    ArrowRight,
    Circuitry,
    EnvelopeSimple,
    Lifebuoy,
    LockKey,
    ShieldCheck,
    WarningCircle,
} from '@phosphor-icons/react';

const easeOut = [0.22, 1, 0.36, 1];

export function PortalLogin({
    variant = 'client',
    eyebrow,
    title,
    subtitle,
    email,
    password,
    onEmailChange,
    onPasswordChange,
    onSubmit,
    error,
    loading,
    submitLabel = 'Sign in',
    loadingLabel = 'Signing in',
    emailPlaceholder = 'you@company.com',
    passwordPlaceholder = 'Password',
    sideTitle = 'Protected workspace',
    sideCopy = 'Access support, requests, and operational tools from one focused console.',
}) {
    return (
        <div className={`portal-login-page ${variant === 'admin' ? 'is-admin' : 'is-client'}`}>
            <div className="reference-grid-lines" />
            <div className="portal-login-ambient" />

            <Motion.main
                className="portal-login-shell"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.62, ease: easeOut }}
            >
                <section className="portal-login-copy" aria-label="Portal overview">
                    <span className="reference-eyebrow">{eyebrow}</span>
                    <h1>{title}</h1>
                    <p>{subtitle}</p>

                    <div className="portal-login-preview" aria-hidden="true">
                        <div className="window-dots"><span /><span /><span /></div>
                        <div className="portal-login-preview-body">
                            <aside>
                                <span className="active"><ShieldCheck size={13} weight="fill" /> Access</span>
                                <span><Lifebuoy size={13} weight="fill" /> Support</span>
                                <span><Circuitry size={13} weight="fill" /> Systems</span>
                            </aside>
                            <main>
                                <div className="portal-login-preview-toolbar">
                                    <span>{variant === 'admin' ? 'admin console' : 'client portal'}</span>
                                    <strong>secured</strong>
                                </div>
                                <div className="portal-login-preview-title" />
                                <div className="portal-login-preview-grid"><span /><span /><span /></div>
                            </main>
                        </div>
                    </div>
                </section>

                <section className="portal-login-card" aria-label={`${title} form`}>
                    <div className="portal-login-card-header">
                        <div className="portal-login-mark">
                            <ShieldCheck size={25} weight="duotone" />
                        </div>
                        <div>
                            <span>{sideTitle}</span>
                            <p>{sideCopy}</p>
                        </div>
                    </div>

                    <form className="portal-login-form" onSubmit={onSubmit}>
                        <label>
                            <span>{variant === 'admin' ? 'Username or email' : 'Email address'}</span>
                            <div className="portal-input-shell">
                                <EnvelopeSimple size={17} weight="duotone" />
                                <input
                                    type={variant === 'admin' ? 'text' : 'email'}
                                    autoComplete={variant === 'admin' ? 'username' : 'email'}
                                    value={email}
                                    onChange={(event) => onEmailChange(event.target.value)}
                                    required
                                    placeholder={emailPlaceholder}
                                />
                            </div>
                        </label>

                        <label>
                            <span>Password</span>
                            <div className="portal-input-shell">
                                <LockKey size={17} weight="duotone" />
                                <input
                                    type="password"
                                    autoComplete="current-password"
                                    value={password}
                                    onChange={(event) => onPasswordChange(event.target.value)}
                                    required
                                    placeholder={passwordPlaceholder}
                                />
                            </div>
                        </label>

                        {error ? (
                            <div className="portal-login-error" role="alert">
                                <WarningCircle size={16} weight="fill" />
                                <span>{error}</span>
                            </div>
                        ) : null}

                        <LoadingButton type="submit" className="portal-login-submit" loading={loading} loadingLabel={loadingLabel}>
                            {submitLabel}
                            <span>
                                <ArrowRight size={14} weight="bold" />
                            </span>
                        </LoadingButton>
                    </form>
                </section>
            </Motion.main>
        </div>
    );
}
