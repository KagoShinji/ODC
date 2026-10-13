import { useEffect, useLayoutEffect, useRef } from 'react';
import { animate, useInView, useReducedMotion } from 'framer-motion';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger, useGSAP);

export { gsap, ScrollTrigger, useGSAP };

// Shared motion tokens. Framer handles reveals and micro-interactions;
// GSAP ScrollTrigger handles scroll-scrubbed and pinned sequences only.
export const ease = {
    out: [0.23, 1, 0.32, 1],
    inOut: [0.77, 0, 0.175, 1],
};

export const duration = {
    fast: 0.3,
    reveal: 0.7,
    hero: 0.85,
};

export const stagger = {
    tight: 0.06,
    base: 0.08,
};

// GSAP media query contexts. Scroll-linked motion only runs when the user
// hasn't asked for reduced motion; pinning and heavy parallax are desktop only.
export const mq = {
    motionOk: '(prefers-reduced-motion: no-preference)',
    desktop: '(prefers-reduced-motion: no-preference) and (min-width: 1024px)',
    tabletUp: '(prefers-reduced-motion: no-preference) and (min-width: 768px)',
    mobile: '(prefers-reduced-motion: no-preference) and (max-width: 767px)',
};

export const fadeUp = {
    hidden: { opacity: 0, y: 28, filter: 'blur(6px)' },
    show: { opacity: 1, y: 0, filter: 'blur(0px)' },
};

export const fadeUpSoft = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
};

// Heading reveal: content wipes in from the top while rising slightly.
export const maskUp = {
    hidden: { opacity: 0, y: 20, clipPath: 'inset(0% 0% 100% 0%)' },
    show: { opacity: 1, y: 0, clipPath: 'inset(0% 0% 0% 0%)' },
};

export const staggerContainer = (gap = stagger.base, delay = 0) => ({
    hidden: {},
    show: { transition: { staggerChildren: gap, delayChildren: delay } },
});

/**
 * Spread onto a motion element for a one-shot scroll reveal.
 * @param {object} options
 * @param {number} [options.delay]
 * @param {object} [options.variants]
 * @param {string} [options.margin] viewport rootMargin
 */
export function reveal({ delay = 0, variants = fadeUp, margin = '-80px', dur = duration.reveal } = {}) {
    return {
        initial: 'hidden',
        whileInView: 'show',
        viewport: { once: true, margin },
        transition: { duration: dur, delay, ease: ease.out },
        variants,
    };
}

/** Variant-driven child of a staggerContainer. */
export const revealChild = (variants = fadeUp, dur = duration.reveal) => ({
    variants,
    transition: { duration: dur, ease: ease.out },
});

export function useReducedMotionSafe() {
    return useReducedMotion() ?? false;
}

/**
 * Count a number up once when the element is 50% visible.
 * The element renders `format(target)` itself, so content is never missing;
 * the hook only rewinds it to zero if it's still below the fold, then
 * writes frames straight to the DOM to avoid re-rendering React per tick.
 */
export function useCountUp(target, format, { durationMs = 1400 } = {}) {
    const ref = useRef(null);
    const reduced = useReducedMotionSafe();
    const inView = useInView(ref, { once: true, amount: 0.5 });
    const armed = useRef(false);
    const formatRef = useRef(format);

    useLayoutEffect(() => {
        formatRef.current = format;
    });

    useLayoutEffect(() => {
        const el = ref.current;
        if (reduced || !el) return;
        if (el.getBoundingClientRect().top > window.innerHeight) {
            armed.current = true;
            el.textContent = formatRef.current(0);
        }
    }, [reduced]);

    useEffect(() => {
        if (!inView || !armed.current) return;
        const controls = animate(0, target, {
            duration: durationMs / 1000,
            ease: ease.out,
            onUpdate: (latest) => {
                if (ref.current) ref.current.textContent = formatRef.current(latest);
            },
        });
        return () => controls.stop();
    }, [inView, target, durationMs]);

    return ref;
}
