import { useState, useEffect } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Layout } from './components/layout/Layout';
import { Hero } from './components/ui/Hero';
import { AboutSection } from './components/sections/About';
import { ServicesSection } from './components/sections/Services';
import { PortfolioSection } from './components/sections/Portfolio';
import { ContactSection } from './components/sections/Contact';
import { SplashScreen } from './components/ui/SplashScreen';

function App() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate loading time
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Router>
      <AnimatePresence mode="wait">
        {isLoading ? (
          <SplashScreen key="splash" finishLoading={() => setIsLoading(false)} />
        ) : (
          <Layout key="layout">
            <Hero />
            <AboutSection />
            <ServicesSection />
            <PortfolioSection />
            <ContactSection />
          </Layout>
        )}
      </AnimatePresence>
    </Router>
  );
}

export default App;