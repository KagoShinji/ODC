import { motion as Motion } from 'framer-motion';
import {
    ArrowRight,
    ArrowSquareOut,
    Buildings,
    CheckCircle,
    Code,
    DeviceMobile,
    GlobeHemisphereWest,
    Lightning,
    ShieldCheck,
    Sparkle,
    Trophy,
} from '@phosphor-icons/react';

const easeOut = [0.22, 1, 0.36, 1];

const fadeUp = {
    hidden: { opacity: 0, y: 36, filter: 'blur(10px)' },
    show: { opacity: 1, y: 0, filter: 'blur(0px)' },
};

const sectionMotion = {
    initial: 'hidden',
    whileInView: 'show',
    viewport: { once: true, margin: '-90px' },
    transition: { duration: 0.85, ease: easeOut },
    variants: fadeUp,
};

const businessMarqueeLogos = [
    { name: 'The Pickle Point Cebu', src: '/logos/picklepointnewlogo.jpg' },
    { name: 'Firsel Tattoo', src: '/logos/firseltattoologo.jpg' },
    { name: 'IMS-US', src: '/logos/ims-uslogo.png' },
    { name: 'MediQuick', src: '/logos/mediquicklogo.jpg' },
    { name: 'Ngosiok Marketing', src: '/logos/ngosiokmarketinglogo.jpg' },
    { name: 'PDRRMO-Surigao del Norte', src: '/logos/pdrrmo.jpg' },
    { name: 'Surigao del Norte', src: '/logos/surigaodelnorte.jpg' },
    { name: 'CPRMED', src: '/logos/cprmedlogo.png' },
    { name: 'SPEC', src: '/logos/speclogo.jpg' },
    { name: 'The Knee Arthritis', src: '/thekneearthritis&orthopaedicinstitute.png' },
    { name: 'Jump Serve Sports Center Mandaue', src: '/logos/jumpservemandauelogo.png' },
    { name: 'KennyDink Moalboal Cebu', src: '/logos/kennydinklogo.jpg' },
    { name: 'SupportTeach', src: '/logos/supportteachlogo.svg' },
];

const businessSystemShowcases = [
    {
        title: 'Firsel Tattoo',
        type: 'Artist portfolio',
        logo: '/logos/firseltattoologo.jpg',
        preview: '/firseltattoo.png',
        href: 'https://firseltattoo.ink',
        description: 'A visual-first portfolio shaped around work quality, studio identity, and booking confidence.',
        theme: 'ink',
    },
    {
        title: 'IMS-US',
        type: 'Professional services website',
        logo: '/logos/ims-uslogo.png',
        preview: '/imsus.png',
        href: 'https://ims-us.com',
        description: 'A structured web presence for service credibility, brand clarity, and conversion-ready navigation.',
        theme: 'blue',
    },
    {
        title: 'MediQuick',
        type: 'Medicine commerce UI',
        logo: '/logos/mediquicklogo.jpg',
        preview: '/MediQuick.png',
        href: 'https://mediquick.space',
        description: 'A tablet-ready medicine browsing and inventory interface for quick decisions and cleaner stock workflows.',
        theme: 'medical',
        tablet: true,
    },
    {
        title: 'Ngosiok Marketing',
        type: 'Corporate portfolio',
        logo: '/logos/ngosiokmarketinglogo.jpg',
        preview: '/ngosiokmarketing.jpg',
        href: 'https://ngosiokmarketing.netlify.app',
        description: 'A direct company presentation for credibility, services, and brand presence without unnecessary friction.',
        theme: 'commerce',
    },
    {
        title: 'CPRMed',
        type: 'Medical clinic website',
        logo: '/logos/cprmedlogo.png',
        preview: '/cprmed.jpg',
        href: 'https://cprmedph.com',
        description: 'A professional medical clinic website built for patient trust, clear service navigation, and appointment readiness.',
        theme: 'medical',
    },
    {
        title: 'SPEC',
        type: 'Preventive Maintenance Service platform',
        logo: '/logos/speclogo.jpg',
        preview: '/spec-c.jpg',
        href: 'https://odyssey-pms-system.vercel.app',
        description: 'A comprehensive preventive maintenance service platform with equipment tracking, service scheduling, and maintenance dashboards.',
        theme: 'blue',
    },
    {
        title: 'The Knee Arthritis & Orthopaedic Institute',
        type: 'Medical institute website',
        logo: '/thekneearthritis&orthopaedicinstitute.png',
        preview: '/thekneearthritis&orthopaedicinstitute.png',
        href: 'https://odyssey-clinic-system.vercel.app/portal',
        description: 'A specialist medical institute landing page designed for patient confidence, procedure clarity, and referral readiness.',
        theme: 'medical',
    },
    {
        title: 'SupportTeach',
        type: 'Learning management system',
        logo: '/logos/supportteachlogo.svg',
        preview: '/images/supportteach.png',
        href: 'https://supportteach.netlify.app/',
        description: 'An educational platform built for structured learning delivery, student progress tracking, and teacher-driven course management with clean workflow-first UI.',
        theme: 'supportteach',
    },
];

