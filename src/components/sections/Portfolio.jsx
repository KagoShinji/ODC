import { useState, useEffect } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { Button } from '../ui/Button';
import { X } from 'lucide-react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

const categories = ['All', 'Systems', 'Portfolio', 'UI/UX'];

const projects = [
    {
        id: 1,
        title: 'Odyssey Family Clinic',
        category: 'Systems',
        image: '/odysseyfamilyclinic.jpg',
        description: 'Integrated clinic management system for patient records, appointments, and clinic operations.',
        impact: 'Clinic workflow system'
    },
    {
        id: 2,
        title: 'MediQuick',
        category: 'UI/UX',
        image: '/MediQuick.png',
        description: 'Web app UI/UX design for medicine e-commerce and inventory management.',
        impact: 'Medicine commerce UI'
    },
    {
        id: 3,
        title: 'IMS-US',
        category: 'Portfolio',
        image: '/imsus.png',
        description: 'Professional portfolio website for International Marketing Services.',
        impact: 'Professional web presence'
    },
    {
        id: 4,
        title: 'Ngosiok Marketing',
        category: 'Portfolio',
        image: '/ngosiokmarketing.jpg',
        description: 'Corporate portfolio website for Ngosiok Marketing.',
        impact: 'Corporate portfolio'
    },
    {
        id: 5,
        title: 'Firsel Tattoo',
        category: 'Portfolio',
        image: '/firseltattoo.png',
        description: 'Specialized tattoo artist portfolio website designed to showcase work and booking intent.',
        impact: 'Artist portfolio'
    },
    {
        id: 6,
        title: 'The Pickle Point Cebu',
        category: 'Systems',
        image: '/thepicklepointcebu.jpg',
        description: 'Pickleball court booking system for reservations, scheduling, and court operations.',
        impact: 'Court booking system'
    },
    {
        id: 7,
        title: 'GRIT',
        category: 'Systems',
        image: '/grit.jpg',
        description: 'Comprehensive gym management system for operations, member workflows, and admin oversight.',
        impact: 'Gym management system'
    },
    {
        id: 8,
        title: 'Jump Serve Sports Center Mandaue',
        category: 'Systems',
        image: '/jumpserve.png',
        description: 'A high-energy sports center website built for court discovery, schedule browsing, and fast reservation intent for volleyball and multi-sport facilities.',
        impact: 'Sports facility website'
    },
    {
        id: 9,
        title: 'KennyDink Moalboal Cebu',
        category: 'Systems',
        image: '/kennydink.png',
        description: 'A resort-integrated pickleball court booking platform for Moalboal — blending leisure discovery, court reservations, and guest experience into one polished site.',
        impact: 'Resort & court booking'
    },
    {
        id: 10,
        title: 'SupportTeach',
        category: 'Systems',
        image: '/images/supportteach.png',
        description: 'An educational platform built for structured learning delivery, student progress tracking, and teacher-driven course management with clean workflow-first UI.',
        impact: 'LMS & progress tracker'
    },
];

