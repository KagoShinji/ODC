import { useEffect } from 'react';
import { motion as Motion, useScroll, useSpring } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { ScrollTrigger } from '../../lib/motion';

export function ScrollProgress() {
    const { scrollYProgress } = useScroll();
    const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 30, restDelta: 0.001 });

    return (
        <Motion.div
            aria-hidden="true"
            className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[2px] origin-left bg-gradient-to-r from-[#bcecf2] via-white to-[#edc27f]"
            style={{ scaleX }}
        />
    );
}

// Resets scroll on route change and keeps ScrollTrigger measurements fresh
// as images and fonts settle.
export function ScrollManager() {
    const { pathname, hash } = useLocation();

    useEffect(() => {
        // ScrollTrigger restores the scroll position it recorded on refresh;
        // drop that memory so the previous page's offset doesn't come back.
        ScrollTrigger.clearScrollMemory();
        if (!hash) window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        const id = window.requestAnimationFrame(() => ScrollTrigger.refresh());
        return () => window.cancelAnimationFrame(id);
    }, [pathname, hash]);

    useEffect(() => {
        const refresh = () => ScrollTrigger.refresh();
        window.addEventListener('load', refresh);
        document.fonts?.ready.then(refresh);
        return () => window.removeEventListener('load', refresh);
    }, []);

    return null;
}
