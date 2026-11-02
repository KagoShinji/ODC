import { useEffect } from 'react';

const HREF = 'https://fonts.googleapis.com/css2?family=Poppins:wght@600;700&family=Inter:wght@400;500;600;700&family=Great+Vibes&display=swap';

/** Loads the brand document fonts (Poppins, Inter, Great Vibes signatures) while a component is mounted. */
export function useBrandFonts() {
  useEffect(() => {
    if (document.querySelector(`link[href="${HREF}"]`)) return undefined;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = HREF;
    document.head.appendChild(link);
    return () => link.remove();
  }, []);
}
