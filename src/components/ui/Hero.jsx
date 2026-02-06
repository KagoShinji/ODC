import { motion } from 'framer-motion';
import { Button } from '../ui/Button';
import { ArrowRight, Code, Cpu, Globe } from 'lucide-react';

export function Hero() {
    return (
        <section id="home" className="relative min-h-[80vh] flex items-center pt-28 md:pt-20 overflow-hidden bg-background">
            <div className="container mx-auto px-6 md:px-12 relative z-10 grid lg:grid-cols-2 gap-12 items-center">
                <motion.div
                    initial={{ opacity: 0, x: -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.8 }}
                >
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="inline-flex items-center gap-2 mb-6"
                    >
                        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                        <span className="text-sm font-medium tracking-wide uppercase text-muted-foreground">Innovating the Future</span>
                    </motion.div>

                    <h1 className="text-4xl md:text-5xl lg:text-7xl font-bold leading-tight mb-6 tracking-tight text-foreground">
                        Digital Solutions for <br />
                        <span className="text-primary font-light">Modern Business</span>
                    </h1>

                    <p className="text-xl text-muted-foreground mb-10 max-w-lg leading-relaxed font-light">
                        We craft premium digital experiences, robust software, and scalable IT infrastructure to help your business thrive.
                    </p>

                    <div className="flex flex-wrap gap-4">
                        <a href="#contact">
                            <Button size="lg" className="rounded-md px-8">
                                Start Project <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                        </a>
                        <a href="#portfolio">
                            <Button size="lg" variant="ghost" className="rounded-md px-8 hover:bg-secondary/50">
                                Our Work
                            </Button>
                        </a>
                    </div>
                </motion.div>

                {/* Visual/Abstract Element */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 1 }}
                    className="relative block mt-12 lg:mt-0"
                >
                    <div className="relative w-full aspect-square max-w-lg mx-auto flex items-center justify-center">
                        <motion.img
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ duration: 0.8 }}
                            src="odc.jpg"
                            alt="Data Analysis Dashboard"
                            className="relative z-10 w-full rounded-2xl object-cover aspect-[4/3] grayscale hover:grayscale-0 transition-all duration-700"
                        />
                    </div>
                </motion.div>
            </div>
        </section>
    );
}
