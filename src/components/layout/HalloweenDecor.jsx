import { useCallback, useEffect, useRef, useState } from 'react';
import './HalloweenDecor.css';

// Seasonal decoration layer. Purely visual: fixed, non-interactive and hidden
// from assistive tech. Remove the <HalloweenDecor /> line in Layout to retire it.

// Cobweb anchored at (0,0): spokes fan across the quarter circle, and each ring
// sags toward the corner between spokes like real silk.
const WEB_SIZE = 220;
const SPOKES = [0, 14, 29, 45, 61, 76, 90].map((deg) => (deg * Math.PI) / 180);
const RINGS = [28, 56, 90, 128, 170, 212];

function polar(r, a) {
    return [r * Math.cos(a), r * Math.sin(a)];
}

const webSpokes = SPOKES.map((a) => {
    const [x, y] = polar(WEB_SIZE * 1.05, a);
    return `M0 0 L${x.toFixed(1)} ${y.toFixed(1)}`;
}).join(' ');

const webRings = RINGS.map((r) =>
    SPOKES.slice(1)
        .map((a, i) => {
            const prev = SPOKES[i];
            const [x1, y1] = polar(r, prev);
            const [x2, y2] = polar(r, a);
            const [cx, cy] = polar(r * 0.8, (prev + a) / 2);
            return `${i === 0 ? `M${x1.toFixed(1)} ${y1.toFixed(1)} ` : ''}Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
        })
        .join(' ')
).join(' ');

function Cobweb({ className }) {
    return (
        <svg className={className} viewBox={`0 0 ${WEB_SIZE} ${WEB_SIZE}`} fill="none">
            <path d={webSpokes} className="hw-web-spoke" />
            <path d={webRings} className="hw-web-ring" />
        </svg>
    );
}

function Spider() {
    return (
        <div className="hw-spider">
            <span className="hw-spider-thread" />
            <svg className="hw-spider-body" viewBox="0 0 40 36">
                <g className="hw-spider-legs" fill="none" strokeLinecap="round">
                    <path d="M15 16 C9 11 6 8 2 9" />
                    <path d="M15 19 C8 17 5 17 1 19" />
                    <path d="M15 22 C9 23 6 26 3 30" />
                    <path d="M16 24 C12 28 10 31 9 35" />
                    <path d="M25 16 C31 11 34 8 38 9" />
                    <path d="M25 19 C32 17 35 17 39 19" />
                    <path d="M25 22 C31 23 34 26 37 30" />
                    <path d="M24 24 C28 28 30 31 31 35" />
                </g>
                <ellipse cx="20" cy="22" rx="7" ry="8" className="hw-spider-abdomen" />
                <circle cx="20" cy="12" r="4.5" className="hw-spider-head" />
                <circle cx="18.3" cy="11.6" r="1.1" className="hw-spider-eye" />
                <circle cx="21.7" cy="11.6" r="1.1" className="hw-spider-eye" />
            </svg>
        </div>
    );
}

function Bat({ style }) {
    return (
        <div className="hw-bat" style={style}>
            <svg viewBox="0 0 64 30" className="hw-bat-svg">
                <path
                    className="hw-bat-wings"
                    d="M32 14 C28 6 18 4 2 8 C8 10 10 14 8 18 C14 15 18 17 20 22 C24 17 28 17 32 20 C36 17 40 17 44 22 C46 17 50 15 56 18 C54 14 56 10 62 8 C46 4 36 6 32 14 Z"
                />
                <path d="M29 15 L28 8 L31 11 L33 11 L36 8 L35 15 Z" className="hw-bat-head" />
            </svg>
        </div>
    );
}

function Pumpkin({ onClick }) {
    return (
        <div className="hw-pumpkin" onClick={onClick}>
            <span className="hw-pumpkin-label">Click me!</span>
            <span className="hw-pumpkin-glow" />
            <svg viewBox="0 0 120 110">
                <path
                    d="M64 30 C62 22 63 15 70 9 C72 11 71 13 69 15 C67 19 67 24 69 30 Z"
                    fill="#4f5d2c"
                />
                <path
                    d="M69 15 C76 9 86 10 90 16"
                    stroke="#5f7234"
                    strokeWidth="2"
                    fill="none"
                    strokeLinecap="round"
                />
                <ellipse cx="28" cy="68" rx="20" ry="32" fill="#b9520f" />
                <ellipse cx="92" cy="68" rx="20" ry="32" fill="#b9520f" />
                <ellipse cx="42" cy="67" rx="25" ry="37" fill="#d5661a" />
                <ellipse cx="78" cy="67" rx="25" ry="37" fill="#d5661a" />
                <ellipse cx="60" cy="66" rx="24" ry="39" fill="#ee8327" />
                <ellipse cx="54" cy="46" rx="6" ry="12" fill="#ffb15c" opacity="0.35" />
                <g className="hw-pumpkin-face">
                    <path d="M37 62 L52 62 L44.5 49 Z" />
                    <path d="M68 62 L83 62 L75.5 49 Z" />
                    <path d="M56.5 71 L63.5 71 L60 64 Z" />
                    <path d="M33 77 Q60 100 87 77 L81 79 L77 85 L72 81 L66 89 L60 83 L54 89 L48 81 L43 85 L39 79 Z" />
                </g>
            </svg>
        </div>
    );
}

// Mini jumpscare: once per session after a short visit, or on demand by
// clicking the pumpkin (which also gets a shriek, since audio needs a gesture).
const SCARE_DELAY_MS = 20000;
const SCARE_DURATION_MS = 1100;
const SCARE_SEEN_KEY = 'odc_hw_scared';

function shriek() {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const now = ctx.currentTime;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.16, now + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
        gain.connect(ctx.destination);
        [0, 7].forEach((detune) => {
            const osc = ctx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(1400 + detune * 20, now);
            osc.frequency.exponentialRampToValueAtTime(320, now + 0.55);
            osc.connect(gain);
            osc.start(now);
            osc.stop(now + 0.62);
        });
        setTimeout(() => ctx.close(), 800);
    } catch {
        // Audio is a bonus; ignore failures
    }
}

function Ghost() {
    return (
        <svg className="hw-ghost" viewBox="0 0 200 220">
            <path
                className="hw-ghost-body"
                d="M100 8 C48 8 18 50 18 104 L18 206 L42 186 L64 210 L86 186 L100 208 L114 186 L136 210 L158 186 L182 206 L182 104 C182 50 152 8 100 8 Z"
            />
            <ellipse cx="70" cy="92" rx="18" ry="24" className="hw-ghost-hole" />
            <ellipse cx="130" cy="92" rx="18" ry="24" className="hw-ghost-hole" />
            <circle cx="70" cy="96" r="4" className="hw-ghost-pupil" />
            <circle cx="130" cy="96" r="4" className="hw-ghost-pupil" />
            <ellipse cx="100" cy="152" rx="22" ry="32" className="hw-ghost-hole" />
        </svg>
    );
}

const bats = [
    { '--hw-top': '18vh', '--hw-size': '42px', '--hw-dur': '22s', '--hw-delay': '2s' },
    { '--hw-top': '30vh', '--hw-size': '30px', '--hw-dur': '26s', '--hw-delay': '5.5s' },
    { '--hw-top': '12vh', '--hw-size': '24px', '--hw-dur': '30s', '--hw-delay': '14s' },
];

export function HalloweenDecor() {
    const [scaring, setScaring] = useState(false);
    const endTimer = useRef(null);

    const scare = useCallback(() => {
        clearTimeout(endTimer.current);
        setScaring(true);
        endTimer.current = setTimeout(() => setScaring(false), SCARE_DURATION_MS);
    }, []);

    useEffect(() => {
        let seen = false;
        try {
            seen = sessionStorage.getItem(SCARE_SEEN_KEY) === '1';
        } catch {
            // Ignore storage error
        }
        const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        if (seen || reduced) return undefined;

        const timer = setTimeout(() => {
            if (document.hidden) return;
            try {
                sessionStorage.setItem(SCARE_SEEN_KEY, '1');
            } catch {
                // Ignore storage error
            }
            scare();
        }, SCARE_DELAY_MS);
        return () => clearTimeout(timer);
    }, [scare]);

    useEffect(() => () => clearTimeout(endTimer.current), []);

    const handlePumpkinClick = () => {
        shriek();
        scare();
    };

    return (
        <div className="hw-layer" aria-hidden="true">
            <Cobweb className="hw-web hw-web-left" />
            <Cobweb className="hw-web hw-web-right" />
            <Spider />
            {bats.map((style, i) => (
                <Bat key={i} style={style} />
            ))}
            <Pumpkin onClick={handlePumpkinClick} />
            {scaring ? (
                <div className="hw-scare">
                    <Ghost />
                </div>
            ) : null}
        </div>
    );
}
