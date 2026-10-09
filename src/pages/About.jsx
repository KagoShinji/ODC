import { AboutSection } from '../components/sections/About';
import { usePageSEO } from '../hooks/usePageSEO';

export function About() {
    usePageSEO({
        title: 'About OdysseyPH | Digital Transformation & Tech Studio Philippines',
        description: 'Learn about OdysseyPH IT Solutions: our mission, engineering philosophy, and experience delivering scalable software across the Philippines.',
        canonicalPath: '/about',
    });

    return (
        <div className="pt-10">
            <AboutSection />
        </div>
    );
}

export default About;
