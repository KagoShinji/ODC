import { forwardRef, useImperativeHandle, useRef, useState, useEffect } from 'react';
import { toPng } from 'html-to-image';

const toDataUrl = blob => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(blob);
});

async function iframeFontCss(docEl) {
  const links = [...docEl.querySelectorAll('link[rel="stylesheet"][href^="https://fonts.googleapis.com"]')];
  const sheets = await Promise.all(links.map(link => fetch(link.href).then(r => r.text())));
  const blocks = sheets.join('\n').split(/(?=\/\*\s*[\w-]+\s*\*\/\s*@font-face)/).filter(b => /^\/\*\s*latin(-ext)?\s*\*\//.test(b));
  return (await Promise.all(blocks.map(async block => {
    const src = block.match(/url\((https:[^)]+)\)/)?.[1];
    if (!src) return '';
    const data = await fetch(src).then(r => r.blob()).then(toDataUrl);
    return block.replace(src, data);
  }))).join('\n');
}

/**
 * Renders any branded document HTML inside an isolated iframe, auto-sizes its height,
 * and exposes imperative print() and savePng().
 */
const BrandedDocumentFrame = forwardRef(function BrandedDocumentFrame({ html, title = 'Document', scale = 1, className = 'docp-frame' }, ref) {
  const frame = useRef(null);
  const [height, setHeight] = useState(1100);

  const measure = () => {
    const body = frame.current?.contentDocument?.body;
    if (body) {
      setHeight(body.scrollHeight + 12);
    }
  };

  useEffect(() => {
    measure();
  }, [html]);

  useImperativeHandle(ref, () => ({
    print() {
      const win = frame.current?.contentWindow;
      if (!win) return;
      win.focus();
      win.print();
    },
    async savePng(filename = 'document.png') {
      const docEl = frame.current?.contentDocument;
      if (!docEl) throw new Error('The document is still loading.');
      await docEl.fonts?.ready;
      const node = docEl.body;
      const fontEmbedCSS = await iframeFontCss(docEl).catch(() => undefined);
      const url = await toPng(node, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        fontEmbedCSS,
        filter: el => !el.classList?.contains('stamp'),
      });
      const a = document.createElement('a');
      a.download = filename;
      a.href = url;
      a.click();
    },
  }));

  const scaledStyle = scale !== 1 ? {
    transform: `scale(${scale})`,
    transformOrigin: 'top left',
    width: `${100 / scale}%`,
  } : {
    width: '100%',
  };

  return (
    <div className={className} style={{ minHeight: height * scale }}>
      <iframe
        ref={frame}
        title={title}
        srcDoc={html}
        onLoad={measure}
        style={{ ...scaledStyle, height, minHeight: height }}
      />
    </div>
  );
});

export default BrandedDocumentFrame;
