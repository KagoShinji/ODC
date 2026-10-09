import { useState, useMemo } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import {
    FirstAid,
    Trophy,
    Buildings,
    ShoppingCart,
    Globe,
    Cpu,
    CalendarCheck,
    Users,
    CreditCard,
    ChartBar,
    DeviceMobile,
    PaperPlaneRight,
    ShieldCheck,
    ArrowRight,
    ArrowLeft,
    CheckCircle,
    Sparkle,
    Clock,
    Sliders,
    ChatTeardropText,
} from '@phosphor-icons/react';
import { db } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import LoadingButton from '../ui/LoadingButton';

const easeOut = [0.22, 1, 0.36, 1];

const categories = [
    {
        id: 'clinic',
        title: 'Healthcare & Clinic Systems',
        subtitle: 'EMR records, patient scheduling, doctor workflows, and billing.',
        Icon: FirstAid,
    },
    {
        id: 'sports',
        title: 'Sports & Court Booking Platforms',
        subtitle: 'Pickleball venues, sports centers, and real-time player reservations.',
        Icon: Trophy,
    },
    {
        id: 'enterprise',
        title: 'Enterprise Portals & Operations',
        subtitle: 'Internal workflows, inventory, asset tracking, and staff management.',
        Icon: Buildings,
    },
    {
        id: 'commerce',
        title: 'Digital Commerce & Retail',
        subtitle: 'Product discovery, online checkout, inventory sync, and orders.',
        Icon: ShoppingCart,
    },
    {
        id: 'webapp',
        title: 'Modern Web Apps & Platforms',
        subtitle: 'High-converting client portals, web platforms, and SaaS MVPs.',
        Icon: Globe,
    },
    {
        id: 'ai',
        title: 'Custom AI & Workflow Automation',
        subtitle: 'Intelligent API pipelines, document processing, and automated tasks.',
        Icon: Cpu,
    },
];

const capabilities = [
    { id: 'booking', label: 'Live Scheduling & Booking', Icon: CalendarCheck },
    { id: 'portals', label: 'Patient & Member Portals', Icon: Users },
    { id: 'payments', label: 'Online Payments (GCash, Maya, Stripe)', Icon: CreditCard },
    { id: 'analytics', label: 'Admin Analytics & Dashboards', Icon: ChartBar },
    { id: 'mobile', label: 'Mobile-First / App Readiness', Icon: DeviceMobile },
    { id: 'notifications', label: 'SMS, WhatsApp & Email Alerts', Icon: PaperPlaneRight },
    { id: 'permissions', label: 'Role-Based Staff Permissions', Icon: ShieldCheck },
];

const timelines = [
    {
        id: 'urgent',
        title: 'Rapid Sprint',
        timeframe: '2 to 4 Weeks',
        description: 'Urgent MVP or venue launch with rapid delivery.',
    },
    {
        id: 'standard',
        title: 'Standard Build',
        timeframe: '1 to 2 Months',
        description: 'Comprehensive custom software suite with milestone rollouts.',
    },
    {
        id: 'planning',
        title: 'Planning Stage',
        timeframe: 'Flexible Roadmap',
        description: 'Architecture design, technical scoping, and estimates.',
    },
];

const blueprints = {
    clinic: {
        title: 'Clinical Operations & Patient Workflow Suite',
        architecture: 'Secure cloud EMR architecture, multi-practitioner schedule synchronization, and privacy-conscious records.',
        reference: 'Odyssey Family Clinic & CPRMed',
    },
    sports: {
        title: 'Multi-Venue Court Reservation Network',
        architecture: 'High-concurrency booking engine with real-time slot locking, automated payment webhooks, and venue manager dashboards.',
        reference: 'ODC-Courts, The Pickle Point Cebu & Jump Serve',
    },
    enterprise: {
        title: 'Operational Enterprise Dashboard & Process Engine',
        architecture: 'Centralized RBAC management portal with asset tracking, preventive maintenance pipelines, and automated staff workflows.',
        reference: 'SPEC PMS Platform & Government Portals',
    },
    commerce: {
        title: 'High-Conversion Commerce & Order Processing System',
        architecture: 'Fast responsive storefront with automated inventory synchronization, multi-provider checkout, and fulfillment analytics.',
        reference: 'KBDF Luxury & MediQuick',
    },
    webapp: {
        title: 'Scalable Full-Stack Application Architecture',
        architecture: 'Reactive mobile-first web application, secure REST/GraphQL API layer, and automated cloud scaling.',
        reference: 'SupportTeach & IMS-US',
    },
    ai: {
        title: 'Intelligent Workflow Automation & AI Pipeline',
        architecture: 'Serverless orchestration connecting modern AI reasoning models, document extraction, and third-party API integrations.',
        reference: 'Custom Microservice & Automation Architecture',
    },
};

