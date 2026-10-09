import { useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { CaretDown, Sparkle } from '@phosphor-icons/react';

const easeOut = [0.22, 1, 0.36, 1];

const faqs = [
    {
        question: 'What services does OdysseyPH IT Solutions specialize in?',
        answer: 'OdysseyPH designs and builds custom business systems, healthcare clinic management platforms, multi-venue court booking software (like ODC-Courts), and responsive web applications for businesses, medical practices, and government agencies in the Philippines.',
    },
    {
        question: 'Does OdysseyPH build custom clinic and medical management systems?',
        answer: 'Yes. OdysseyPH develops secure clinical management solutions featuring electronic medical records (EMR), patient appointment scheduling, billing, and doctor workflows—proven in deployments like Odyssey Family Clinic, CPRMed, and specialist orthopedic institutes.',
    },
    {
        question: 'What is ODC-Courts and what sports venues use OdysseyPH systems?',
        answer: 'ODC-Courts is a specialized court reservation network for sports centers and pickleball venues. OdysseyPH systems power online reservations and court operations for venues like The Pickle Point Cebu, Jump Serve Sports Center (Mandaue & Mactan), KennyDink Moalboal, Nickleball Avenue, and Sosyal Dinkers Davao.',
    },
    {
        question: 'Where is OdysseyPH IT Solutions located, and do you serve clients nationwide?',
        answer: 'OdysseyPH is headquartered in Cebu, Philippines, providing custom software engineering and digital transformation services to clients across Cebu, Metro Manila, Davao, Northern Mindanao, and international markets.',
    },
    {
        question: 'What technology stack does OdysseyPH use for software development?',
        answer: 'OdysseyPH engineers high-performance web and mobile systems utilizing React, Node.js, modern cloud infrastructure (Firebase, Google Cloud), RESTful APIs, and responsive mobile-first interfaces with enterprise-grade security.',
    },
    {
        question: 'How fast can OdysseyPH launch a custom business system or website?',
        answer: 'Depending on project scope, custom web portals and core workflow systems are typically developed and deployed in agile sprints ranging from 2 to 6 weeks, backed by continuous staging demos and post-launch support.',
    },
];

export function FAQSection() {
    const [openIndex, setOpenIndex] = useState(0);

    const toggleFAQ = (index) => {
        setOpenIndex((prev) => (prev === index ? -1 : index));
    };

    // Schema.org FAQPage JSON-LD
    const faqSchema = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqs.map((faq) => ({
            '@type': 'Question',
            name: faq.question,
            acceptedAnswer: {
                '@type': 'Answer',
                text: faq.answer,
            },
        })),
    };

    return (
        <section id="faq" className="landing-section faq-section py-20 relative overflow-hidden">
            {/* Embedded Schema for Answer Engines */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
            />

            <div className="landing-shell max-w-5xl mx-auto px-4 md:px-6">
                <div className="text-center mb-12">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-semibold uppercase tracking-widest text-primary mb-4">
                        <Sparkle size={14} weight="fill" className="text-primary" />
                        <span>Direct Answers & FAQ</span>
                    </div>
                    <h2 className="text-3xl md:text-5xl font-display font-black text-white tracking-tight mb-4">
                        Frequently Asked Questions
                    </h2>
                    <p className="text-white/60 max-w-xl mx-auto text-base md:text-lg leading-relaxed">
                        Clear, factual answers about our custom software engineering capabilities, healthcare systems, and court booking platforms.
                    </p>
                </div>

                <div className="space-y-4">
                    {faqs.map((faq, index) => {
                        const isOpen = openIndex === index;
                        return (
                            <div
                                key={index}
                                className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
                                    isOpen
                                        ? 'bg-white/[0.07] border-white/20 shadow-[0_0_30px_rgba(0,0,0,0.3)]'
                                        : 'bg-white/[0.03] border-white/10 hover:border-white/15'
                                }`}
                            >
                                <button
                                    type="button"
                                    onClick={() => toggleFAQ(index)}
                                    className="w-full py-5 px-6 flex items-center justify-between text-left gap-4 focus:outline-none cursor-pointer"
                                    aria-expanded={isOpen}
                                >
                                    <span className="text-base md:text-lg font-semibold text-white tracking-tight">
                                        {faq.question}
                                    </span>
                                    <span
                                        className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-white/5 border border-white/10 text-white/70 transition-transform duration-300 ${
                                            isOpen ? 'rotate-180 bg-primary/20 text-primary border-primary/30' : ''
                                        }`}
                                    >
                                        <CaretDown size={16} weight="bold" />
                                    </span>
                                </button>

                                <AnimatePresence initial={false}>
                                    {isOpen && (
                                        <Motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.35, ease: easeOut }}
                                        >
                                            <div className="px-6 pb-6 pt-1 text-sm md:text-base leading-relaxed text-white/70 border-t border-white/5">
                                                {faq.answer}
                                            </div>
                                        </Motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}

export default FAQSection;
