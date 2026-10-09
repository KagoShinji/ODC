import { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Layout } from './components/layout/Layout';
import { Home } from './pages/Home';
import { About } from './pages/About';
import { Services } from './pages/Services';
import { Portfolio } from './pages/Portfolio';
import { Contact } from './pages/Contact';
import { NotFound } from './pages/NotFound';
import { SplashScreen } from './components/ui/SplashScreen';
import { Chatbot } from './components/ui/Chatbot';
import { SystemModalProvider } from './components/ui/SystemModal';
const AdminPage = lazy(() => import('./pages/Admin'));
const ClientPortal = lazy(() => import('./pages/ClientPortal'));
const Pricing = lazy(() => import('./pages/Pricing'));
const AcceptancePage = lazy(() => import('./pages/AcceptancePage'));
const ClientMOAPage = lazy(() => import('./pages/ClientMOAPage'));
const ClientInvoicePage = lazy(() => import('./pages/ClientInvoicePage'));
const FeedbackForm = lazy(() => import('./pages/FeedbackForm'));

function shouldSkipSplash() {
  if (typeof window === 'undefined') return true;
  try {
    const ua = (navigator.userAgent || '').toLowerCase();
    const isBot = /bot|googlebot|crawler|spider|robot|crawling|gptbot|chatgpt|perplexity|claudebot|slurp|duckduckbot|facebookexternalhit|bingbot|applebot/i.test(ua);
    if (isBot) return true;
    if (sessionStorage.getItem('odc_splash_seen') === '1') return true;
  } catch {
    // Ignore storage/UA errors
  }
  return false;
}

function PublicSite() {
  const [isLoading, setIsLoading] = useState(() => !shouldSkipSplash());

  useEffect(() => {
    if (!isLoading) {
      try {
        sessionStorage.setItem('odc_splash_seen', '1');
      } catch {
        // Ignore storage error
      }
      return;
    }
    const timer = setTimeout(() => {
      setIsLoading(false);
      try {
        sessionStorage.setItem('odc_splash_seen', '1');
      } catch {
        // Ignore storage error
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [isLoading]);

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
    <SystemModalProvider>
      <Router>
        <Suspense fallback={<div role="status" style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}>Loading page…</div>}>
          <AppRoutes />
        </Suspense>
      </Router>
    </SystemModalProvider>
  );
}

export default App;
