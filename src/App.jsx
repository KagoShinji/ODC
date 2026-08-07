import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Layout } from './components/layout/Layout';
import { Home } from './pages/Home';
import { About } from './pages/About';
import { Services } from './pages/Services';
import { Portfolio } from './pages/Portfolio';
import { Contact } from './pages/Contact';
import { NotFound } from './pages/NotFound';
import AdminPage from './pages/Admin';
import ClientPortal from './pages/ClientPortal';
import { SplashScreen } from './components/ui/SplashScreen';
import { Chatbot } from './components/ui/Chatbot';
import Pricing from './pages/Pricing';
import AcceptancePage from './pages/AcceptancePage';
import ClientMOAPage from './pages/ClientMOAPage';
import ClientInvoicePage from './pages/ClientInvoicePage';
import FeedbackForm from './pages/FeedbackForm';

function PublicSite() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence mode="wait">
      {isLoading ? (
        <SplashScreen key="splash" finishLoading={() => setIsLoading(false)} />
      ) : (
        <>
          <Layout key="layout">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/about" element={<About />} />
              <Route path="/services" element={<Services />} />
              <Route path="/portfolio" element={<Portfolio />} />
              <Route path="/contact" element={<Contact />} />
              {/* Catch-all for undefined public routes */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Layout>
          <Chatbot />
        </>
      )}
    </AnimatePresence>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/portal/pricing" element={<Pricing />} />
      <Route path="/portal/*" element={<ClientPortal />} />
      <Route path="/odc/*" element={<AdminPage />} />
      <Route path="/acceptance/:id" element={<AcceptancePage />} />
      <Route path="/moa/:id" element={<ClientMOAPage />} />
      <Route path="/invoice/:id" element={<ClientInvoicePage />} />
      <Route path="/feedback" element={<FeedbackForm />} />
      <Route path="/feedback/:id" element={<FeedbackForm />} />
      {/* All other routes go to the Public Site which handles its own 404s */}
      <Route path="*" element={<PublicSite />} />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AppRoutes />
    </Router>
  );
}

export default App;