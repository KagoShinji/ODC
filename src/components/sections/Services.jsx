import { motion } from 'framer-motion';
import { Code, Smartphone, Cloud, Database, Palette, ShieldCheck, ArrowRight, Layers } from 'lucide-react';
import { Button } from '../ui/Button';

const services = [
    {
        icon: <Code className="w-8 h-8 text-primary" />,
        title: 'Web Development',
        description: 'Custom, high-performance websites built with modern technologies like React, Next.js, and Tailwind CSS.',
    },
    {
        icon: <Smartphone className="w-8 h-8 text-primary" />,
        title: 'Mobile Apps',
        description: 'Native and cross-platform mobile applications for iOS and Android that deliver seamless user experiences.',
    },
    {
        icon: <Cloud className="w-8 h-8 text-primary" />,
        title: 'Cloud Solutions',
        description: 'Scalable cloud infrastructure design, migration, and management on AWS, Azure, or Google Cloud.',
    },
    {
        icon: <Database className="w-8 h-8 text-primary" />,
        title: 'Backend Systems',
        description: 'Robust API development, database architecture, and microservices to power your business logic.',
    },
    {
        icon: <Palette className="w-8 h-8 text-primary" />,
        title: 'UI/UX Design',
        description: 'User-centric design solutions that combine aesthetics with functionality for higher engagement.',
    },
    {
        icon: <Layers className="w-8 h-8 text-primary" />,
        title: 'System Integration',
        description: 'Connecting your web applications with third-party APIs, payment gateways, and automated internal tools.',
    },
];

export function ServicesSection() {
    return (
        <section id="services" className="pt-24 md:pt-32 pb-20 bg-background relative overflow-hidden">
            <div className="container mx-auto px-6 md:px-12 relative z-10">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="mb-16 md:mb-24"
                >
                    <span className="text-sm font-semibold text-primary uppercase tracking-wider mb-2 block">Our Expertise</span>
                    <h2 className="text-3xl md:text-4xl font-bold mb-6 tracking-tight max-w-xl">Comprehensive IT Solutions Tailored for Growth</h2>
                    <p className="text-muted-foreground max-w-2xl text-lg font-light leading-relaxed">
                        We deliver distinct value through our comprehensive range of services, designed to meet the unique challenges of your business.
                    </p>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
                    {services.map((service, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.1 }}
                            className="group"
                        >
                            <div className="mb-6 p-4 rounded-full bg-secondary/30 w-16 h-16 flex items-center justify-center group-hover:bg-primary/10 transition-colors duration-500">
                                {service.icon}
                            </div>
                            <h3 className="text-xl font-bold mb-3 tracking-tight group-hover:text-primary transition-colors">{service.title}</h3>
                            <p className="text-muted-foreground mb-4 leading-relaxed">{service.description}</p>
                            <div className="flex items-center text-sm font-medium text-foreground group-hover:text-primary transition-colors cursor-pointer gap-2 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 duration-300">
                                Learn more <ArrowRight className="w-4 h-4" />
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
