import { ContactSection } from '../components/sections/Contact';
import { usePageSEO } from '../hooks/usePageSEO';

export function Contact() {
    usePageSEO({
        title: 'Start a Project | OdysseyPH IT Solutions - Cebu, Philippines',
        description: 'Connect with OdysseyPH IT Solutions. Share your workflow challenges, product vision, or system requirements for a consultation within 24 hours.',
        canonicalPath: '/contact',
    });

    return (
        <div className="reference-landing premium-landing pt-10">
            <ContactSection />
        </div>
    );
}

export default Contact;
