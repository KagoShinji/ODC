import { useState } from 'react';
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
    { name: 'Dr. Humba', src: '/logos/drhumbalogonew.png' },
    { name: 'Chibs N Dink', src: '/logos/chibsndinknew.png' },
    { name: 'Sosyal Dinkers', src: '/logos/sosyaldinkers.png' },
    { name: 'Man and Paddle', src: '/logos/manandpaddle.png' },
    { name: 'KennyDink', src: '/logos/kennydinklogo.png' },
    { name: 'Talisay Chamber', src: '/logos/talisaychamber.png' },
    { name: 'Jump Serve Mandaue', src: '/logos/jumpservemandaue.png' },
    { name: 'CPRMED', src: '/logos/cprmedlogo.png' },

    { name: 'Jump Serve Mactan', src: '/logos/jumpservemactan.png' },
    { name: 'Pickleball Avenue', src: '/logos/nickleballavenue.png' },
    { name: 'The Pickle Point Cebu', src: '/logos/thepicklepoint.png' },
    { name: 'Firsel Tattoo', src: '/logos/firseltattoonew.png' },
    { name: 'Pater ni CJ', src: '/logos/paternicj.png' },
    { name: 'IMS-US', src: '/logos/ims-us.png' },
    { name: 'PDRRMO', src: '/logos/pdrrmo.jpg' },
    { name: 'Surigao del Norte', src: '/logos/surigaodelnorte.jpg' },
    { name: 'Slide Two', src: '/logos/slidetwo.png' },
    { name: 'The Halo Hub', src: '/logos/thehalohub.jpg' },
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
        title: 'ODC-Courts',
        type: 'Network Booking System',
        logo: '/odccourts/odc-courts.png',
        preview: '/odccourts/odc-courts.png',
        href: 'https://odc-courts.com/',
        description: 'An Airbnb-style booking system designed specifically for pickleball courts within the Odyssey Network. It offers a seamless, centralized platform for players to discover and reserve courts across multiple locations.',
        featured: true,
        theme: 'pickle',
        location: 'Odyssey Network',
        highlight: '🌐 Global Court Booking System',
        isCoreSystem: true,
        stats: [
            { value: 'Airbnb Style', label: 'Platform' },
            { value: 'Odyssey Network', label: 'Network' },
            { value: 'Multi-Location', label: 'Scale' },
        ],
    },
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
    {
        title: 'Jump Serve Mactan',
        type: 'Sports facility website',
        logo: '/logos/jumpservemactanlogo.jpg',
        preview: '/jumpservemactan.png',
        href: 'https://jumpservepickleball.com',
        description: 'A high-energy sports center website built for court discovery, schedule browsing, and fast reservation intent for pickleball facilities in Mactan.',
        theme: 'jumpserve',
        location: 'Mactan',
    },
    {
        title: 'Nickleball Avenue',
        type: 'Pickleball venue',
        logo: '/logos/nickleballavenuelogo.jpg',
        preview: '/nickleballavenue.png',
        href: 'https://nickleballavenue.com',
        description: 'A premium pickleball venue providing excellent courts, simple online booking, and an active player community.',
        theme: 'pickle',
        location: 'Talisay Cebu',
    },
    {
        title: 'Chibs N Dink',
        type: 'Pickleball platform',
        logo: '/logos/chibsndinknew.png',
        preview: '/pickleball/chibsndink.png',
        href: 'https://chibsndink.com/',
        description: 'A dynamic pickleball platform designed to streamline court bookings, connect players, and foster a growing local sports community.',
        theme: 'pickle',
    },
    {
        title: 'The Halo Hub',
        type: 'Court booking platform',
        logo: '/logos/thehalohub.jpg',
        preview: '/pickleball/thehalohub.png',
        href: 'https://thehalohubcebu.com/',
        description: 'A specialized platform for The Halo Hub in Cebu, offering seamless court reservations and a central hub for pickleball enthusiasts.',
        theme: 'pickle',
        location: 'Cebu',
    },
    {
        title: 'Sosyal Dinkers',
        type: 'Pickleball community platform',
        logo: '/logos/sosyaldinkers.png',
        preview: '/pickleball/sosyaldinkers.png',
        href: 'https://sosyaldinkersdavao.com/',
        description: 'An engaging sports platform for the Sosyal Dinkers in Davao, bringing together court booking, community events, and player connections.',
        theme: 'pickle',
        location: 'Davao',
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
        copy: 'We build fast, lightweight, and scalable architectures utilizing mobile-ready patterns where they make sense.',
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



function HeroShowcase() {
    return (
        <div className="hero-showcase">
            <Motion.a
                href="https://odc-courts.com/"
                target="_blank"
                rel="noreferrer"
                initial={{ opacity: 0, y: 42, rotate: -1.6 }}
                animate={{ opacity: 1, y: 0, rotate: 0 }}
                transition={{ duration: 0.9, delay: 0.28, ease: easeOut }}
                className="hero-device hero-laptop"
                aria-label="Open ODC-Courts"
            >
                <div className="device-topbar">
                    <span className="device-dots" />
                    <span>ODC-Courts</span>
                    <span>Core System</span>
                </div>
                <div className="device-screen">
                    <img src="/odccourts/odc-courts.png" alt="ODC-Courts website preview" />
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


            </div>
        </section>
    );
}


function BrowserStack({ title, projects }) {
    const [activeIndex, setActiveIndex] = useState(null);

    return (
        <div className="browser-stack-column">
            <h3 className="stack-category-title">{title}</h3>
            <div className="browser-stack-container" style={{ height: '550px', marginTop: '200px', perspective: '1000px' }}>
                {projects.map((project, i) => {
                    const isActive = activeIndex === i;
                    // Front item is index 0. Subsequent items have lower z-index.
                    const zIndex = isActive ? 100 : projects.length - i;

                    return (
                        <Motion.div
                            key={project.title}
                            className={`stacked-browser ${project.tablet ? 'tablet-mockup' : ''} ${isActive ? 'is-expanded' : ''}`}
                            initial={false}
                            animate={{
                                y: isActive ? 50 : -(i * 45), // items stack upwards and backwards
                                x: 0,
                                scale: isActive ? 1.05 : 1 - (i * 0.05), // get smaller as they go back
                                opacity: isActive ? 1 : 1 - (i * 0.08), // fade slightly as they go back
                                zIndex: zIndex
                            }}
                            whileHover={!isActive ? {
                                y: -(i * 45) - 20, // pop up slightly when hovered
                                scale: 1 - (i * 0.05) + 0.02,
                                transition: { duration: 0.2 }
                            } : {}}
                            onClick={() => setActiveIndex(isActive ? null : i)}
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            style={
                                project.isCoreSystem 
                                ? { 
                                    border: '1px solid rgba(255, 215, 0, 0.5)', 
                                    boxShadow: '0 0 40px rgba(255, 215, 0, 0.15), 0 0 15px rgba(255, 215, 0, 0.1) inset' 
                                } 
                                : {}
                            }
                        >
                            {!project.tablet ? (
                                <div className="browser-top-bar">
                                    <div className="browser-dots">
                                        <span className="dot red"></span>
                                        <span className="dot yellow"></span>
                                        <span className="dot green"></span>
                                    </div>
                                    <div className="browser-tab-title">
                                        {project.title}
                                    </div>
                                </div>
                            ) : (
                                <div className="tablet-top-bar">
                                    <div className="tablet-camera"></div>
                                </div>
                            )}

                            <div className="browser-viewport">
                                <div className="viewport-image-wrapper">
                                    <img src={project.preview} alt={project.title} className={project.tablet ? 'is-tablet' : ''} />
                                </div>
                                <div className="viewport-details">
                                    {project.isCoreSystem && (
                                        <div style={{ marginBottom: '12px' }}>
                                            <span style={{ 
                                                display: 'inline-flex', 
                                                alignItems: 'center', 
                                                gap: '6px', 
                                                background: 'rgba(255, 255, 255, 0.1)', 
                                                padding: '4px 10px', 
                                                borderRadius: '100px', 
                                                fontSize: '0.75rem', 
                                                fontWeight: '600', 
                                                letterSpacing: '0.05em', 
                                                color: '#fff', 
                                                border: '1px solid rgba(255,255,255,0.2)' 
                                            }}>
                                                <Sparkle size={12} weight="fill" color="#ffd700" />
                                                Core ODC System
                                            </span>
                                        </div>
                                    )}
                                    <p>{project.description}</p>
                                    <a href={project.href} target="_blank" rel="noreferrer" className="view-project-btn">
                                        View Live Site <ArrowSquareOut size={16} />
                                    </a>
                                </div>
                            </div>
                        </Motion.div>
                    );
                })}
            </div>
        </div>
    );
}

function UnifiedPortfolioSection() {
    return (
        <section id="portfolio" className="landing-section unified-portfolio-section">
            <div className="landing-shell">
                <SectionHeader
                    eyebrow="Selected Systems"
                    title="Fewer slides. Stronger proof."
                    copy="Explore our portfolio of commercial, civic, and operational platforms."
                    align="center"
                />

                <div className="portfolio-stacks-grid">
                    <BrowserStack title="Commercial Systems" projects={businessSystemShowcases} />
                    <BrowserStack title="Civic & Government" projects={governmentShowcases} />
                    <BrowserStack title="Sports Platforms" projects={pickleballShowcases} />
                </div>
            </div>
        </section>
    );
}


function PartnershipValueSection() {
    return (
        <section id="partnership" className="landing-section ready-section premium-ready-section" style={{ paddingBottom: '4rem' }}>
            <div className="landing-shell">
                <SectionHeader eyebrow="Partnership" title="Built for speed without losing polish." align="center" />
                <div className="ready-grid premium-ready-grid" style={{ marginTop: '4rem' }}>
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
            </div>
        </section>
    );
}

function TrustedClientsSection() {
    return (
        <section id="clients" className="landing-section trusted-clients-section" style={{ paddingBottom: '6rem', paddingTop: '4rem' }}>
            <div className="landing-shell">
                <p className="trusted-label" style={{ textAlign: 'center', marginBottom: '3rem', fontSize: '0.9rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.2em', fontWeight: '700' }}>
                    Trusted by Our Clients
                </p>
            </div>
            <div className="flex flex-wrap justify-center items-center w-full max-w-[1800px] mx-auto px-4 md:px-[4vw] gap-x-8 gap-y-10 md:gap-x-24 md:gap-y-16">
                {businessMarqueeLogos.map((item, index) => (
                    <div 
                        key={`${item.name}-${index}`} 
                        className="flex justify-center items-center w-24 h-12 sm:w-32 sm:h-16 md:w-48 md:h-24 lg:w-[240px] lg:h-[120px] transition-all duration-300 opacity-50 grayscale hover:opacity-100 hover:grayscale-0"
                    >
                        <img 
                            src={item.src} 
                            alt={`${item.name} logo`} 
                            loading="lazy" 
                            className="max-w-full max-h-full object-contain"
                        />
                    </div>
                ))}
            </div>
        </section>
    );
}

function FinalCta() {
    return (
        <section id="contact" className="landing-section ready-section premium-ready-section">
            <div className="landing-shell">
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
            <UnifiedPortfolioSection />
            <TrustedClientsSection />
            <PartnershipValueSection />
            <FinalCta />
        </div>
    );
}
