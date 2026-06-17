import { motion as Motion } from 'framer-motion';
import { ArrowRight } from '@phosphor-icons/react';
import { Navbar } from './Navbar';

export function Layout({ children }) {
    return (
        <div className="flex min-h-screen flex-col">
            <Navbar />
            <Motion.main
                className="grow overflow-x-hidden"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
            >
                {children}
            </Motion.main>
            <footer className="relative overflow-hidden border-t border-white/10 bg-[#e6f0ec] py-12 text-[#101718]">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(13,119,124,0.12),transparent_24rem),radial-gradient(circle_at_86%_100%,rgba(237,194,127,0.16),transparent_22rem)]" />
                <div className="relative mx-auto grid w-[min(1480px,calc(100%-clamp(1rem,5vw,5.5rem)))] items-end gap-8 md:grid-cols-[1fr_auto]">
                    <div>
                        <div className="mb-5 inline-flex items-center gap-2 font-display text-sm font-black tracking-[-0.04em]">
                            <img src="/logos/odcnewlogo.png" alt="ODC Logo" className="h-6 w-auto brightness-0" />
                            OdysseyPH IT Solutions
                        </div>
                        <p className="max-w-xl text-sm leading-relaxed text-[#101718]/58">
                            Business systems, automation, and polished digital products for teams ready to move beyond manual work.
                        </p>
                        <p className="mt-8 text-[11px] text-[#101718]/42">
                            (c) {new Date().getFullYear()} ODC IT Solutions. All rights reserved.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 md:justify-end">
                        <a href="/contact" className="inline-flex items-center gap-3 rounded-full bg-[#101718] py-2 pl-5 pr-2 text-xs font-black text-[#edf9f5] transition-transform duration-500 ease-[cubic-bezier(0.19,1,0.22,1)] hover:-translate-y-0.5 active:scale-[0.985]">
                            Talk to Odyssey
                            <span className="grid h-8 w-8 place-items-center rounded-full bg-white/10">
                                <ArrowRight size={14} weight="bold" />
                            </span>
                        </a>
                    </div>
                </div>
            </footer>
        </div>
    );
}
