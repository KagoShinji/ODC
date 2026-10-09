import { ServicesSection } from '../components/sections/Services';
import { usePageSEO } from '../hooks/usePageSEO';

export function Services() {
    usePageSEO({
        title: 'Services & Engineering | OdysseyPH IT Solutions - Web, Mobile & Cloud Systems',
        description: 'Explore OdysseyPH services: Custom web & mobile engineering, healthcare/clinic systems, sports booking platforms (ODC-Courts), and cloud automation.',
        canonicalPath: '/services',
    });

    return (
        <div className="pt-10">
            <ServicesSection />
        </div>
    );
}

export default Services;
