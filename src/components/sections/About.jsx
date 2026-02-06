import { motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';

export function AboutSection() {
    return (
        <section id="about" className="pt-24 md:pt-32 pb-20 bg-background relative overflow-hidden">
            <div className="container mx-auto px-6 md:px-12 relative z-10">
                <div className="grid lg:grid-cols-2 gap-12 items-center">
                    <motion.div
                        initial={{ opacity: 0, x: -50 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        className="relative"
                    >
                        <div className="relative z-10 rounded-2xl overflow-hidden bg-secondary/20">
                            <img
                                src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
                                alt="Team working together"
                                className="w-full h-auto grayscale hover:grayscale-0 transition-all duration-700"
                            />
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, x: 50 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                    >
                        <h2 className="text-3xl md:text-4xl font-bold mb-6 tracking-tight">Driven by Innovation, <br /><span className="text-primary">Powered by Technology</span></h2>
                        <p className="text-muted-foreground mb-8 text-lg leading-relaxed">
                            At ODC, we are more than just an IT solutions provider; we are your strategic partner in digital transformation. Our mission is to empower businesses with cutting-edge technology that drives growth and efficiency.
                        </p>

                        <div className="space-y-4">
                            {['Expert Team of Developers & Designers', 'Agile Development Methodology', '24/7 Support & Maintenance', 'Scalable & Secure Solutions'].map((item, index) => (
                                <div key={index} className="flex items-center gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                                    <span className="font-medium">{item}</span>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}
