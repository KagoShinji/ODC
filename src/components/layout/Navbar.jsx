// Link import removed
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';

export function Navbar() {
    const [scrolled, setScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 50);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const navLinks = [
        { name: 'Home', path: '#home' },
        { name: 'About', path: '#about' },
        { name: 'Services', path: '#services' },
        { name: 'Portfolio', path: '#portfolio' },
        { name: 'Contact', path: '#contact' },
    ];

    return (
        <motion.nav
            className={cn(
                'fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b border-transparent',
                scrolled ? 'bg-background/80 backdrop-blur-md border-border py-4' : 'bg-transparent py-6'
            )}
            initial={{ y: -100 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.5 }}
        >
            <div className="container mx-auto px-6 md:px-12 flex items-center justify-between">
                <a href="#home" className="text-3xl font-display font-bold tracking-tighter text-foreground flex items-center">
                    <span>ODC</span>
                </a>

                {/* Desktop Nav */}
                <div className="hidden md:flex items-center gap-8">
                    {navLinks.map((link) => (
                        <a
                            key={link.name}
                            href={link.path}
                            className="text-sm font-medium text-foreground/80 hover:text-primary transition-colors"
                        >
                            {link.name}
                        </a>
                    ))}
                    <a href="#contact">
                        <Button size="sm" variant="primary">Get Started</Button>
                    </a>
                </div>

                {/* Mobile Toggle */}
                <button
                    className="md:hidden text-foreground"
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                >
                    {mobileMenuOpen ? <X /> : <Menu />}
                </button>
            </div>

            {/* Mobile Menu */}
            <AnimatePresence>
                {mobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="md:hidden bg-background border-b border-border"
                    >
                        <div className="flex flex-col p-4 gap-4">
                            {navLinks.map((link) => (
                                <a
                                    key={link.name}
                                    href={link.path}
                                    className="text-foreground hover:text-primary py-2 block"
                                    onClick={() => setMobileMenuOpen(false)}
                                >
                                    {link.name}
                                </a>
                            ))}
                            <a href="#contact" onClick={() => setMobileMenuOpen(false)}>
                                <Button className="w-full">Get Started</Button>
                            </a>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.nav>
    );
}
