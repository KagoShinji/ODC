import { useRef } from 'react';
import { motion as Motion } from 'framer-motion';
import { fadeUpSoft, gsap, maskUp, mq, reveal, stagger, useGSAP } from '../../lib/motion';
import { Code, Smartphone, Cloud, Database, Palette, ArrowRight, Layers } from 'lucide-react';

const services = [
    {
        Icon: Code,
        title: 'Web Development',
        description: 'Launch high-converting websites and portals that improve lead quality and speed up your sales cycle.',
    },
    {
        Icon: Smartphone,
        title: 'Mobile Apps',
        description: 'Create mobile apps for booking, customer engagement, and retention that keep users coming back.',
    },
    {
        Icon: Cloud,
        title: 'Cloud Solutions',
        description: 'Cut downtime and infrastructure waste with resilient cloud architecture designed for long-term growth.',
    },
    {
        Icon: Database,
        title: 'Backend Systems',
        description: 'Build reliable backends and APIs for scheduling, inventory, payments, and internal operations.',
    },
    {
        Icon: Palette,
        title: 'UI/UX Design',
        description: 'Design user journeys that remove friction, increase activation, and improve conversion rates.',
    },
    {
        Icon: Layers,
        title: 'System Integration',
        description: 'Connect your CRM, billing, and messaging tools so teams spend less time on manual tasks.',
    },
];

export function ServicesSection() {
    const sectionRef = useRef(null);

    // Progress line fills as the service grid scrolls through the viewport.
    useGSAP(() => {
        const mm = gsap.matchMedia();
        mm.add(mq.motionOk, () => {
            gsap.fromTo('.services-progress', { scaleX: 0 }, {
                scaleX: 1,
                ease: 'none',
                scrollTrigger: { trigger: '.services-grid', start: 'top 85%', end: 'bottom 60%', scrub: 0.4 },
            });
        });
    }, { scope: sectionRef });

    return (
        <section id="services" ref={sectionRef} className="ambient-light-section ambient-services pt-24 md:pt-32 pb-20 relative overflow-hidden">
            <div className="section-ambient-orb section-ambient-orb-right" />

            <div className="container mx-auto px-6 md:px-12 relative z-10">
                <Motion.div
                    {...reveal({ variants: maskUp })}
                    className="mb-10 md:mb-14 text-center"
                >
                    <span className="text-xs font-semibold text-primary uppercase tracking-widest mb-3 block">Our Expertise</span>
                    <h2 className="text-3xl md:text-5xl font-bold mb-5 tracking-tight">
                        Services Designed for <span className="text-primary">Business Outcomes</span>
                    </h2>
                    <p className="text-muted-foreground max-w-xl mx-auto text-lg leading-relaxed">
                        Every engagement is mapped to a target result, from better patient or customer flow to stronger conversion and more reliable operations.
                    </p>
                </Motion.div>

                <div className="mx-auto mb-10 h-px max-w-3xl overflow-hidden bg-border/60 md:mb-14" aria-hidden="true">
                    <span className="services-progress block h-full origin-left bg-gradient-to-r from-primary/0 via-primary to-primary/60" />
                </div>

                <div className="services-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {services.map((service, index) => (
                        <Motion.div
                            key={index}
                            {...reveal({ delay: (index % 3) * stagger.base + Math.floor(index / 3) * 0.04, variants: fadeUpSoft })}
                            whileHover={{ y: -5, transition: { duration: 0.2 } }}
                            className="group relative bg-white rounded-2xl p-6 border border-border/60 shadow-sm hover:shadow-lg hover:border-primary/25 transition-[box-shadow,border-color] duration-300"
                        >
                            {/* Service number */}
                            <span className="absolute top-5 right-6 text-xs font-bold font-mono text-border/70 group-hover:text-primary/35 transition-colors select-none">
                                {String(index + 1).padStart(2, '0')}
                            </span>

                            {/* Icon container — transitions to filled primary on hover */}
                            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary transition-colors duration-300 text-primary group-hover:text-white">
                                <service.Icon className="w-6 h-6" />
                            </div>

                            <h3 className="text-lg font-bold mb-2 tracking-tight group-hover:text-primary transition-colors">{service.title}</h3>
                            <p className="text-muted-foreground text-sm leading-relaxed mb-4">{service.description}</p>

                            {/* "Learn more" — always subtly visible, brightens on hover */}
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-primary/40 group-hover:text-primary group-hover:gap-2 transition-all duration-300">
                                Learn more <ArrowRight className="w-3 h-3" />
                            </div>
                        </Motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}