const pickleballShowcases = [
    {
        title: 'The Pickle Point Cebu',
        type: 'Court booking platform',
        logo: '/logos/picklepointnewlogo.jpg',
        preview: '/thepicklepointcebu.jpg',
        href: 'https://thepicklepointcebu.com',
        description: 'The go-to pickleball destination in Mandaue City — offering premium court access, fast reservations, and a community-first experience that keeps players coming back week after week.',
        featured: true,
        theme: 'pickle',
        location: 'Mandaue City',
        highlight: '🏆 Most Popular Court Venue in Mandaue City',
        stats: [
            { value: 'Pickleball', label: 'Specialty' },
            { value: 'Live Booking', label: 'System' },
            { value: "Mandaue's #1", label: 'Reputation' },
        ],
    },
    {
        title: 'KennyDink Moalboal Cebu',
        type: 'Resort & pickleball booking platform',
        logo: '/logos/kennydinklogo.jpg',
        preview: '/kennydink.png',
        href: 'https://kennydinkmoalboalcebu.com',
        description: 'A resort-integrated pickleball court booking platform for Moalboal — blending leisure discovery, court reservations, and guest experience into one polished site.',
        theme: 'kennydink',
        location: 'Moalboal, Cebu',
    },
    {
        title: 'Jump Serve Sports Center Mandaue',
        type: 'Sports facility website',
        logo: '/logos/jumpservemandauelogo.png',
        preview: '/jumpserve.png',
        href: 'https://jumpservesportscenter.com',
        description: 'A high-energy sports center website built for court discovery, schedule browsing, and fast reservation intent for volleyball and multi-sport facilities.',
        theme: 'jumpserve',
        location: 'Mandaue City',
    },
];

const governmentShowcases = [
    {
        title: 'Provincial Accounting Office',
        agency: 'Provincial Government of Surigao del Norte',
        logo: '/logos/surigaodelnorte.jpg',
        preview: '/government/pacco.jpg',
        href: '/government/pacco.jpg',
        theme: 'civic-gold',
        description: 'A formal agency landing page with public-facing office information and a more cohesive digital identity.',
    },
    {
        title: 'Provincial General Services Office',
        agency: 'Provincial Government of Surigao del Norte',
        logo: '/logos/surigaodelnorte.jpg',
        preview: '/government/pgso.jpg',
        href: '/government/pgso.jpg',
        theme: 'civic-green',
        description: 'A matching government office page for procurement, services, and administrative pathways.',
    },
    {
        title: 'PDRRMO Dispatch Tracker',
        agency: 'Provincial Disaster Risk Reduction and Management Office - Surigao del Norte',
        logo: '/logos/pdrrmo.jpg',
        preview: '/government/dispatchtracker.jpg',
        href: '/government/dispatchtracker.jpg',
        theme: 'dispatch-red',
        description: 'A tablet-optimized operations display for monitoring dispatch activity and response status.',
        tablet: true,
    },
];

const deliveryPillars = [
    {
        icon: Lightning,
        title: 'Cut the manual loop',
        copy: 'We map the current workflow first, then turn repeated admin steps into guided product flows.',
    },
    {
        icon: ShieldCheck,
        title: 'Design for trust',
        copy: 'Every build carries the brand, the interface, and the operational logic as one connected system.',
    },
    {
        icon: Code,
        title: 'Ship lean systems',
        copy: 'React, Vite, Supabase, Firebase, SQLite, and mobile-ready patterns where they make sense.',
    },
];

