import { useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { Envelope, Phone, MapPin, PaperPlaneRight, CheckCircle, Warning, Spinner, FacebookLogo } from '@phosphor-icons/react';
import { db } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const easeOut = [0.22, 1, 0.36, 1];

const fadeUp = {
    hidden: { opacity: 0, y: 36, filter: 'blur(10px)' },
    show: { opacity: 1, y: 0, filter: 'blur(0px)' },
};

// eslint-disable-next-line no-unused-vars
const sectionMotion = {
    initial: 'hidden',
    whileInView: 'show',
    viewport: { once: true, margin: '-90px' },
    transition: { duration: 0.85, ease: easeOut },
    variants: fadeUp,
};

const inputClass = 'w-full px-4 py-3.5 bg-white/5 border border-white/10 focus:border-white/30 focus:outline-none rounded-xl transition-all duration-300 text-white placeholder:text-white/40 backdrop-blur-sm focus:bg-white/8 focus:shadow-[0_0_24px_rgba(255,255,255,0.08)]';

const labelClass = 'block text-xs font-semibold uppercase tracking-widest text-white/70 mb-2.5';

const initialForm = { name: '', email: '', company: '', goal: '' };

export function ContactSection() {
    const [form, setForm] = useState(initialForm);
    const [status, setStatus] = useState('idle'); // idle | loading | success | error
    const [errorMsg, setErrorMsg] = useState('');

    const handleChange = (e) => {
        setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.name.trim() || !form.email.trim() || !form.goal.trim()) {
            setErrorMsg('Please fill in Name, Email, and your Goal.');
            setStatus('error');
            return;
        }

        setStatus('loading');
        setErrorMsg('');

        try {
            await addDoc(collection(db, 'contactSubmissions'), {
                name: form.name.trim(),
                email: form.email.trim(),
                company: form.company.trim() || null,
                goal: form.goal.trim(),
                submittedAt: serverTimestamp(),
                // basic metadata
                userAgent: navigator.userAgent,
                referrer: document.referrer || null,
            });

            setStatus('success');
            setForm(initialForm);
        } catch (err) {
            console.error('Firestore error:', err);
            setErrorMsg('Something went wrong. Please try again or email us directly.');
            setStatus('error');
        }
    };

    return (
        <section id="contact" className="landing-section premium-contact-section">
            <div className="landing-shell">
                <div className="grid md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-10 lg:gap-14 items-start">
                    {/* Left Column - Contact Info */}
                    <Motion.div
                        initial="hidden"
                        whileInView="show"
                        viewport={{ once: true, margin: '-90px' }}
                        transition={{ duration: 0.85, delay: 0.1, ease: easeOut }}
                        variants={fadeUp}
                        className="min-w-0"
                    >
                        <div className="space-y-8">
                            {/* Section Header */}
                            <div className="max-w-2xl">
                                <span className="inline-flex items-center gap-2 text-white/50 text-xs font-semibold uppercase tracking-widest mb-4">
                                    <span className="w-8 h-px bg-linear-to-r from-white/20 to-transparent" />
                                    Get In Touch
                                </span>
                                <h2 className="text-4xl md:text-5xl lg:text-6xl leading-none tracking-tighter font-display font-black text-white mb-6">
                                    Let's build your next system.
                                </h2>
                                <p className="text-base leading-relaxed text-white/60 max-w-lg">
                                    Share your workflow challenge, timeline, and vision. We'll respond within 24 hours with a clear path forward.
                                </p>
                            </div>

                            {/* Direct Contact */}
                            <div>
                                <h3 className="text-xs font-semibold uppercase tracking-widest text-white/50 mb-6">Direct Contact</h3>
                                <div className="space-y-4">
                                    {[
                                        { Icon: Envelope, label: 'Email', value: 'odysseyphitsolutions@gmail.com', href: 'mailto:odysseyphitsolutions@gmail.com' },
                                        { Icon: Phone, label: 'Phone', value: '0993-005-0994', href: 'tel:0993-005-0994' },
                                        { Icon: MapPin, label: 'Address', value: '3409 Pearl Corner Jade St. Casals Village, Mabolo, Cebu City', href: '#' },
                                    // eslint-disable-next-line no-unused-vars
              ].map(({ Icon, label, value, href }) => (
                                        <a
                                            key={label}
                                            href={href}
                                            className="flex items-start gap-3 group"
                                        >
                                            <div className="shrink-0 w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-white/10 group-hover:border-white/20 transition-all duration-300">
                                                <Icon size={18} weight="duotone" className="text-white/70 group-hover:text-white transition-colors" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-xs font-semibold uppercase tracking-widest text-white/50 mb-1">{label}</p>
                                                <p className="text-sm text-white/80 group-hover:text-white transition-colors wrap-break-word">{value}</p>
                                            </div>
                                        </a>
                                    ))}
                                </div>
                            </div>

                            {/* Social */}
                            <div className="pt-8 border-t border-white/10">
                                <h3 className="text-xs font-semibold uppercase tracking-widest text-white/50 mb-4">Visit Us</h3>
                                <a
                                    href="https://www.facebook.com/profile.php?id=61587269647950"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-start gap-3 group"
                                >
                                    <div className="shrink-0 w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-white/10 group-hover:border-white/20 transition-all duration-300">
                                        <FacebookLogo size={18} weight="duotone" className="text-white/70 group-hover:text-white transition-colors" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold uppercase tracking-widest text-white/50 mb-1">Facebook</p>
                                        <p className="text-sm text-white/80 group-hover:text-white transition-colors wrap-break-word">
                                            Visit ODC on Facebook
                                        </p>
                                    </div>
                                </a>
                            </div>

                            {/* Tips */}
                            <div className="pt-8 border-t border-white/10">
                                <h3 className="text-xs font-semibold uppercase tracking-widest text-white/50 mb-4">For Faster Feedback</h3>
                                <ul className="space-y-2.5">
                                    {[
                                        'Share your core business goal',
                                        'Describe your current bottleneck',
                                        'Mention your target timeline',
                                    ].map((tip) => (
                                        <li key={tip} className="flex items-start gap-3 text-sm text-white/60">
                                            <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-white/30 mt-2" />
                                            <span>{tip}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </Motion.div>

                    {/* Right Column - Form */}
                    <Motion.div
                        initial="hidden"
                        whileInView="show"
                        viewport={{ once: true, margin: '-90px' }}
                        transition={{ duration: 0.85, delay: 0.2, ease: easeOut }}
                        variants={fadeUp}
                        className="min-w-0 md:pt-14 lg:pt-16"
                    >
                        <div className="p-8 md:p-10 rounded-2xl border border-white/10 bg-white/3 backdrop-blur-xl">
                            {status === 'success' ? (
                                <div className="flex flex-col items-center justify-center py-16 text-center">
                                    <Motion.div
                                        initial={{ scale: 0.8, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        transition={{ duration: 0.5, ease: easeOut }}
                                        className="mb-6 w-16 h-16 rounded-full bg-white/10 border border-white/20 flex items-center justify-center"
                                    >
                                        <CheckCircle size={32} weight="duotone" className="text-white" />
                                    </Motion.div>
                                    <h3 className="text-xl font-black text-white mb-2">Message received</h3>
                                    <p className="text-white/60 text-sm max-w-xs mb-6">
                                        Thanks for reaching out. Our team will review and respond within 24 hours.
                                    </p>
                                    <button
                                        onClick={() => setStatus('idle')}
                                        className="text-sm font-semibold text-white/70 hover:text-white transition-colors"
                                    >
                                        Send another message
                                    </button>
                                </div>
                            ) : (
                                <form className="space-y-6" noValidate onSubmit={handleSubmit}>
                                    <div>
                                        <label htmlFor="contact-name" className={labelClass}>Full Name</label>
                                        <input
                                            id="contact-name"
                                            name="name"
                                            type="text"
                                            autoComplete="name"
                                            className={inputClass}
                                            placeholder="John Doe"
                                            value={form.name}
                                            onChange={handleChange}
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor="contact-email" className={labelClass}>Email Address</label>
                                        <input
                                            id="contact-email"
                                            name="email"
                                            type="email"
                                            autoComplete="email"
                                            className={inputClass}
                                            placeholder="john@example.com"
                                            value={form.email}
                                            onChange={handleChange}
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor="contact-company" className={labelClass}>
                                            Company <span className="normal-case font-normal text-white/40">(Optional)</span>
                                        </label>
                                        <input
                                            id="contact-company"
                                            name="company"
                                            type="text"
                                            autoComplete="organization"
                                            className={inputClass}
                                            placeholder="Acme Inc."
                                            value={form.company}
                                            onChange={handleChange}
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor="contact-goal" className={labelClass}>What's your goal?</label>
                                        <textarea
                                            id="contact-goal"
                                            name="goal"
                                            rows={4}
                                            className={`${inputClass} resize-none`}
                                            placeholder="Example: Build a booking system to reduce no-shows by 40%"
                                            value={form.goal}
                                            onChange={handleChange}
                                            required
                                        />
                                    </div>

                                    {status === 'error' && (
                                        <Motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="flex items-start gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20"
                                        >
                                            <Warning size={18} weight="fill" className="text-red-400 shrink-0 mt-0.5" />
                                            <p className="text-sm text-red-300">{errorMsg}</p>
                                        </Motion.div>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={status === 'loading'}
                                        className="w-full px-6 py-3.5 rounded-xl bg-white text-[#101718] font-black text-sm uppercase tracking-tight transition-all duration-300 hover:-translate-y-1 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
                                    >
                                        {status === 'loading' ? (
                                            <>
                                                <Motion.span
                                                    animate={{ rotate: 360 }}
                                                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                                >
                                                    <Spinner size={16} weight="bold" />
                                                </Motion.span>
                                                Sending…
                                            </>
                                        ) : (
                                            <>
                                                Send Message
                                                <PaperPlaneRight size={16} weight="bold" />
                                            </>
                                        )}
                                    </button>

                                    <p className="text-xs text-white/40 text-center">
                                        We'll respond within 24 hours. No spam, ever.
                                    </p>
                                </form>
                            )}
                        </div>
                    </Motion.div>
                </div>
            </div>

            {/* Background Ambience */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-white/3 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4 pointer-events-none" />
        </section>
    );
}
