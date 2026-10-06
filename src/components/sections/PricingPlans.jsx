import { useEffect, useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { addDoc, collection, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import {
    ArrowRight,
    ChatCenteredText,
    CheckCircle,
    Clock,
    CurrencyCircleDollar,
    Database,
    Lightning,
    SealCheck,
    ShieldCheck,
    SlidersHorizontal,
    WarningCircle,
    X,
} from '@phosphor-icons/react';
import { db } from '../../lib/firebase';
import LoadingButton from '../ui/LoadingButton';

const easeOut = [0.22, 1, 0.36, 1];

const fadeUp = {
    hidden: { opacity: 0, y: 34, filter: 'blur(10px)' },
    show: { opacity: 1, y: 0, filter: 'blur(0px)' },
};

const sectionMotion = {
    initial: 'hidden',
    whileInView: 'show',
    viewport: { once: true, margin: '-90px' },
    transition: { duration: 0.78, ease: easeOut },
    variants: fadeUp,
};

const DEFAULT_PLANS = [
    {
        name: 'Basic Care Plan',
        price: 'PHP 1,500',
        period: '/month',
        color: '#bcecf2',
        desc: 'For portfolio sites, landing pages, and smaller business websites that need steady upkeep.',
        includes: [
            'Website uptime monitoring',
            'Minor text and image updates',
            'Basic bug fixes',
            'Monthly database backup',
            'Basic technical support',
            'Security monitoring',
        ],
        limitations: [
            'Max 2 minor update requests per month',
            'Request completion within 3-7 business days',
            'New modules quoted separately',
            'Major layout changes quoted separately',
            'Hosting and domain fees excluded unless agreed',
        ],
    },
    {
        name: 'Standard Care Plan',
        price: 'PHP 3,500',
        period: '/month',
        color: '#edc27f',
        recommended: true,
        desc: 'A practical fit for booking systems, clinics, and operations tools with regular small changes.',
        includes: [
            'Everything in Basic Plan',
            'Minor UI and UX improvements',
            'Small workflow adjustments',
            'Database optimization',
            'Priority technical support',
            'Minor feature enhancements',
            'Monthly system health checks',
        ],
        limitations: [
            'Maximum of 5 minor requests per month',
            'Maximum of 1 small feature enhancement monthly',
            'Completion within 2-5 business days',
            'Major features quoted separately',
            'Third-party API costs excluded',
        ],
    },
    {
        name: 'Premium Continuous Improvement',
        price: 'PHP 7,500',
        period: '/month+',
        color: '#9ad8ba',
        desc: 'For growing teams that need faster iteration, deeper support, and ongoing product improvement.',
        includes: [
            'Everything in Standard Plan',
            'Priority development queue',
            'Continuous system improvements',
            'Advanced reporting enhancements',
            'Performance optimization',
            'Scaling recommendations',
            'Advanced troubleshooting',
            'Dedicated support assistance',
        ],
        limitations: [
            'Maximum of 10 minor requests monthly',
            'Maximum of 2 moderate enhancements monthly',
            'Large modules billed separately',
            'External software subscriptions excluded',
            'Major architecture changes quoted separately',
        ],
    },
];

const DEFAULT_ADDONS = [
    { service: 'Additional minor request', price: 'PHP 500/request' },
    { service: 'Emergency same-day support', price: 'PHP 1,500+' },
    { service: 'Additional monthly backup', price: 'PHP 500/month' },
    { service: 'Server or hosting management', price: 'PHP 1,000+/month' },
    { service: 'Feature development', price: 'Subject for quotation' },
];

const DEFAULT_MINOR_REQS = [
    { title: 'Text and content', desc: 'Changing labels, descriptions, or general text content across the system.', icon: ChatCenteredText },
    { title: 'UI adjustments', desc: 'Small visual tweaks, form refinements, and layout cleanup.', icon: SlidersHorizontal },
    { title: 'Field additions', desc: 'Adding simple fields to existing forms or data displays.', icon: Database },
    { title: 'Reports and data', desc: 'Small report modifications and dashboard improvements.', icon: CurrencyCircleDollar },
    { title: 'Pricing and values', desc: 'Updating product pricing, system variables, or config values.', icon: SealCheck },
    { title: 'Speed adjustments', desc: 'Simple automation tweaks and performance micro-optimizations.', icon: Lightning },
];

const DEFAULT_NOT_INCLUDED = [
    'Entire new modules',
    'Mobile applications',
    'AI integrations',
    'Payroll systems',
    'Accounting systems',
    'Multi-company architecture',
    'Large database restructuring',
    'Third-party API integrations',
    'Advanced analytics',
    'Major redesigns',
    'Migration to another platform',
];

function PricingSkeleton() {
    return (
        <section id="pricing" className="landing-section pricing-section premium-pricing-section">
            <div className="reference-grid-lines" />
            <div className="landing-shell pricing-loading-grid">
                {[0, 1, 2].map((item) => (
                    <div key={item} className="pricing-skeleton-card">
                        <span />
                        <strong />
                        <p />
                        <p />
                    </div>
                ))}
            </div>
        </section>
    );
}

function PricingCard({ plan, index, onSelect }) {
    return (
        <Motion.article
            {...sectionMotion}
            transition={{ duration: 0.78, delay: index * 0.08, ease: easeOut }}
            className={`pricing-plan-card ${plan.recommended ? 'is-recommended' : ''}`}
            style={{ '--plan-accent': plan.color }}
        >
            {plan.recommended ? <span className="pricing-recommendation">Most requested</span> : null}

            <div className="pricing-plan-head">
                <span className="pricing-plan-kicker">Care plan</span>
                <h3>{plan.name}</h3>
                <p>{plan.desc}</p>
            </div>

            <div className="pricing-price-row">
                <strong>{plan.price}</strong>
                <span>{plan.period}</span>
            </div>

            <div className="pricing-feature-block">
                <span className="pricing-list-label">Included</span>
                <ul>
                    {plan.includes.map((item) => (
                        <li key={item}>
                            <CheckCircle size={17} weight="fill" />
                            <span>{item}</span>
                        </li>
                    ))}
                </ul>
            </div>

            <div className="pricing-feature-block is-muted">
                <span className="pricing-list-label">Scope notes</span>
                <ul>
                    {plan.limitations.map((item) => (
                        <li key={item}>
                            <span className="pricing-minus">-</span>
                            <span>{item}</span>
                        </li>
                    ))}
                </ul>
            </div>

            <button type="button" className="pricing-cta" onClick={() => onSelect(plan)}>
                Request this plan
                <span>
                    <ArrowRight size={14} weight="bold" />
                </span>
            </button>
        </Motion.article>
    );
}

function PricingInquiryModal({ selectedPlan, onClose }) {
    const [form, setForm] = useState({ name: '', email: '', company: '', message: '' });
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [submitError, setSubmitError] = useState('');

    const updateField = (field, value) => {
        setSubmitError('');
        setForm((current) => ({ ...current, [field]: value }));
    };

    const handlePlanSubmit = async (event) => {
        event.preventDefault();
        setSubmitting(true);
        setSubmitError('');

        try {
            await addDoc(collection(db, 'serviceInquiries'), {
                ...form,
                planName: selectedPlan.name,
                planPrice: selectedPlan.price,
                type: 'Maintenance Plan Inquiry',
                status: 'New',
                submittedAt: serverTimestamp(),
                userAgent: navigator.userAgent,
                referrer: document.referrer || 'Direct',
            });
            setSubmitted(true);
        } catch (error) {
            console.error(error);
            setSubmitError('We could not submit the request. Please try again or contact ODC directly.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Motion.div
            className="pricing-modal-layer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            <button type="button" className="pricing-modal-scrim" onClick={onClose} aria-label="Close pricing inquiry" />
            <Motion.div
                className="pricing-modal-card"
                initial={{ opacity: 0, y: 24, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.98 }}
                transition={{ duration: 0.34, ease: easeOut }}
            >
                <button type="button" className="pricing-modal-close" onClick={onClose} aria-label="Close pricing inquiry">
                    <X size={18} weight="bold" />
                </button>

                {submitted ? (
                    <div className="pricing-success-state">
                        <CheckCircle size={52} weight="fill" />
                        <h3>Request received</h3>
                        <p>We received your inquiry for {selectedPlan.name}. ODC will review the scope and get back to you with next steps.</p>
                        <button type="button" className="pricing-cta" onClick={onClose}>
                            Close
                            <span>
                                <ArrowRight size={14} weight="bold" />
                            </span>
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="pricing-modal-header">
                            <span className="reference-eyebrow">{selectedPlan.name}</span>
                            <h3>Tell us what needs care.</h3>
                            <p>Share the system and support needs so we can confirm the right maintenance scope.</p>
                        </div>

                        <form className="pricing-form" onSubmit={handlePlanSubmit}>
                            <label>
                                <span>Full name</span>
                                <input value={form.name} onChange={(event) => updateField('name', event.target.value)} required placeholder="Your name" />
                            </label>
                            <label>
                                <span>Email address</span>
                                <input type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} required placeholder="you@company.com" />
                            </label>
                            <label>
                                <span>Company or project</span>
                                <input value={form.company} onChange={(event) => updateField('company', event.target.value)} required placeholder="Project name" />
                            </label>
                            <label>
                                <span>Message</span>
                                <textarea value={form.message} onChange={(event) => updateField('message', event.target.value)} placeholder="Current system, support needs, or timeline" />
                            </label>

                            {submitError ? (
                                <p className="pricing-form-error">
                                    <WarningCircle size={16} weight="fill" />
                                    {submitError}
                                </p>
                            ) : null}

                            <LoadingButton type="submit" className="pricing-cta pricing-submit" loading={submitting} loadingLabel="Submitting request…">
                                Submit request
                                <span>
                                    <ArrowRight size={14} weight="bold" />
                                </span>
                            </LoadingButton>
                        </form>
                    </>
                )}
            </Motion.div>
        </Motion.div>
    );
}

export function PricingPlans({ standalone = false }) {
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedPlan, setSelectedPlan] = useState(null);

    useEffect(() => {
        let alive = true;

        const load = async () => {
            try {
                const snap = await getDoc(doc(db, 'maintenanceSettings', 'config'));
                if (alive && snap.exists()) {
                    setConfig(snap.data());
                }
            } catch (error) {
                console.error(error);
            } finally {
                if (alive) setLoading(false);
            }
        };

        load();
        return () => {
            alive = false;
        };
    }, []);

    if (loading) return <PricingSkeleton />;

    const plans = config?.plans || DEFAULT_PLANS;
    const addons = config?.addons || DEFAULT_ADDONS;
    const minorRequests = config?.minorRequests || DEFAULT_MINOR_REQS;
    const notIncluded = config?.notIncluded || DEFAULT_NOT_INCLUDED;
    const supportHours = config?.supportHours || 'Available 24/7. Dedicated support team always ready.';
    const paymentTerms = config?.paymentTerms || 'Monthly payments are due as agreed. Service months are non-refundable once they begin.';

    return (
        <>
            <section id="pricing" className={`landing-section pricing-section premium-pricing-section ${standalone ? 'is-standalone' : ''}`}>
                <div className="reference-grid-lines" />
                <div className="ambient pricing-ambient" />
                <div className="landing-shell">
                    <div className="premium-section-intro pricing-section-intro">
                        <Motion.div {...sectionMotion} className="section-header">
                            <span className="reference-eyebrow">Care plans</span>
                            <h2>Maintenance pricing built for systems already doing real work.</h2>
                            <p>
                                Choose the support rhythm that matches your current workload. Every plan keeps the scope visible, the request queue controlled, and the system moving without surprise rebuilds.
                            </p>
                        </Motion.div>

                        <Motion.aside {...sectionMotion} className="pricing-support-note">
                            <ShieldCheck size={24} weight="duotone" />
                            <div>
                                <span>Support window</span>
                                <p>{supportHours}</p>
                            </div>
                        </Motion.aside>
                    </div>

                    <div className="pricing-plan-grid">
                        {plans.map((plan, index) => (
                            <PricingCard key={plan.name} plan={plan} index={index} onSelect={setSelectedPlan} />
                        ))}
                    </div>

                    <div className="pricing-detail-grid">
                        <Motion.div {...sectionMotion} className="pricing-minor-shell">
                            <div className="pricing-detail-header">
                                <span className="reference-eyebrow">Minor requests</span>
                                <h3>Small changes that keep a live system useful.</h3>
                            </div>
                            <div className="pricing-minor-grid">
                                {minorRequests.map((item) => {
                                    const Icon = item.icon || SlidersHorizontal;
                                    return (
                                        <article key={item.title}>
                                            <Icon size={20} weight="duotone" />
                                            <h4>{item.title}</h4>
                                            <p>{item.desc}</p>
                                        </article>
                                    );
                                })}
                            </div>
                        </Motion.div>

                        <Motion.aside {...sectionMotion} className="pricing-terms-shell">
                            <div className="pricing-term-card">
                                <Clock size={22} weight="duotone" />
                                <div>
                                    <span>Payment terms</span>
                                    <p>{paymentTerms}</p>
                                </div>
                            </div>
                            <div className="pricing-term-card is-warning">
                                <WarningCircle size={22} weight="duotone" />
                                <div>
                                    <span>Quoted separately</span>
                                    <ul>
                                        {notIncluded.slice(0, 7).map((item) => (
                                            <li key={item}>{item}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                            <div className="pricing-addon-list">
                                <span className="pricing-list-label">Optional add-ons</span>
                                {addons.map((addon) => (
                                    <div key={addon.service}>
                                        <span>{addon.service}</span>
                                        <strong>{addon.price}</strong>
                                    </div>
                                ))}
                            </div>
                        </Motion.aside>
                    </div>

                    <p className="pricing-footnote">
                        Maintenance plans cover systems developed by OdysseyPH IT Solutions unless otherwise agreed. Unused monthly requests do not roll over.
                    </p>
                </div>
            </section>

            <AnimatePresence>
                {selectedPlan ? (
                    <PricingInquiryModal selectedPlan={selectedPlan} onClose={() => setSelectedPlan(null)} />
                ) : null}
            </AnimatePresence>
        </>
    );
}
