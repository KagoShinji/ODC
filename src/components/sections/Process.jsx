import { motion as Motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';

const steps = [
    {
        title: 'Discovery',
        description: 'We clarify your goals, customers, and constraints so every technical decision maps to real business impact.',
        image: '/thepicklepointcebu.jpg',
    },
    {
        title: 'Strategy',
        description: 'We map scope, timeline, and success metrics into a practical plan your team can execute with confidence.',
        image: '/MediQuick.png',
    },
    {
        title: 'Delivery',
        description: 'We ship in focused iterations with transparent updates, QA checkpoints, and post-launch support for your team.',
        image: '/images/process-delivery.jpg',
    },
];

export function ProcessSection() {
    return (
        <section className="ambient-light-section ambient-process pt-24 md:pt-32 pb-20 relative overflow-hidden">
            <div className="section-ambient-orb section-ambient-orb-left" />

            <div className="container mx-auto px-6 md:px-12 relative z-10">
                <Motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center mb-14"
                >
                    <span className="text-xs font-semibold text-primary uppercase tracking-widest mb-3 block">How We Work</span>
                    <h2 className="text-3xl md:text-5xl font-bold mb-5 tracking-tight">
                        A Clear 3-Step <span className="text-primary">Delivery Flow</span>
                    </h2>
                    <p className="text-muted-foreground max-w-2xl mx-auto text-lg leading-relaxed">
                        A predictable process keeps clinic, retail, and service projects focused, on schedule, and aligned with measurable outcomes.
                    </p>
                </Motion.div>

                <div className="flex flex-col md:flex-row items-stretch gap-3 md:gap-0">
                    {steps.map((step, index) => (
                        <div key={step.title} className="flex flex-col md:flex-row items-stretch flex-1">
                            <Motion.div
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: index * 0.12 }}
                                className="flex-1 rounded-2xl bg-white border border-border/60 shadow-sm overflow-hidden group"
                            >
                                {/* Image with step number overlaid */}
                                <div className="relative">
                                    <img
                                        src={step.image}
                                        alt={step.title}
                                        className="w-full h-40 object-cover"
                                        onError={(event) => {
                                            event.currentTarget.src = '/odysseyfamilyclinic.jpg';
                                        }}
                                    />
                                    <div className="absolute inset-0 bg-linear-to-t from-navy-950/55 via-navy-950/10 to-transparent" />
                                    {/* Step badge over the image, top-left */}
                                    <div className="absolute top-3 left-3 w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shadow-lg shadow-primary/30">
                                        {index + 1}
                                    </div>
                                    {/* Step title overlaid on image bottom */}
                                    <h3 className="absolute bottom-3 left-4 text-lg font-bold tracking-tight text-white drop-shadow-sm">
                                        {step.title}
                                    </h3>
                                </div>
                                <div className="p-5">
                                    <p className="text-muted-foreground text-sm leading-relaxed">{step.description}</p>
                                </div>
                            </Motion.div>

                            {/* Connector arrow between steps — visible on md+ only */}
                            {index < steps.length - 1 && (
                                <div className="hidden md:flex items-center justify-center px-1 shrink-0 text-primary/30" aria-hidden="true">
                                    <ChevronRight className="w-6 h-6" />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}


