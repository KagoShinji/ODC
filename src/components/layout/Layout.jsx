import { motion as Motion, MotionConfig } from 'framer-motion';
import { ArrowRight } from '@phosphor-icons/react';
import { useLocation } from 'react-router-dom';
import { Navbar } from './Navbar';
import { ScrollManager, ScrollProgress } from './ScrollEffects';
import { HalloweenDecor } from './HalloweenDecor';
import { ease } from '../../lib/motion';

export function Layout({ children }) {
    const { pathname } = useLocation();

    return (
        <MotionConfig reducedMotion="user">
            <div className="flex min-h-screen flex-col">
                <ScrollManager />
                <ScrollProgress />
                <Navbar />
                <HalloweenDecor />
                <Motion.main
                    key={pathname}
                    className="grow overflow-x-hidden"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.28, ease: ease.out }}
                >
                    {children}
                </Motion.main>
                <footer className="relative overflow-hidden border-t border-white/10 bg-[#e6f0ec] py-12 text-[#101718]">
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(13,119,124,0.12),transparent_24rem),radial-gradient(circle_at_86%_100%,rgba(237,194,127,0.16),transparent_22rem)]" />
                    <div className="relative mx-auto grid w-[min(1480px,calc(100%-clamp(1rem,5vw,5.5rem)))] items-end gap-8 md:grid-cols-[1fr_auto]">
                        <div>
                            <div className="mb-5 inline-flex items-center gap-2 font-display text-sm font-black tracking-[-0.04em]">
                                <img src="/images/odc.jpg" alt="ODC Logo" className="h-6 w-6 rounded-full object-cover" />
                                OdysseyPH IT Solutions
                            </div>
                            <p className="max-w-xl text-sm leading-relaxed text-[#101718]/58">
                                Business systems, automation, and polished digital products for teams ready to move beyond manual work.
                            </p>
                            <p className="mt-8 text-[11px] text-[#101718]/42">
                                (c) {new Date().getFullYear()} ODC IT Solutions. All rights reserved.
                            </p>
                        </div>
                        <div className="flex flex-col gap-4 md:items-end">
                            <a
                                href="https://verify.bir.gov.ph/correspondence/c9241e25c7124474aa284e88c4872cc8"
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Verify our BIR registration"
                                className="block w-full max-w-[400px] transition-transform duration-500 ease-[cubic-bezier(0.19,1,0.22,1)] hover:-translate-y-0.5"
                            >
                                <img
                                    src="/images/bir-registration-badge.png"
                                    alt="BIR Registration Seal Badge 2026, RSN 083RC20260000011855. Scan the QR code or click to verify."
                                    width="2897"
                                    height="880"
                                    loading="lazy"
                                    className="h-auto w-full"
                                />
                                <span className="mt-2 block text-center text-[10px] font-bold uppercase tracking-[0.12em] text-[#101718]/42">
                                    BIR Registered · Tap or scan to verify
                                </span>
                            </a>
                        <div className="flex flex-wrap items-center gap-3 md:justify-end">
                            <a href="/contact" className="inline-flex items-center gap-3 rounded-full bg-[#101718] py-2 pl-5 pr-2 text-xs font-black text-[#edf9f5] transition-transform duration-500 ease-[cubic-bezier(0.19,1,0.22,1)] hover:-translate-y-0.5 active:scale-[0.985]">
                                Talk to Odyssey
                                <span className="grid h-8 w-8 place-items-center rounded-full bg-white/10">
                                    <ArrowRight size={14} weight="bold" />
                                </span>
                            </a>
                        </div>
                        </div>
                    </div>
                </footer>
            </div>
        </MotionConfig>
    );
}