export function PortfolioSection() {
    const [activeCategory, setActiveCategory] = useState('All');
    const [selectedProject, setSelectedProject] = useState(null);
    const location = useLocation();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const isPortfolioPage = location.pathname === '/portfolio';
    const projectParam = isPortfolioPage ? Number(searchParams.get('project')) : 0;
    const queryProject = projectParam ? projects.find((project) => project.id === projectParam) : null;
    const currentProject = selectedProject || queryProject;
    const displayedCategory = queryProject ? queryProject.category : activeCategory;

    useEffect(() => {
        if (currentProject) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [currentProject]);

    const filteredProjects = projects.filter(
        (project) => displayedCategory === 'All' || project.category === displayedCategory
    );

    const openProject = (project) => {
        if (!isPortfolioPage) {
            navigate(`/portfolio?project=${project.id}`);
            return;
        }

        setSelectedProject(project);
        setSearchParams({ project: String(project.id) });
    };

    const closeProject = () => {
        setSelectedProject(null);
        if (isPortfolioPage) {
            setSearchParams({});
        }
    };

    return (
        <section id="portfolio" className="ambient-light-section ambient-portfolio pt-24 md:pt-32 pb-20 relative overflow-hidden">
            <div className="section-ambient-orb section-ambient-orb-left" />
            <div className="container mx-auto px-6 md:px-12 relative z-10">
                <Motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="mb-12 md:mb-20 text-center"
                >
                    <span className="text-xs font-semibold text-primary uppercase tracking-widest mb-3 block">Selected Works</span>
                    <h2 className="text-3xl md:text-5xl font-bold mb-5 tracking-tight">Showcase of <span className="text-primary">Digital Excellence</span></h2>
                    <p className="text-muted-foreground max-w-xl mx-auto text-lg leading-relaxed mb-10">
                        Real ODC projects across business systems, portfolio websites, UI/UX design, and workflow automation.
                    </p>

                    <div className="flex flex-wrap gap-2 justify-center">
                        {categories.map((category) => (
                            <button
                                key={category}
                                onClick={() => setActiveCategory(category)}
                                className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-300 ${
                                    displayedCategory === category
                                        ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                                        : 'text-muted-foreground hover:text-foreground border border-border hover:border-primary/30 bg-white'
                                    }`}
                            >
                                {category}
                            </button>
                        ))}
                    </div>
                </Motion.div>

                <Motion.div
                    layout
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                >
                    <AnimatePresence mode='popLayout'>
                        {filteredProjects.map((project) => (
                            <Motion.div
                                layout
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ duration: 0.3 }}
                                key={project.id}
                                className="group cursor-pointer bg-white rounded-2xl border border-border/60 shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-300 overflow-hidden"
                                onClick={() => openProject(project)}
                                whileHover={{ y: -4 }}
                            >
                                <div className="aspect-4/3 overflow-hidden">
                                    <img
                                        src={project.image}
                                        alt={project.title}
                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                    />
                                </div>
                                <div className="p-5">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-semibold tracking-widest text-primary uppercase">{project.category}</span>
                                        <span className="text-[11px] rounded-full bg-primary/10 text-primary px-2.5 py-1 font-semibold">{project.impact}</span>
                                    </div>
                                    <h3 className="text-lg font-bold mb-2 group-hover:text-primary transition-colors">{project.title}</h3>
                                    <p className="text-muted-foreground text-sm leading-relaxed line-clamp-2 mb-3">{project.description}</p>
                                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary group-hover:gap-3 transition-all">
                                        View Details
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                        </svg>
                                    </span>
                                </div>
                            </Motion.div>
                        ))}
                    </AnimatePresence>
                </Motion.div>

                {!isPortfolioPage && (
                    <Motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="mt-12 border-t border-border/60 pt-8"
                    >
                        <div className="text-center mb-8 rounded-2xl border border-primary/20 bg-primary/5 p-6">
                            <h3 className="text-xl md:text-2xl font-bold tracking-tight mb-2">Want results like these for your business?</h3>
                            <p className="text-muted-foreground mb-4">Tell us the manual workflow you want to automate and we will map a practical system roadmap.</p>
                            <a href="#contact">
                                <Button className="rounded-full px-7">Book a Strategy Call</Button>
                            </a>
                        </div>
                        <div className="text-center mb-5">
                            <p className="text-sm text-muted-foreground">Select a project below to open full details on the Portfolio page</p>
                        </div>
                        <div className="flex flex-wrap justify-center gap-2">
                            {projects.map((project) => (
                                <button
                                    key={project.id}
                                    onClick={() => openProject(project)}
                                    className="px-4 py-2 rounded-full text-xs md:text-sm font-semibold border border-border bg-white text-foreground/85 hover:border-primary/40 hover:text-primary transition-colors"
                                >
                                    {project.title}
                                </button>
                            ))}
                        </div>
                    </Motion.div>
                )}
            </div>

            {/* Project Modal */}
            <AnimatePresence>
                {currentProject && (
                    <div className="fixed inset-0 z-100 flex items-center justify-center p-4 sm:p-6 text-left">
                        <Motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-background/80 backdrop-blur-sm"
                            onClick={closeProject}
                        />
                        <Motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-background rounded-2xl shadow-2xl border border-border/50 z-10 flex flex-col md:flex-row"
                        >
                            <button
                                onClick={closeProject}
                                className="absolute top-4 right-4 p-2 bg-background/50 hover:bg-background rounded-full backdrop-blur-md transition-colors z-20 text-foreground"
                            >
                                <X className="w-5 h-5" />
                            </button>

                            <div className="w-full md:w-1/2 h-64 md:h-auto min-h-75 relative bg-secondary/10 flex items-center justify-center p-4">
                                <img
                                    src={currentProject.image}
                                    alt={currentProject.title}
                                    className="w-full h-full object-contain rounded-lg"
                                />
                            </div>
                            <div className="w-full md:w-1/2 p-8 md:p-12 flex flex-col justify-center">
                                <span className="text-sm font-semibold tracking-wider text-primary uppercase mb-2 block">
                                    {currentProject.category}
                                </span>
                                <h3 className="text-3xl md:text-4xl font-bold mb-4">
                                    {currentProject.title}
                                </h3>
                                <p className="text-muted-foreground text-lg leading-relaxed mb-8">
                                    {currentProject.description}
                                </p>

                                <div className="flex gap-4 mt-auto pt-8 border-t border-border/50">
                                    <Button onClick={closeProject} className="w-full">
                                        Close
                                    </Button>
                                </div>
                            </div>
                        </Motion.div>
                    </div>
                )}
            </AnimatePresence>
        </section>
    );
}

