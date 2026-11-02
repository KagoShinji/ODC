import { useEffect, useRef, useState } from 'react';
import { useEditor, useEditorState, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TableKit } from '@tiptap/extension-table';
import TextAlign from '@tiptap/extension-text-align';
import { Placeholder } from '@tiptap/extensions';
import {
  Undo2, Redo2, Bold, Italic, Underline, Strikethrough, List, ListOrdered, Quote, AlignLeft, AlignCenter, AlignRight, AlignJustify, Eraser, Wand2, ClipboardCopy,
} from 'lucide-react';
import { BRAND_CO } from '../../utils/brandDocument';
import { AI_PROMPT, SIGNER_KINDS, parseOfficeOrderText, markdownToHtml, looksLikeDraftedOrder } from '../../utils/officeOrderDocument';
import { useBrandFonts } from '../../hooks/useBrandFonts';
import './OfficeOrderEditor.css';

const BLOCKS = [
  { id: 'p', label: 'Normal text' },
  { id: 'h2', label: 'Section heading' },
  { id: 'h3', label: 'Sub-heading' },
  { id: 'h1', label: 'Annex page title' },
];
const TABLE_ACTIONS = [
  ['insert', 'Insert table'], ['addRowAfter', 'Add row below'], ['addColumnAfter', 'Add column right'],
  ['deleteRow', 'Delete row'], ['deleteColumn', 'Delete column'], ['toggleHeaderRow', 'Toggle header row'], ['deleteTable', 'Delete table'],
];

function ToolButton({ label, active, disabled, onClick, children }) {
  return (
    <button type="button" className="oe-tool" aria-label={label} title={label} aria-pressed={active === undefined ? undefined : active} disabled={disabled}
      onMouseDown={e => e.preventDefault()} onClick={onClick}>
      {children}
    </button>
  );
}

function Toolbar({ editor, onAiPaste }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      block: e.isActive('heading', { level: 1 }) ? 'h1' : e.isActive('heading', { level: 2 }) ? 'h2' : e.isActive('heading', { level: 3 }) ? 'h3' : 'p',
      bold: e.isActive('bold'), italic: e.isActive('italic'), underline: e.isActive('underline'), strike: e.isActive('strike'),
      bullet: e.isActive('bulletList'), ordered: e.isActive('orderedList'), quote: e.isActive('blockquote'),
      align: ['center', 'right', 'justify'].find(a => e.isActive({ textAlign: a })) || 'left',
      inTable: e.isActive('table'), canUndo: e.can().undo(), canRedo: e.can().redo(),
    }),
  });
  const chain = () => editor.chain().focus();
  const setBlock = id => {
    if (id === 'p') chain().setParagraph().run();
    else chain().setHeading({ level: Number(id[1]) }).run();
  };
  const tableAction = id => {
    if (id === 'insert') chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    else chain()[id]().run();
  };

  return (
    <div className="oe-toolbar" role="toolbar" aria-label="Formatting">
      <ToolButton label="Undo" disabled={!state.canUndo} onClick={() => chain().undo().run()}><Undo2 size={16} /></ToolButton>
      <ToolButton label="Redo" disabled={!state.canRedo} onClick={() => chain().redo().run()}><Redo2 size={16} /></ToolButton>
      <span className="oe-sep" />
      <select aria-label="Text style" value={state.block} onChange={e => setBlock(e.target.value)}>
        {BLOCKS.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
      </select>
      <span className="oe-sep" />
      <ToolButton label="Bold" active={state.bold} onClick={() => chain().toggleBold().run()}><Bold size={16} /></ToolButton>
      <ToolButton label="Italic" active={state.italic} onClick={() => chain().toggleItalic().run()}><Italic size={16} /></ToolButton>
      <ToolButton label="Underline" active={state.underline} onClick={() => chain().toggleUnderline().run()}><Underline size={16} /></ToolButton>
      <ToolButton label="Strikethrough" active={state.strike} onClick={() => chain().toggleStrike().run()}><Strikethrough size={16} /></ToolButton>
      <span className="oe-sep" />
      <ToolButton label="Bulleted list" active={state.bullet} onClick={() => chain().toggleBulletList().run()}><List size={16} /></ToolButton>
      <ToolButton label="Numbered list" active={state.ordered} onClick={() => chain().toggleOrderedList().run()}><ListOrdered size={16} /></ToolButton>
      <ToolButton label="Highlighted note" active={state.quote} onClick={() => chain().toggleBlockquote().run()}><Quote size={16} /></ToolButton>
      <span className="oe-sep" />
      <ToolButton label="Align left" active={state.align === 'left'} onClick={() => chain().setTextAlign('left').run()}><AlignLeft size={16} /></ToolButton>
      <ToolButton label="Align center" active={state.align === 'center'} onClick={() => chain().setTextAlign('center').run()}><AlignCenter size={16} /></ToolButton>
      <ToolButton label="Align right" active={state.align === 'right'} onClick={() => chain().setTextAlign('right').run()}><AlignRight size={16} /></ToolButton>
      <ToolButton label="Justify" active={state.align === 'justify'} onClick={() => chain().setTextAlign('justify').run()}><AlignJustify size={16} /></ToolButton>
      <span className="oe-sep" />
      <select aria-label="Table" value="" onChange={e => { if (e.target.value) tableAction(e.target.value); }}>
        <option value="">Table…</option>
        {TABLE_ACTIONS.map(([id, label]) => <option key={id} value={id} disabled={id !== 'insert' && !state.inTable}>{label}</option>)}
      </select>
      <ToolButton label="Clear formatting" onClick={() => chain().unsetAllMarks().clearNodes().run()}><Eraser size={16} /></ToolButton>
      <span className="oe-grow" />
      <button type="button" className="oe-ai" onMouseDown={e => e.preventDefault()} onClick={onAiPaste}><Wand2 size={15} /> Paste from AI</button>
    </div>
  );
}

