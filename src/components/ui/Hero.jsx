import { useRef, useEffect } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion';
import { Button } from './Button';
import { ArrowRight, ChevronDown } from 'lucide-react';

/**
 * Dot Distortion Shader Background
 * Creates a field of dots with organic sine-wave motion and mouse repulsion.
 */
function DotDistortionBackground({ containerRef }) {
    const canvasRef = useRef(null);
    const mouseRef = useRef({ x: -1000, y: -1000 });
    const rafRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !containerRef?.current) return;
        const ctx = canvas.getContext('2d');

        let dots = [];
        const SPACING = 18;
        const BASE_RADIUS = 1.2;
        const MOUSE_RADIUS = 120;

        const resize = () => {
            const dpr = Math.min(window.devicePixelRatio, 2);
            const cssWidth = canvas.offsetWidth;
            const cssHeight = canvas.offsetHeight;
            canvas.width = cssWidth * dpr;
            canvas.height = cssHeight * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            dots = [];
            const cols = Math.ceil(cssWidth / SPACING) + 1;
            const rows = Math.ceil(cssHeight / SPACING) + 1;

            for (let c = 0; c < cols; c++) {
                for (let r = 0; r < rows; r++) {
                    dots.push({
                        baseX: c * SPACING,
                        baseY: r * SPACING,
                        phase: Math.random() * Math.PI * 2,
                        speed: 0.4 + Math.random() * 0.5,
                        isAccent: Math.random() > 0.9,
                    });
                }
            }
        };

const animate = (time) => {
            const w = canvas.offsetWidth;
            const h = canvas.offsetHeight;
            
            // Breathing gradient background
            const breathe = Math.sin(time * 0.0004) * 0.5 + 0.5;
            const bgGradient = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, Math.max(w, h) * 0.7);
            bgGradient.addColorStop(0, `rgba(15, 15, 30, ${0.85 + breathe * 0.1})`);
            bgGradient.addColorStop(0.5, `rgba(8, 8, 20, ${0.9 + breathe * 0.08})`);
            bgGradient.addColorStop(1, 'rgba(5, 5, 15, 1)');
            ctx.fillStyle = bgGradient;
            ctx.fillRect(0, 0, w, h);

            const mx = mouseRef.current.x;
            const my = mouseRef.current.y;

            for (const dot of dots) {
                const t = time * 0.0008;
                
                // Gentle wave animation - anchored to base position
                const waveX = Math.sin(t * dot.speed + dot.phase) * 1.2;
                const waveY = Math.cos(t * dot.speed * 0.7 + dot.phase + 1) * 0.8;

                const dx = dot.baseX - mx;
                const dy = dot.baseY - my;
                const dist = Math.sqrt(dx * dx + dy * dy);
                let mouseOffsetX = 0;
                let mouseOffsetY = 0;
                let mouseFactor = 0;

                // Direct calculation - no lerp, no sticking
                if (dist < MOUSE_RADIUS && dist > 0.1) {
                    mouseFactor = (MOUSE_RADIUS - dist) / MOUSE_RADIUS;
                    const push = mouseFactor * mouseFactor * 25;
                    mouseOffsetX = (dx / dist) * push;
                    mouseOffsetY = (dy / dist) * push;
                }

                const x = dot.baseX + waveX + mouseOffsetX;
                const y = dot.baseY + waveY + mouseOffsetY;

                // Gradient glow effect
                const gradient = ctx.createRadialGradient(x, y, 0, x, y, BASE_RADIUS * 3);
                
                if (mouseFactor > 0.1) {
                    // Bright warm glow on hover
                    const intensity = 0.3 + mouseFactor * 0.5;
                    gradient.addColorStop(0, `rgba(255, 200, 100, ${intensity})`);
                    gradient.addColorStop(0.3, `rgba(255, 150, 50, ${intensity * 0.6})`);
                    gradient.addColorStop(1, 'rgba(255, 100, 50, 0)');
                } else {
                    // Static mode - gentle gradient with wave animation
                    const waveIntensity = 0.15 + Math.sin(t * dot.speed + dot.phase) * 0.05;
                    if (dot.isAccent) {
                        gradient.addColorStop(0, `rgba(255, 200, 120, ${waveIntensity})`);
                        gradient.addColorStop(0.4, `rgba(255, 180, 80, ${waveIntensity * 0.5})`);
                        gradient.addColorStop(1, 'rgba(255, 150, 50, 0)');
                    } else {
                        gradient.addColorStop(0, `rgba(200, 220, 255, ${waveIntensity})`);
                        gradient.addColorStop(0.4, `rgba(150, 180, 255, ${waveIntensity * 0.5})`);
                        gradient.addColorStop(1, 'rgba(100, 150, 255, 0)');
                    }
                }

                ctx.beginPath();
                ctx.arc(x, y, BASE_RADIUS * 3, 0, Math.PI * 2);
                ctx.fillStyle = gradient;
                ctx.fill();
                
                // Core dot
                const coreRadius = BASE_RADIUS * (0.5 + mouseFactor * 0.8);
                ctx.beginPath();
                ctx.arc(x, y, coreRadius, 0, Math.PI * 2);
                ctx.fillStyle = mouseFactor > 0.1 
                    ? `rgba(255, 255, 255, ${0.5 + mouseFactor * 0.5})`
                    : `rgba(255, 255, 255, 0.3)`;
                ctx.fill();
            }

            rafRef.current = requestAnimationFrame(animate);
        };

        const handleMouseMove = (e) => {
            const rect = canvas.getBoundingClientRect();
            mouseRef.current = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
            };
        };

        const handleMouseLeave = () => {
            mouseRef.current = { x: -1000, y: -1000 };
        };

        const container = containerRef.current;
        window.addEventListener('resize', resize);
        container.addEventListener('mousemove', handleMouseMove);
        container.addEventListener('mouseleave', handleMouseLeave);
        resize();
        rafRef.current = requestAnimationFrame(animate);

        return () => {
            window.removeEventListener('resize', resize);
            if (container) {
                container.removeEventListener('mousemove', handleMouseMove);
                container.removeEventListener('mouseleave', handleMouseLeave);
            }
            cancelAnimationFrame(rafRef.current);
        };
    }, [containerRef]);

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
        />
    );
}

