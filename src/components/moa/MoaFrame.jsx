import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { buildMoaHtml } from '../../utils/moaDocument';
import './MoaFrame.css';

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
 * Renders the branded MOA agreement inside an isolated iframe and exposes print() and savePng().
 */
const MoaFrame = forwardRef(function MoaFrame({ moa, signatures, title = 'Memorandum of Agreement', scale = 1 }, ref) {
  const frame = useRef(null);
  const [height, setHeight] = useState(1100);
  const html = useMemo(() => buildMoaHtml(moa, signatures), [moa, signatures]);

  const measure = () => {
    const body = frame.current?.contentDocument?.body;
    if (body) setHeight(body.scrollHeight + 8);
  };

  useImperativeHandle(ref, () => ({
    print() {
      const win = frame.current?.contentWindow;
      if (!win) return;
      win.focus();
      win.print();
    },
    async savePng(filename) {
      const docEl = frame.current?.contentDocument;
      if (!docEl) throw new Error('The document is still loading.');
      await docEl.fonts?.ready;
      const node = docEl.body;
      const fontEmbedCSS = await iframeFontCss(docEl).catch(() => undefined);
      const url = await toPng(node, { pixelRatio: 2, backgroundColor: '#ffffff', width: node.scrollWidth, height: node.scrollHeight, cacheBust: true, fontEmbedCSS });
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
    },
  }), []);

  return (
    <div className="moa-frame" style={{ height: height * scale }}>
      <iframe
        ref={frame}
        title={title}
        srcDoc={html}
        onLoad={() => { measure(); frame.current?.contentDocument?.fonts?.ready.then(measure); }}
        style={{ height, width: 816, transform: scale === 1 ? undefined : `scale(${scale})`, transformOrigin: 'top left' }}
      />
    </div>
  );
});

export default MoaFrame;
