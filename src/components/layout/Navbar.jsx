import { useState, useEffect } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '../../utils/cn';

export function Navbar() {
    const [scrolled, setScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 50);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        if (!location.hash) return;

        const sectionId = location.hash.slice(1);
        let attemptCount = 0;

        const scrollWhenReady = () => {
            const element = document.getElementById(sectionId);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth' });
                return;
            }

            if (attemptCount < 10) {
                attemptCount += 1;
                window.requestAnimationFrame(scrollWhenReady);
            }
        };

        scrollWhenReady();
    }, [location.hash, location.pathname]);

    const scrollToSection = (sectionId) => {
        const element = document.getElementById(sectionId);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
            setMobileMenuOpen(false);
            return;
        }

        setMobileMenuOpen(false);
        navigate({ pathname: '/', hash: `#${sectionId}` });
    };

    const navLinks = [
        { name: 'Home', sectionId: 'home' },
        { name: 'Systems', sectionId: 'portfolio' },
        { name: 'Partnership', sectionId: 'clients' },
    ];

    return (
        <Motion.div
            className="fixed top-0 left-0 right-0 z-50 px-4 pt-4"
            initial={{ y: -100 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.5 }}
        >
            <nav
                className={cn(
                    'mx-auto max-w-5xl rounded-full border px-5 py-2.5 transition-all duration-300 backdrop-blur-xl',
                    scrolled
                        ? 'border-white/12 bg-[#101718]/82 shadow-2xl shadow-black/20'
                        : 'border-white/10 bg-[#101718]/38'
                )}
            >
                <div className="flex items-center justify-between">
                    <button
                        type="button"
                        onClick={() => scrollToSection('home')}
                        className="inline-flex items-center gap-2 text-sm font-display font-black tracking-[-0.04em] text-white transition-colors hover:opacity-80"
                    >
                        <img src="/images/odc.jpg" alt="ODC Logo" className="h-6 w-6 rounded-full object-cover" />
                        Odyssey
                    </button>

                    {/* Desktop Nav */}
                    <div className="hidden md:flex items-center gap-6">
                        {navLinks.map((link) => (
                            <button
                                type="button"
                                key={link.name}
                                onClick={() => scrollToSection(link.sectionId)}
                                className="text-xs font-semibold text-white/58 transition-colors hover:text-white cursor-pointer bg-none border-none"
                            >
                                {link.name}
                            </button>
                        ))}
                    </div>

                    <div className="hidden md:flex">
                        <a
                            href="/contact"
                            className="rounded-full bg-white px-4 py-2 text-xs font-black text-[#101718] transition-transform duration-300 hover:-translate-y-0.5"
                        >
                            Book a call
                        </a>
                    </div>

                    {/* Mobile Toggle */}
                    <button
                        className="p-1 text-white transition-colors md:hidden"
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
                        aria-expanded={mobileMenuOpen}
                    >
                        {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </button>
                </div>
            </nav>

            {/* Mobile Menu */}
            <AnimatePresence>
                {mobileMenuOpen && (
                    <Motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mx-auto mt-2 max-w-5xl overflow-hidden rounded-2xl border border-white/10 bg-[#101718]/95 shadow-lg backdrop-blur-xl"
                    >
                        <div className="flex flex-col p-4 gap-1">
                            {navLinks.map((link) => (
                                <button
                                    type="button"
                                    key={link.name}
                                    onClick={() => scrollToSection(link.sectionId)}
                                    className="block rounded-xl px-4 py-2.5 font-medium text-white/72 transition-colors hover:bg-white/6 hover:text-white text-left w-full bg-none border-none"
                                >
                                    {link.name}
                                </button>
                            ))}
                            <a
                                href="/contact"
                                onClick={() => setMobileMenuOpen(false)}
                                className="mt-2 rounded-full bg-white px-4 py-2.5 text-center text-sm font-black text-[#101718]"
                            >
                                Book a call
                            </a>
                        </div>
                    </Motion.div>
                )}
            </AnimatePresence>
        </Motion.div>
    );
}
