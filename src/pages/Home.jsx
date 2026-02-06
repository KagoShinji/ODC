import { Hero } from '../components/ui/Hero';
import { ServicesSection } from '../components/sections/Services';
import { PortfolioSection } from '../components/sections/Portfolio';
import { ContactSection } from '../components/sections/Contact';

export function Home() {
    return (
        <>
            <Hero />
            <ServicesSection />
            <PortfolioSection />
            <ContactSection />
        </>
    );
}
