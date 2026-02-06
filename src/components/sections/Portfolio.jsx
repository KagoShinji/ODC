import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../ui/Button';

const categories = ['All', 'Web', 'Mobile'];

const projects = [
    {
        id: 1,
        title: 'Modern Clinic System',
        category: 'Web',
        image: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        description: 'Comprehensive patient management, appointment scheduling, and electronic health records.'
    },
    {
        id: 2,
        title: 'Fitness Tracking Platform',
        category: 'Mobile',
        image: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        description: 'Training plans, diet tracking, and progress analytics for gym members.'
    },
    {
        id: 3,
        title: 'Unified Booking Reservation System',
        category: 'Web',
        image: 'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        description: 'Multi-vendor appointment system with calendar sync and automated reminders.'
    },
    {
        id: 4,
        title: 'Hospital Administration',
        category: 'Web',
        image: 'https://images.unsplash.com/photo-1516549655169-df83a0833860?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        description: 'Staff management, inventory control, and billing systems for hospitals.'
    },
    {
        id: 5,
        title: 'Gym Management App',
        category: 'Mobile',
        image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        description: 'Member check-in, class scheduling, and subscription management.'
    },
    {
        id: 6,
        title: 'Event Booking Engine',
        category: 'Web',
        image: 'https://images.unsplash.com/photo-1543269865-cbf427effbad?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        description: 'Ticket sales, seat selection, and real-time availability for events.'
    },
];

export function PortfolioSection() {
    const [activeCategory, setActiveCategory] = useState('All');

    const filteredProjects = projects.filter(
        (project) => activeCategory === 'All' || project.category === activeCategory
    );

    return (
        <section id="portfolio" className="pt-24 md:pt-32 pb-20 bg-background relative overflow-hidden">
            <div className="container mx-auto px-6 md:px-12 relative z-10">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="mb-12 md:mb-20"
                >
                    <span className="text-sm font-semibold text-primary uppercase tracking-wider mb-2 block">Selected Works</span>
                    <h2 className="text-3xl md:text-4xl font-bold mb-6 tracking-tight max-w-xl">Showcase of Digital Excellence</h2>
                    <p className="text-muted-foreground max-w-2xl text-lg font-light leading-relaxed mb-8">
                        A curation of our finest digital products, designed for impact and scalability.
                    </p>

                    <div className="flex flex-wrap gap-2">
                        {categories.map((category) => (
                            <button
                                key={category}
                                onClick={() => setActiveCategory(category)}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-300 ${activeCategory === category
                                    ? 'bg-primary text-primary-foreground'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                                    }`}
                            >
                                {category}
                            </button>
                        ))}
                    </div>
                </motion.div>

                <motion.div
                    layout
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12"
                >
                    <AnimatePresence mode='popLayout'>
                        {filteredProjects.map((project) => (
                            <motion.div
                                layout
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ duration: 0.3 }}
                                key={project.id}
                                className="group cursor-pointer"
                            >
                                <div className="aspect-[4/3] overflow-hidden rounded-xl mb-5 bg-secondary/20">
                                    <img
                                        src={project.image}
                                        alt={project.title}
                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 grayscale group-hover:grayscale-0"
                                    />
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-semibold tracking-wider text-primary uppercase">{project.category}</span>
                                    </div>
                                    <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">{project.title}</h3>
                                    <p className="text-muted-foreground text-sm leading-relaxed line-clamp-2">{project.description}</p>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </motion.div>
            </div>
        </section>
    );
}