export function Hero() {
    const sectionRef = useRef(null);
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.12, delayChildren: 0.2 },
        },
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 24 },
        visible: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
        },
    };

    return (
        <section
            id="home"
            ref={sectionRef}
            className="relative min-h-screen flex items-center justify-center overflow-hidden bg-navy-950"
        >
            {/* Dot distortion shader background */}
            <DotDistortionBackground containerRef={sectionRef} />

            {/* Dark overlay gradient for text readability */}
            <div className="absolute inset-0 bg-linear-to-b from-navy-950/20 via-navy-950/50 to-navy-950/80 pointer-events-none" />

            {/* Vignette effect — darkens edges */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    background: 'radial-gradient(ellipse at 50% 50%, transparent 30%, hsl(222, 50%, 7%, 0.5) 100%)',
                }}
            />

            {/* Content */}
            <div className="container mx-auto px-6 md:px-12 relative z-10 flex flex-col items-center text-center">
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="max-w-3xl"
                >
                    {/* Eyebrow */}
                    <motion.div variants={itemVariants} className="mb-8">
                        <span className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full border border-white/8 bg-white/3 backdrop-blur-md">
                            <span className="relative flex h-1.5 w-1.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
                            </span>
                            <span className="text-[11px] font-medium tracking-[0.15em] uppercase text-white/50">
                                ODC IT Solutions
                            </span>
                        </span>
                    </motion.div>

                    {/* Headline */}
                    <motion.h1
                        variants={itemVariants}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold leading-[1.02] mb-7 tracking-tight text-white cursor-pointer"
                    >
                        Launch Better<br />
                        <span className="bg-clip-text text-transparent bg-linear-to-r from-primary via-orange-400 to-amber-300">
                            Digital Products
                        </span>
                    </motion.h1>

                    {/* Subheadline */}
                    <motion.p
                        variants={itemVariants}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="text-base md:text-lg text-white/40 mb-10 max-w-xl mx-auto leading-relaxed font-normal cursor-pointer"
                    >
                        We help clinics, service businesses, and growth-stage brands streamline operations
                        and launch faster through web, mobile, and cloud solutions.
                    </motion.p>

                    {/* CTAs */}
                    <motion.div variants={itemVariants} className="flex flex-wrap gap-3 justify-center mb-16">
                        <a href="#contact" className="group">
                            <Button
                                size="lg"
                                className="rounded-full px-7 md:px-8 shadow-lg shadow-primary/15 hover:shadow-primary/25 transition-shadow duration-300"
                            >
                                <span className="flex items-center">
                                    Book a Strategy Call
                                    <ArrowRight className="w-4 h-4 ml-2 transition-transform duration-300 group-hover:translate-x-1" />
                                </span>
                            </Button>
                        </a>
                        <a href="#portfolio">
                            <Button
                                size="lg"
                                variant="outline"
                                className="rounded-full px-7 md:px-8 border-white/12 text-white/70 hover:bg-white/4 hover:border-white/30 hover:text-white transition-all duration-300"
                            >
                                View Case Studies
                            </Button>
                        </a>
                    </motion.div>

                    {/* Stats */}
                    <motion.div
                        variants={itemVariants}
                        className="flex gap-10 md:gap-14 justify-center"
                    >
                        {[
                            { value: '50+', label: 'Projects' },
                            { value: '30+', label: 'Clients' },
                            { value: '5+', label: 'Years' },
                        ].map((stat, i) => (
                            <div key={i} className="text-center">
                                <div className="text-xl md:text-2xl font-semibold text-white/80">{stat.value}</div>
                                <div className="text-[11px] text-white/30 mt-1 tracking-[0.15em] uppercase font-medium">{stat.label}</div>
                            </div>
                        ))}
                    </motion.div>
                </motion.div>
            </div>

            {/* Scroll indicator */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.8, duration: 1 }}
                className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 cursor-pointer group"
                onClick={() => {
                    document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' });
                }}
            >
                <span className="text-[10px] tracking-[0.2em] uppercase text-white/20 font-medium group-hover:text-white/40 transition-colors">
                    Scroll
                </span>
                <div style={{ animation: 'scroll-bounce 2.2s ease-in-out infinite' }}>
                    <ChevronDown className="w-4 h-4 text-white/20 group-hover:text-white/40 transition-colors" />
                </div>
            </motion.div>
        </section>
    );
}
