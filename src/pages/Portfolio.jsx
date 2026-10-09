import { PortfolioSection } from '../components/sections/Portfolio';
import { usePageSEO } from '../hooks/usePageSEO';

export function Portfolio() {
    usePageSEO({
        title: 'Selected Systems & Case Studies | OdysseyPH IT Solutions',
        description: 'Explore live client systems, sports reservation platforms, healthcare software, and web applications built by OdysseyPH IT Solutions.',
        canonicalPath: '/portfolio',
    });

    return (
        <div className="pt-10">
            <PortfolioSection />
        </div>
    );
}

export default Portfolio;