function MemoLine({ label, children }) {
  return <div className="oe-memo-row"><span>{label}</span><div>{children}</div></div>;
}

/**
 * Google Docs-style editing directly on the branded letter page. The memo lines are inputs on the page,
 * the body is a rich-text editor, and pasting a drafted order (AI, markdown or memo text) formats it in place.
 */
export default function OfficeOrderEditor({ form, controlNumber, initialContent, onField, onDoc, onParsed }) {
  useBrandFonts();
  const [aiOpen, setAiOpen] = useState(false);
  const [aiText, setAiText] = useState('');
  const [copied, setCopied] = useState(false);
  const callbacks = useRef({ onDoc, onParsed });
  useEffect(() => { callbacks.current = { onDoc, onParsed }; });
  const editorRef = useRef(null);

  // Formats drafted text, fills the memo lines and signers, and puts the body into the page:
  // at the cursor when pasted into the body, otherwise replacing an empty body or appending to it.
  const applyDraft = (text, atCursor = false) => {
    const editor = editorRef.current;
    if (!editor || editor.isDestroyed) return;
    const parsed = parseOfficeOrderText(text);
    callbacks.current.onParsed(parsed);
    const html = markdownToHtml(parsed.body);
    if (!html) return;
    if (editor.isEmpty) editor.commands.setContent(html, { emitUpdate: true });
    else editor.chain().focus(atCursor ? undefined : 'end').insertContent(html).run();
  };
  const applyRef = useRef(applyDraft);
  useEffect(() => { applyRef.current = applyDraft; });
  const paperRef = useRef(null);

  // A drafted order pasted into a memo line, or with nothing selected, still formats the whole page
  // instead of landing in a single-line field. The body's own paste handler runs first.
  useEffect(() => {
    const onPaste = event => {
      if (event.defaultPrevented) return;
      const target = event.target;
      const onPage = target === document.body || paperRef.current?.contains(target);
      const text = event.clipboardData?.getData('text/plain') || '';
      if (!onPage || !looksLikeDraftedOrder(text)) return;
      event.preventDefault();
      applyRef.current(text);
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ code: false, codeBlock: false, heading: { levels: [1, 2, 3] }, link: { openOnClick: false, autolink: true } }),
      TableKit.configure({ table: { resizable: false } }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: 'Start writing, or paste a drafted office order — headings, lists, tables and signature blocks format themselves.' }),
    ],
    content: initialContent,
    editorProps: {
      attributes: { class: 'oe-prose', 'aria-label': 'Office order content' },
      handlePaste: (_view, event) => {
        const text = event.clipboardData?.getData('text/plain') || '';
        if (!looksLikeDraftedOrder(text)) return false;
        event.preventDefault();
        applyRef.current(text, true);
        return true;
      },
    },
    onUpdate: ({ editor: e }) => callbacks.current.onDoc(e.getJSON(), e.getText()),
  });

  // Track the live editor from the hook. React StrictMode (development) creates and destroys a first
  // instance, so a reference captured in onCreate can point at a destroyed editor.
  useEffect(() => {
    editorRef.current = editor;
    if (editor) callbacks.current.onDoc(editor.getJSON(), editor.getText());
  }, [editor]);

  if (!editor) return null;
  const issuerFirst = [...form.signers].sort((a, b) => (a.kind === 'acknowledger') - (b.kind === 'acknowledger'));

  return (
    <div className="oe-wrap">
      <Toolbar editor={editor} onAiPaste={() => setAiOpen(v => !v)} />
      {aiOpen && (
        <div className="oe-ai-panel">
          <p>Paste text from ChatGPT, Claude, Word or an email. TO / FROM / SUBJECT lines fill the memo, headings become sections, and “Approved by” / “Acknowledged by” blocks become signers. You can also paste straight anywhere on the page.</p>
          <textarea value={aiText} onChange={e => setAiText(e.target.value)} rows={7} aria-label="Text to format" placeholder="Paste here…" />
          <div className="oe-ai-actions">
            <button type="button" onClick={() => navigator.clipboard.writeText(AI_PROMPT).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); })}>
              <ClipboardCopy size={14} /> {copied ? 'Prompt copied — add your topic in the AI chat' : 'Copy AI prompt'}
            </button>
            <button type="button" onClick={() => setAiOpen(false)}>Cancel</button>
            <button type="button" className="oe-primary" disabled={!aiText.trim()} onClick={() => { applyDraft(aiText); setAiText(''); setAiOpen(false); }}><Wand2 size={14} /> Format into the page</button>
          </div>
        </div>
      )}

      <div className="oe-desk">
        <article className="oe-paper" aria-label="Office order page" ref={paperRef}>
          <header className="oe-hd">
            <img src="/brand/odc-mark.svg" alt="ODC" />
            <div>
              <div className="oe-co">{BRAND_CO.name}</div>
              <div className="oe-co-line">{BRAND_CO.address}</div>
              <div className="oe-co-line">{BRAND_CO.email} · {BRAND_CO.phone} · {BRAND_CO.site}</div>
            </div>
          </header>
          <div className="oe-band">
            <i />
            <div>
              <h2>OFFICE ORDER</h2>
              <div className="oe-docno"><small>CONTROL / TRACKING NO.</small><b>{controlNumber || 'Assigned on save'}</b></div>
            </div>
          </div>
          <div className="oe-body">
            <div className="oe-memo">
              <MemoLine label="To"><input value={form.to} maxLength={300} onChange={e => onField('to', e.target.value)} placeholder="e.g. All Sales Associates" /></MemoLine>
              <MemoLine label="Cc"><input value={form.cc} maxLength={300} onChange={e => onField('cc', e.target.value)} placeholder="Optional" /></MemoLine>
              <MemoLine label="From">
                <input value={form.fromName} maxLength={200} onChange={e => onField('fromName', e.target.value)} placeholder="Name" aria-label="From name" />
                <input value={form.fromTitle} maxLength={200} onChange={e => onField('fromTitle', e.target.value)} placeholder="Position" aria-label="From position" className="oe-muted-input" />
              </MemoLine>
              <MemoLine label="Date"><input type="date" value={form.date} onChange={e => onField('date', e.target.value)} /></MemoLine>
              <MemoLine label="Subject"><input className="oe-subject" value={form.subject} maxLength={300} onChange={e => onField('subject', e.target.value)} placeholder="Subject of the office order" /></MemoLine>
              <MemoLine label="Effectivity"><input type="date" value={form.effectivity} onChange={e => onField('effectivity', e.target.value)} /></MemoLine>
            </div>
            <EditorContent editor={editor} />
            <div className="oe-signers" aria-label="Signature lines (edit in the panel)">
              {issuerFirst.map(s => (
                <div key={s.id} className={`oe-signer oe-signer-${s.kind}`}>
                  {s.kind !== 'acknowledger' && <small>{SIGNER_KINDS[s.kind]}</small>}
                  <div className="oe-sig-line" />
                  <b>{s.name || 'Name & signature'}</b>
                  <span>{s.title}</span>
                </div>
              ))}
            </div>
          </div>
          <footer className="oe-ft"><span>{BRAND_CO.name} · Office Order</span><span>{controlNumber || 'Draft'}</span></footer>
          <div className="oe-foot-bar"><i /><b /></div>
        </article>
      </div>
    </div>
  );
}
