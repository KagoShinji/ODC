import { useEffect } from 'react';

const BASE_URL = 'https://odysseyph.com';
const DEFAULT_IMAGE = 'https://odysseyph.com/images/odc.jpg';

/**
 * Custom hook to dynamically manage document title, canonical URL, and OpenGraph/Twitter meta tags per route.
 * @param {Object} options
 * @param {string} options.title - Document title
 * @param {string} options.description - Meta description
 * @param {string} [options.canonicalPath] - Relative path (e.g. '/services')
 * @param {string} [options.ogImage] - Optional custom share image
 */
export function usePageSEO({ title, description, canonicalPath = '/', ogImage = DEFAULT_IMAGE }) {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    if (title) {
      document.title = title;
    }

    const fullUrl = canonicalPath.startsWith('http')
      ? canonicalPath
      : `${BASE_URL}${canonicalPath.startsWith('/') ? canonicalPath : `/${canonicalPath}`}`;

    const updateOrCreateMeta = (selector, attributeName, attributeValue, content) => {
      let element = document.querySelector(selector);
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attributeName, attributeValue);
        document.head.appendChild(element);
      }
      element.setAttribute('content', content);
    };

    if (description) {
      updateOrCreateMeta('meta[name="description"]', 'name', 'description', description);
      updateOrCreateMeta('meta[property="og:description"]', 'property', 'og:description', description);
      updateOrCreateMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description);
    }

    if (title) {
      updateOrCreateMeta('meta[name="title"]', 'name', 'title', title);
      updateOrCreateMeta('meta[property="og:title"]', 'property', 'og:title', title);
      updateOrCreateMeta('meta[name="twitter:title"]', 'name', 'twitter:title', title);
    }

    updateOrCreateMeta('meta[property="og:url"]', 'property', 'og:url', fullUrl);
    updateOrCreateMeta('meta[name="twitter:url"]', 'name', 'twitter:url', fullUrl);
    updateOrCreateMeta('meta[property="og:image"]', 'property', 'og:image', ogImage);
    updateOrCreateMeta('meta[name="twitter:image"]', 'name', 'twitter:image', ogImage);

    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', fullUrl);
  }, [title, description, canonicalPath, ogImage]);
}

export default usePageSEO;