function PremiumButton({ href, children, tone = 'light' }) {
    return (
        <a href={href} className={`reference-button premium-button ${tone}`}>
            <span>{children}</span>
            <span className="button-orb" aria-hidden="true">
                <ArrowRight size={15} weight="bold" />
            </span>
        </a>
    );
}

function SectionHeader({ eyebrow, title, copy, align = 'left' }) {
    return (
        <Motion.div {...sectionMotion} className={`section-header ${align === 'center' ? 'mx-auto text-center' : ''}`}>
            {eyebrow ? <span className="reference-eyebrow">{eyebrow}</span> : null}
            <h2>{title}</h2>
            {copy ? <p>{copy}</p> : null}
        </Motion.div>
    );
}

function LogoMarquee({ items }) {
    return (
        <div className="logo-marquee is-compact" aria-label="Featured businesses">
            <div className="logo-marquee-track">
                {[...items, ...items].map((item, index) => (
                    <div className="logo-marquee-item business-logo-item" key={`${item.name}-${index}`}>
                        <span className="logo-mark">
                            <img src={item.src} alt={`${item.name} logo`} loading="lazy" />
                        </span>
                        <span className="logo-name">{item.name}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function HeroShowcase() {
    return (
        <div className="hero-showcase">
            <Motion.a
                href="https://thepicklepointcebu.com"
                target="_blank"
                rel="noreferrer"
                initial={{ opacity: 0, y: 42, rotate: -1.6 }}
                animate={{ opacity: 1, y: 0, rotate: 0 }}
                transition={{ duration: 0.9, delay: 0.28, ease: easeOut }}
                className="hero-device hero-laptop"
                aria-label="Open The Pickle Point Cebu"
            >
                <div className="device-topbar">
                    <span className="device-dots" />
                    <span>The Pickle Point Cebu</span>
                    <span>Live system</span>
                </div>
                <div className="device-screen">
                    <img src="/thepicklepointcebu.jpg" alt="The Pickle Point Cebu website preview" />
                </div>
                <div className="laptop-base" />
            </Motion.a>

            <Motion.a
                href="/government/dispatchtracker.jpg"
                target="_blank"
                rel="noreferrer"
                initial={{ opacity: 0, y: 42, x: 24, rotate: 5 }}
                animate={{ opacity: 1, y: 0, x: 0, rotate: 0 }}
                transition={{ duration: 0.95, delay: 0.42, ease: easeOut }}
                className="hero-device hero-tablet"
                aria-label="Open PDRRMO Dispatch Tracker preview"
            >
                <div className="tablet-camera" />
                <div className="device-screen">
                    <img src="/government/dispatchtracker.jpg" alt="PDRRMO dispatch tracker tablet preview" />
                </div>
                <div className="device-caption">
                    <span>Operations display</span>
                    <strong>PDRRMO tracker</strong>
                </div>
            </Motion.a>
        </div>
    );
}

function HeroSection() {
    return (
        <section id="home" className="reference-hero premium-hero">
            <div className="reference-grid-lines" />
            <div className="ambient ambient-hero" />
            <div className="landing-shell">
                <Motion.div
                    initial="hidden"
                    animate="show"
                    variants={{ show: { transition: { staggerChildren: 0.12, delayChildren: 0.18 } } }}
                    className="hero-layout"
                >
                    <div className="hero-copy">
                        <Motion.div variants={fadeUp} className="brand-mark">
                            <Sparkle size={16} weight="fill" />
                            <span>ODC IT Solutions</span>
                        </Motion.div>
                        <Motion.h1 variants={fadeUp}>Automated systems for teams buried in manual work.</Motion.h1>
                        <Motion.p variants={fadeUp}>
                            We design and build workflow-first websites, dashboards, booking tools, and operational systems for businesses and public offices that need speed without losing polish.
                        </Motion.p>
                        <Motion.div variants={fadeUp} className="hero-actions">
                            <PremiumButton href="#contact">Start a project</PremiumButton>
                            <a href="#systems" className="reference-button text-button">
                                View selected systems
                            </a>
                        </Motion.div>
                    </div>
                    <HeroShowcase />
                </Motion.div>

                <Motion.div {...sectionMotion} className="trust-strip premium-trust-strip premium-business-marquee-strip">
                    <p className="trusted-label">Trusted by Our Clients</p>
                    <LogoMarquee items={businessMarqueeLogos} />
                </Motion.div>
            </div>
        </section>
    );
}

function BusinessSystemCard({ item, index }) {
    return (
        <Motion.a
            href={item.href}
            target="_blank"
            rel="noreferrer"
            {...sectionMotion}
            transition={{ duration: 0.82, delay: index * 0.07, ease: easeOut }}
            className={`business-system-card ${item.featured ? 'is-featured' : ''} ${item.tablet ? 'is-tablet' : ''} ${item.theme}`}
            aria-label={`Open ${item.title}`}
        >
            <div className="business-system-preview">
                <img src={item.preview} alt={`${item.title} interface preview`} loading="lazy" />
            </div>
            <div className="business-system-content">
                <div className="business-logo-stage">
                    <img src={item.logo} alt={`${item.title} logo`} loading="lazy" />
                </div>
                <div className="business-system-copy">
                    <span>{item.type}</span>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                </div>
                <span className="business-open-link">
                    {item.href.startsWith('http') ? 'Open website' : 'Open preview'}
                    <ArrowSquareOut size={14} weight="bold" />
                </span>
            </div>
        </Motion.a>
    );
}

function SystemsShowcase() {
    return (
        <section id="systems" className="landing-section docs-section systems-showcase-section">
            <div className="landing-shell">
                <div className="premium-section-intro">
                    <SectionHeader
                        eyebrow="Selected systems"
                        title="Fewer slides. Stronger proof."
                        copy="A focused set of real builds across booking, portfolio, medicine, service, and operations workflows. The page now lets the work carry the story instead of repeating the same pitch."
                    />
                    <div className="section-side-note">
                        <Buildings size={22} weight="duotone" />
                        <p>Built for businesses that need usable software, not decorative mockups.</p>
                    </div>
                </div>

                <div className="business-system-grid premium-system-grid">
                    {businessSystemShowcases.map((item, index) => (
                        <BusinessSystemCard key={item.title} item={item} index={index} />
                    ))}
                </div>
            </div>
        </section>
    );
}

function PickleballCard({ item, index }) {
    return (
        <Motion.a
            href={item.href}
            target="_blank"
            rel="noreferrer"
            {...sectionMotion}
            transition={{ duration: 0.82, delay: index * 0.1, ease: easeOut }}
            className={`pickleball-card ${item.featured ? 'is-featured' : ''} ${item.theme}`}
            aria-label={`Open ${item.title}`}
        >
            {item.highlight && (
                <div className="pickleball-highlight-badge">
                    <span>{item.highlight}</span>
                </div>
            )}
            <div className="pickleball-card-preview">
                <img src={item.preview} alt={`${item.title} preview`} loading="lazy" />
            </div>
            <div className="pickleball-card-content">
                <div className="pickleball-logo-wrap">
                    <img src={item.logo} alt={`${item.title} logo`} loading="lazy" />
                </div>
                <div className="pickleball-card-copy">
                    <div className="pickleball-card-meta">
                        <span className="pickleball-type">{item.type}</span>
                        {item.location && (
                            <span className="pickleball-location">{item.location}</span>
                        )}
                    </div>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                </div>
                {item.stats && (
                    <div className="pickleball-stats">
                        {item.stats.map((stat) => (
                            <div className="pickleball-stat" key={stat.label}>
                                <strong>{stat.value}</strong>
                                <span>{stat.label}</span>
                            </div>
                        ))}
                    </div>
                )}
                <span className="pickleball-open-link">
                    Open website
                    <ArrowSquareOut size={14} weight="bold" />
                </span>
            </div>
        </Motion.a>
    );
}

function PickleballShowcase() {
    return (
        <section id="pickleball" className="landing-section pickleball-section">
            <div className="pickleball-section-bg" aria-hidden="true" />
            <div className="landing-shell">
                <div className="pickleball-section-header">
                    <SectionHeader
                        eyebrow="Court & sports systems"
                        title="Powering Cebu's court culture."
                        copy="Dedicated platforms for sports centers and court venues — built to handle bookings, schedules, and on-court experiences with precision and clarity."
                    />
                    <div className="pickleball-badge">
                        <Trophy size={18} weight="fill" />
                        <span>3 Live Venues</span>
                    </div>
                </div>

                <div className="pickleball-grid">
                    {pickleballShowcases.map((item, index) => (
                        <PickleballCard key={item.title} item={item} index={index} />
                    ))}
                </div>
            </div>
        </section>
    );
}

function GovernmentShowcase() {
    return (
        <section id="civic" className="landing-section government-showcase-section premium-government-section">
            <div className="landing-shell">
                <div className="government-showcase-header">
                    <SectionHeader
                        eyebrow="Civic work"
                        title="Government systems with matched identity."
                        copy="Agency pages and operational displays are treated as one visual system: formal, readable, and immediately tied to the office they represent."
                    />
                    <a href="/government/pacco.jpg" target="_blank" rel="noreferrer" className="tiny-link showcase-header-link">
                        Open sample
                        <ArrowSquareOut size={13} weight="bold" />
                    </a>
                </div>

                <div className="government-showcase-grid">
                    {governmentShowcases.map((item, index) => (
                        <Motion.a
                            key={item.title}
                            href={item.href}
                            target="_blank"
                            rel="noreferrer"
                            {...sectionMotion}
                            transition={{ duration: 0.8, delay: index * 0.08, ease: easeOut }}
                            className={`government-showcase-card ${item.theme} ${item.tablet ? 'is-tablet' : ''}`}
                            aria-label={`Open ${item.title} preview`}
                        >
                            <div className="showcase-copy-block">
                                <div className="showcase-logo-lockup">
                                    <img src={item.logo} alt={`${item.title} logo`} loading="lazy" />
                                    <div>
                                        <span>{item.agency}</span>
                                        <h3>{item.title}</h3>
                                    </div>
                                </div>
                                <p>{item.description}</p>
                                <span className="showcase-open-link">
                                    View preview
                                    <ArrowSquareOut size={14} weight="bold" />
                                </span>
                            </div>
                            <div className="showcase-preview-frame">
                                <img src={item.preview} alt={`${item.title} page preview`} loading="lazy" />
                            </div>
                        </Motion.a>
                    ))}
                </div>
            </div>
        </section>
    );
}

function FinalCta() {
    return (
        <section id="contact" className="landing-section ready-section premium-ready-section">
            <div className="landing-shell">
                <div className="ready-grid premium-ready-grid">
                    {deliveryPillars.map((card, index) => {
                        const Icon = card.icon;
                        return (
                            <Motion.article
                                key={card.title}
                                {...sectionMotion}
                                transition={{ duration: 0.75, delay: index * 0.08, ease: easeOut }}
                            >
                                <Icon size={25} weight="duotone" />
                                <h3>{card.title}</h3>
                                <p>{card.copy}</p>
                            </Motion.article>
                        );
                    })}
                </div>

                <Motion.div {...sectionMotion} className="final-cta premium-final-cta">
                    <div>
                        <span className="reference-eyebrow">Build with ODC</span>
                        <h2>Turn the workflow you keep explaining into the system your team actually uses.</h2>
                        <PremiumButton href="/contact" tone="dark">Talk to ODC</PremiumButton>
                    </div>
                    <div className="final-system-window" aria-hidden="true">
                        <div className="window-dots"><span /><span /><span /></div>
                        <div className="final-window-body">
                            <aside>
                                <span className="active"><CheckCircle size={13} weight="fill" /> Discovery</span>
                                <span><DeviceMobile size={13} weight="fill" /> Interface</span>
                                <span><GlobeHemisphereWest size={13} weight="fill" /> Launch</span>
                            </aside>
                            <main>
                                <div className="final-window-toolbar">
                                    <span>workflow audit</span>
                                    <strong>ready</strong>
                                </div>
                                <div className="final-window-title" />
                                <div className="final-window-grid"><span /><span /><span /></div>
                            </main>
                        </div>
                    </div>
                    <div className="cta-gradient" />
                </Motion.div>
            </div>
        </section>
    );
}

export function Home() {
    return (
        <div className="reference-landing premium-landing">
            <HeroSection />
            <SystemsShowcase />
            <PickleballShowcase />
            <GovernmentShowcase />
            <FinalCta />
        </div>
    );
}