const inputClass = 'w-full px-4 py-3 bg-white/5 border border-white/10 focus:border-white/30 focus:outline-none rounded-xl transition-all duration-300 text-white placeholder:text-white/35 text-sm focus:bg-white/8';
const labelClass = 'block text-[11px] font-semibold uppercase tracking-wider text-white/60 mb-1.5';

export function ContactWizard({ onSwitchToSimple }) {
    const [step, setStep] = useState(1);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [selectedFeatures, setSelectedFeatures] = useState([]);
    const [selectedTimeline, setSelectedTimeline] = useState(null);
    const [lead, setLead] = useState({ name: '', email: '', phone: '', company: '', notes: '' });
    const [status, setStatus] = useState('idle'); // idle | loading | success | error
    const [errorMsg, setErrorMsg] = useState('');

    const toggleFeature = (id) => {
        setSelectedFeatures((prev) =>
            prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
        );
    };

    const handleCategorySelect = (cat) => {
        setSelectedCategory(cat);
        setTimeout(() => setStep(2), 200);
    };

    const handleTimelineSelect = (timeline) => {
        setSelectedTimeline(timeline);
        setStep(4);
    };

    const activeBlueprint = useMemo(() => {
        if (!selectedCategory) return blueprints.webapp;
        return blueprints[selectedCategory.id] || blueprints.webapp;
    }, [selectedCategory]);

    const activeTimeline = useMemo(() => {
        if (!selectedTimeline) return timelines[1];
        return selectedTimeline;
    }, [selectedTimeline]);

    const handleLeadChange = (e) => {
        setLead((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!lead.name.trim() || !lead.email.trim()) {
            setErrorMsg('Please provide your name and email address.');
            setStatus('error');
            return;
        }

        setStatus('loading');
        setErrorMsg('');

        const featureLabels = selectedFeatures
            .map((fid) => capabilities.find((c) => c.id === fid)?.label)
            .filter(Boolean);

        const goalSummary = `[${activeBlueprint.title}] Category: ${selectedCategory?.title || 'Custom'} | Features: ${
            featureLabels.length > 0 ? featureLabels.join(', ') : 'Standard Suite'
        } | Timeline: ${activeTimeline.timeframe}${
            lead.notes ? ` | Notes: ${lead.notes.trim()}` : ''
        }`;

        try {
            await addDoc(collection(db, 'contactSubmissions'), {
                name: lead.name.trim(),
                email: lead.email.trim(),
                phone: lead.phone.trim() || null,
                company: lead.company.trim() || null,
                goal: goalSummary,
                wizardData: {
                    category: selectedCategory?.id || null,
                    categoryTitle: selectedCategory?.title || null,
                    selectedFeatures: featureLabels,
                    timeline: activeTimeline.timeframe,
                    blueprintTitle: activeBlueprint.title,
                    architectureSummary: activeBlueprint.architecture,
                    matchedCaseStudy: activeBlueprint.reference,
                    notes: lead.notes.trim() || null,
                },
                source: 'interactive_wizard',
                submittedAt: serverTimestamp(),
                userAgent: navigator.userAgent,
                referrer: document.referrer || null,
            });

            setStatus('success');
        } catch (err) {
            console.error('Firestore submission error:', err);
            setErrorMsg('Unable to submit your blueprint. Please try again or email us directly.');
            setStatus('error');
        }
    };

    const resetWizard = () => {
        setStep(1);
        setSelectedCategory(null);
        setSelectedFeatures([]);
        setSelectedTimeline(null);
        setLead({ name: '', email: '', phone: '', company: '', notes: '' });
        setStatus('idle');
        setErrorMsg('');
    };

    if (status === 'success') {
        return (
            <div className="p-8 md:p-10 rounded-2xl border border-white/10 bg-white/3 backdrop-blur-xl text-center">
                <Motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.5, ease: easeOut }}
                    className="mb-6 w-16 h-16 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center mx-auto text-primary"
                >
                    <CheckCircle size={36} weight="duotone" />
                </Motion.div>
                <h3 className="text-2xl font-black text-white mb-2 tracking-tight">
                    Blueprint Inquiry Received
                </h3>
                <p className="text-white/60 text-sm max-w-sm mx-auto mb-6 leading-relaxed">
                    Thank you, <span className="text-white font-semibold">{lead.name}</span>. We have logged your {activeBlueprint.title} specifications. Our engineering lead will review your roadmap and reply within 24 hours.
                </p>

                <div className="p-4 rounded-xl bg-white/4 border border-white/8 text-left mb-6 max-w-md mx-auto">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-primary mb-1">
                        Locked In Blueprint
                    </div>
                    <div className="text-sm font-bold text-white mb-1">
                        {activeBlueprint.title}
                    </div>
                    <div className="text-xs text-white/50">
                        Target Velocity: {activeTimeline.timeframe} &bull; Matched to {activeBlueprint.reference}
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3">
                    <a
                        href="https://www.facebook.com/profile.php?id=61587269647950"
                        target="_blank"
                        rel="noreferrer"
                        className="px-5 py-2.5 rounded-full bg-white/8 hover:bg-white/15 border border-white/12 text-xs font-semibold text-white transition-colors"
                    >
                        Chat on Facebook
                    </a>
                    <button
                        type="button"
                        onClick={resetWizard}
                        className="px-5 py-2.5 rounded-full bg-transparent hover:bg-white/5 text-xs font-semibold text-white/70 hover:text-white transition-colors"
                    >
                        Configure Another Project
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 md:p-9 rounded-2xl border border-white/10 bg-white/3 backdrop-blur-xl relative">
            {/* Header & Progress Indicator */}
            <div className="flex items-center justify-between gap-4 pb-5 mb-6 border-b border-white/8">
                <div className="flex items-center gap-2">
                    {step > 1 && (
                        <button
                            type="button"
                            onClick={() => setStep((s) => Math.max(1, s - 1))}
                            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/70 hover:text-white transition-colors cursor-pointer mr-1"
                            aria-label="Previous step"
                        >
                            <ArrowLeft size={16} weight="bold" />
                        </button>
                    )}
                    <div>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-primary">
                            Interactive System Scoper
                        </div>
                        <div className="text-xs text-white/50">
                            {step === 1 && 'Step 1 of 3: Select System Category'}
                            {step === 2 && 'Step 2 of 3: Required Capabilities'}
                            {step === 3 && 'Step 3 of 3: Target Timeline'}
                            {step === 4 && 'Blueprint Generated: Review & Submit'}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4].map((i) => (
                        <div
                            key={i}
                            className={`h-1.5 rounded-full transition-all duration-300 ${
                                i === step
                                    ? 'w-6 bg-primary'
                                    : i < step
                                    ? 'w-3 bg-white/40'
                                    : 'w-2 bg-white/10'
                            }`}
                        />
                    ))}
                </div>
            </div>

            <AnimatePresence mode="wait">
                {/* STEP 1: Category */}
                {step === 1 && (
                    <Motion.div
                        key="step1"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3, ease: easeOut }}
                        className="space-y-4"
                    >
                        <div>
                            <h3 className="text-xl md:text-2xl font-display font-bold text-white tracking-tight mb-1">
                                What type of system are you building?
                            </h3>
                            <p className="text-sm text-white/60">
                                Tap the core category that best fits your product or operational vision.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                            {categories.map((cat) => {
                                const isSelected = selectedCategory?.id === cat.id;
                                const CatIcon = cat.Icon;
                                return (
                                    <button
                                        key={cat.id}
                                        type="button"
                                        onClick={() => handleCategorySelect(cat)}
                                        className={`p-4 rounded-xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between group ${
                                            isSelected
                                                ? 'bg-primary/15 border-primary shadow-[0_0_20px_rgba(20,184,166,0.2)]'
                                                : 'bg-white/4 border-white/8 hover:border-white/20 hover:bg-white/7'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            <div
                                                className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                                                    isSelected
                                                        ? 'bg-primary text-black'
                                                        : 'bg-white/8 text-white/80 group-hover:text-white group-hover:bg-white/12'
                                                }`}
                                            >
                                                <CatIcon size={20} weight="duotone" />
                                            </div>
                                            <ArrowRight
                                                size={14}
                                                className={`transition-transform duration-200 ${
                                                    isSelected ? 'text-primary translate-x-0.5' : 'text-white/30 group-hover:text-white/60 group-hover:translate-x-0.5'
                                                }`}
                                            />
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-white mb-1">
                                                {cat.title}
                                            </div>
                                            <div className="text-xs text-white/50 line-clamp-2 leading-relaxed">
                                                {cat.subtitle}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </Motion.div>
                )}

                {/* STEP 2: Capabilities */}
                {step === 2 && (
                    <Motion.div
                        key="step2"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3, ease: easeOut }}
                        className="space-y-4"
                    >
                        <div>
                            <h3 className="text-xl md:text-2xl font-display font-bold text-white tracking-tight mb-1">
                                What capabilities do you need?
                            </h3>
                            <p className="text-sm text-white/60">
                                Select all modules and features required for your platform.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                            {capabilities.map((cap) => {
                                const isSelected = selectedFeatures.includes(cap.id);
                                const CapIcon = cap.Icon;
                                return (
                                    <button
                                        key={cap.id}
                                        type="button"
                                        onClick={() => toggleFeature(cap.id)}
                                        className={`p-3.5 rounded-xl border text-left transition-all duration-200 cursor-pointer flex items-center gap-3 ${
                                            isSelected
                                                ? 'bg-primary/15 border-primary/80 shadow-[0_0_15px_rgba(20,184,166,0.15)] text-white'
                                                : 'bg-white/4 border-white/8 hover:border-white/20 hover:bg-white/7 text-white/70 hover:text-white'
                                        }`}
                                    >
                                        <div
                                            className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                                                isSelected ? 'bg-primary text-black' : 'bg-white/8 text-white/60'
                                            }`}
                                        >
                                            <CapIcon size={16} weight="duotone" />
                                        </div>
                                        <span className="text-xs font-semibold leading-snug flex-1">
                                            {cap.label}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="pt-4 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setStep(3)}
                                className="px-6 py-3 rounded-full bg-white text-black font-bold text-xs uppercase tracking-wider hover:bg-white/90 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
                            >
                                Continue to Timeline <ArrowRight size={14} weight="bold" />
                            </button>
                        </div>
                    </Motion.div>
                )}

                {/* STEP 3: Timeline */}
                {step === 3 && (
                    <Motion.div
                        key="step3"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3, ease: easeOut }}
                        className="space-y-4"
                    >
                        <div>
                            <h3 className="text-xl md:text-2xl font-display font-bold text-white tracking-tight mb-1">
                                What is your target launch timeline?
                            </h3>
                            <p className="text-sm text-white/60">
                                This helps calculate your engineering sprint velocity and phased release schedule.
                            </p>
                        </div>

                        <div className="space-y-3 pt-2">
                            {timelines.map((timeline) => {
                                const isSelected = selectedTimeline?.id === timeline.id;
                                return (
                                    <button
                                        key={timeline.id}
                                        type="button"
                                        onClick={() => handleTimelineSelect(timeline)}
                                        className={`w-full p-4 rounded-xl border text-left transition-all duration-200 cursor-pointer flex items-center justify-between group ${
                                            isSelected
                                                ? 'bg-primary/15 border-primary shadow-[0_0_20px_rgba(20,184,166,0.2)]'
                                                : 'bg-white/4 border-white/8 hover:border-white/20 hover:bg-white/7'
                                        }`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div
                                                className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                                                    isSelected ? 'bg-primary text-black' : 'bg-white/8 text-white/70'
                                                }`}
                                            >
                                                <Clock size={20} weight="duotone" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-bold text-white">
                                                        {timeline.title}
                                                    </span>
                                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-primary font-semibold uppercase tracking-wider">
                                                        {timeline.timeframe}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-white/50 mt-0.5">
                                                    {timeline.description}
                                                </div>
                                            </div>
                                        </div>

                                        <ArrowRight
                                            size={16}
                                            className="text-white/30 group-hover:text-white transition-colors"
                                        />
                                    </button>
                                );
                            })}
                        </div>
                    </Motion.div>
                )}

                {/* STEP 4: Blueprint Reveal & Lead Form */}
                {step === 4 && (
                    <Motion.div
                        key="step4"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.35, ease: easeOut }}
                        className="space-y-6"
                    >
                        {/* Dynamic Blueprint Card */}
                        <div className="p-5 rounded-2xl bg-white/5 border border-primary/30 shadow-[0_0_30px_rgba(20,184,166,0.12)] relative overflow-hidden">
                            <div className="flex items-center justify-between gap-2 mb-3">
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/20 border border-primary/40 text-[10px] font-bold text-primary uppercase tracking-wider">
                                    <Sparkle size={12} weight="fill" />
                                    Custom Blueprint Recommended
                                </div>
                                <span className="text-xs font-semibold text-white/60">
                                    {activeTimeline.timeframe}
                                </span>
                            </div>

                            <h4 className="text-lg md:text-xl font-bold text-white mb-2 tracking-tight">
                                {activeBlueprint.title}
                            </h4>

                            <p className="text-xs md:text-sm text-white/70 leading-relaxed mb-4">
                                {activeBlueprint.architecture}
                            </p>

                            <div className="pt-3 border-t border-white/8 flex flex-wrap items-center justify-between gap-2 text-xs text-white/50">
                                <div>
                                    <span className="text-white/40">Portfolio Reference: </span>
                                    <span className="text-white/80 font-medium">{activeBlueprint.reference}</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setStep(1)}
                                    className="text-primary hover:underline text-xs font-semibold cursor-pointer"
                                >
                                    Adjust Choices
                                </button>
                            </div>
                        </div>

                        {/* Contact Form */}
                        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                            {errorMsg && (
                                <div className="p-3 rounded-lg bg-red-500/15 border border-red-500/30 text-red-200 text-xs font-medium">
                                    {errorMsg}
                                </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label htmlFor="wizard-name" className={labelClass}>
                                        Full Name *
                                    </label>
                                    <input
                                        id="wizard-name"
                                        type="text"
                                        name="name"
                                        required
                                        value={lead.name}
                                        onChange={handleLeadChange}
                                        placeholder="e.g. Maria Santos"
                                        className={inputClass}
                                    />
                                </div>

                                <div>
                                    <label htmlFor="wizard-email" className={labelClass}>
                                        Work Email *
                                    </label>
                                    <input
                                        id="wizard-email"
                                        type="email"
                                        name="email"
                                        required
                                        value={lead.email}
                                        onChange={handleLeadChange}
                                        placeholder="maria@company.ph"
                                        className={inputClass}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label htmlFor="wizard-phone" className={labelClass}>
                                        Phone / WhatsApp (Optional)
                                    </label>
                                    <input
                                        id="wizard-phone"
                                        type="tel"
                                        name="phone"
                                        value={lead.phone}
                                        onChange={handleLeadChange}
                                        placeholder="0917-000-0000"
                                        className={inputClass}
                                    />
                                </div>

                                <div>
                                    <label htmlFor="wizard-company" className={labelClass}>
                                        Company / Clinic (Optional)
                                    </label>
                                    <input
                                        id="wizard-company"
                                        type="text"
                                        name="company"
                                        value={lead.company}
                                        onChange={handleLeadChange}
                                        placeholder="Santos Group Inc."
                                        className={inputClass}
                                    />
                                </div>
                            </div>

                            <div>
                                <label htmlFor="wizard-notes" className={labelClass}>
                                    Specific Workflow Notes (Optional)
                                </label>
                                <textarea
                                    id="wizard-notes"
                                    name="notes"
                                    rows={2}
                                    value={lead.notes}
                                    onChange={handleLeadChange}
                                    placeholder="Any specific challenges, existing software, or unique requirements..."
                                    className={`${inputClass} resize-none`}
                                />
                            </div>

                            <LoadingButton
                                type="submit"
                                loading={status === 'loading'}
                                loadingLabel="Submitting Blueprint..."
                                className="w-full py-3.5 px-6 rounded-xl bg-white text-black font-bold text-sm tracking-wide hover:bg-white/90 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                            >
                                <span>Lock in Blueprint & Request Strategy Call</span>
                                <ArrowRight size={16} weight="bold" />
                            </LoadingButton>

                            <p className="text-[11px] text-center text-white/40">
                                24-hour response guarantee &bull; Confidential roadmap consultation
                            </p>
                        </form>
                    </Motion.div>
                )}
            </AnimatePresence>

            {/* Simple Form Toggle Link */}
            {onSwitchToSimple && (
                <div className="mt-6 pt-4 border-t border-white/6 text-center">
                    <button
                        type="button"
                        onClick={onSwitchToSimple}
                        className="text-xs text-white/50 hover:text-white transition-colors cursor-pointer inline-flex items-center gap-1.5"
                    >
                        <ChatTeardropText size={14} />
                        <span>Prefer a quick message? Switch to standard contact form</span>
                    </button>
                </div>
            )}
        </div>
    );
}

export default ContactWizard;
