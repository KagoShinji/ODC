import { useEffect, useRef, useState } from 'react';
import { useEditor, useEditorState, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TableKit } from '@tiptap/extension-table';
import TextAlign from '@tiptap/extension-text-align';
import { Placeholder } from '@tiptap/extensions';
import {
  Undo2, Redo2, Bold, Italic, Underline, Strikethrough, List, ListOrdered, Quote, AlignLeft, AlignCenter, AlignRight, AlignJustify, Eraser, Wand2, ClipboardCopy, Plus, Trash2,
} from 'lucide-react';
import { BRAND_CO } from '../../utils/brandDocument.js';
import {
  AI_AUDIT_PROMPT, AUDIT_CATEGORIES, AUDIT_RATINGS, SIGNER_KINDS,
  parseAuditReportText, renderBody,
} from '../../utils/auditReportDocument.js';
import { useBrandFonts } from '../../hooks/useBrandFonts.js';
import './AuditReportEditor.css';

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
    <button type="button" className="ae-tool" aria-label={label} title={label} aria-pressed={active === undefined ? undefined : active} disabled={disabled}
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
    <div className="ae-toolbar" role="toolbar" aria-label="Formatting">
      <ToolButton label="Undo" disabled={!state.canUndo} onClick={() => chain().undo().run()}><Undo2 size={16} /></ToolButton>
      <ToolButton label="Redo" disabled={!state.canRedo} onClick={() => chain().redo().run()}><Redo2 size={16} /></ToolButton>
      <span className="ae-sep" />
      <select aria-label="Text style" value={state.block} onChange={e => setBlock(e.target.value)}>
        {BLOCKS.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
      </select>
      <span className="ae-sep" />
      <ToolButton label="Bold" active={state.bold} onClick={() => chain().toggleBold().run()}><Bold size={16} /></ToolButton>
      <ToolButton label="Italic" active={state.italic} onClick={() => chain().toggleItalic().run()}><Italic size={16} /></ToolButton>
      <ToolButton label="Underline" active={state.underline} onClick={() => chain().toggleUnderline?.().run()}><Underline size={16} /></ToolButton>
      <ToolButton label="Strikethrough" active={state.strike} onClick={() => chain().toggleStrike().run()}><Strikethrough size={16} /></ToolButton>
      <span className="ae-sep" />
      <ToolButton label="Bulleted list" active={state.bullet} onClick={() => chain().toggleBulletList().run()}><List size={16} /></ToolButton>
      <ToolButton label="Numbered list" active={state.ordered} onClick={() => chain().toggleOrderedList().run()}><ListOrdered size={16} /></ToolButton>
      <ToolButton label="Highlighted note" active={state.quote} onClick={() => chain().toggleBlockquote().run()}><Quote size={16} /></ToolButton>
      <span className="ae-sep" />
      <ToolButton label="Align left" active={state.align === 'left'} onClick={() => chain().setTextAlign('left').run()}><AlignLeft size={16} /></ToolButton>
      <ToolButton label="Align center" active={state.align === 'center'} onClick={() => chain().setTextAlign('center').run()}><AlignCenter size={16} /></ToolButton>
      <ToolButton label="Align right" active={state.align === 'right'} onClick={() => chain().setTextAlign('right').run()}><AlignRight size={16} /></ToolButton>
      <ToolButton label="Justify" active={state.align === 'justify'} onClick={() => chain().setTextAlign('justify').run()}><AlignJustify size={16} /></ToolButton>
      <span className="ae-sep" />
      <select aria-label="Table" value="" onChange={e => { if (e.target.value) tableAction(e.target.value); }}>
        <option value="">Table…</option>
        {TABLE_ACTIONS.map(([id, label]) => <option key={id} value={id} disabled={id !== 'insert' && !state.inTable}>{label}</option>)}
      </select>
      <ToolButton label="Clear formatting" onClick={() => chain().unsetAllMarks().clearNodes().run()}><Eraser size={16} /></ToolButton>
      <span className="ae-grow" />
      <button type="button" className="ae-ai" onMouseDown={e => e.preventDefault()} onClick={onAiPaste}><Wand2 size={15} /> Paste from AI</button>
    </div>
  );
}

export default function AuditReportEditor({ form, controlNumber, initialContent, onField, onDoc, onParsed }) {
  useBrandFonts();
  const [aiOpen, setAiOpen] = useState(false);
  const [aiText, setAiText] = useState('');
  const [copied, setCopied] = useState(false);
  const callbacks = useRef({ onDoc, onParsed });
  useEffect(() => { callbacks.current = { onDoc, onParsed }; });
  const editorRef = useRef(null);

  const applyDraft = (text, atCursor = false) => {
    const editor = editorRef.current;
    if (!editor || editor.isDestroyed) return;
    const parsed = parseAuditReportText(text);
    callbacks.current.onParsed(parsed);
    const html = renderBody(parsed.body);
    if (!html) return;
    if (editor.isEmpty) editor.commands.setContent(html, { emitUpdate: true });
    else editor.chain().focus(atCursor ? undefined : 'end').insertContent(html).run();
  };

  const applyRef = useRef(applyDraft);
  useEffect(() => { applyRef.current = applyDraft; });

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ code: false, codeBlock: false, heading: { levels: [1, 2, 3] }, link: { openOnClick: false, autolink: true } }),
      TableKit.configure({ table: { resizable: false } }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: 'Start typing audit objectives, methodology, observations, or paste from AI…' }),
    ],
    content: initialContent,
    editorProps: {
      attributes: { class: 'ae-prose', 'aria-label': 'Audit report content' },
    },
    onUpdate: ({ editor: e }) => callbacks.current.onDoc(e.getJSON(), e.getText()),
  });

  useEffect(() => {
    editorRef.current = editor;
    if (editor) callbacks.current.onDoc(editor.getJSON(), editor.getText());
  }, [editor]);

  if (!editor) return null;

  const addSigner = () => {
    const list = [...(form.signers || [])];
    const nextNum = list.length + 1;
    list.push({ id: `s${Date.now()}`, kind: 'reviewer', name: '', title: '', order: nextNum });
    onField('signers', list);
  };

  const updateSigner = (index, key, val) => {
    const list = [...(form.signers || [])];
    list[index] = { ...list[index], [key]: val };
    onField('signers', list);
  };

  const removeSigner = index => {
    const list = (form.signers || []).filter((_, i) => i !== index);
    onField('signers', list);
  };

  return (
    <div className="ae-wrap">
      <Toolbar editor={editor} onAiPaste={() => setAiOpen(v => !v)} />
      {aiOpen && (
        <div className="ae-ai-panel">
          <p>Paste text from ChatGPT, Claude, Word or an audit log. Title, scope, rating, dates, auditors, and auditee will automatically populate the header fields, and findings format directly into the document.</p>
          <textarea value={aiText} onChange={e => setAiText(e.target.value)} rows={7} aria-label="Text to format" placeholder="Paste audit report draft here…" />
          <div className="ae-ai-actions">
            <button type="button" onClick={() => navigator.clipboard.writeText(AI_AUDIT_PROMPT).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); })}>
              <ClipboardCopy size={14} /> {copied ? 'Prompt copied — paste into AI chat' : 'Copy AI audit prompt'}
            </button>
            <button type="button" onClick={() => setAiOpen(false)}>Cancel</button>
            <button type="button" className="ae-primary" disabled={!aiText.trim()} onClick={() => { applyDraft(aiText); setAiText(''); setAiOpen(false); }}>
              <Wand2 size={14} /> Format into report
            </button>
          </div>
        </div>
      )}

      <div className="ae-desk">
        <article className="ae-paper" aria-label="Audit report page">
          <header className="ae-hd">
            <img src="/brand/odc-mark.svg" alt="ODC" />
            <div>
              <div className="ae-co">{BRAND_CO.name}</div>
              <div className="ae-co-line">{BRAND_CO.address}</div>
              <div className="ae-co-line">{BRAND_CO.email} · {BRAND_CO.phone} · {BRAND_CO.site}</div>
            </div>
          </header>

          <div className="ae-band">
            <i />
            <div>
              <h2>AUDIT REPORT</h2>
              <div className="ae-docno"><small>CONTROL / TRACKING NO.</small><b>{controlNumber || 'Assigned on save'}</b></div>
            </div>
          </div>

          <div className="ae-body">
            <div className="ae-grid">
              <span className="ae-grid-lbl">Engagement</span>
              <div className="ae-grid-val full">
                <input
                  className="ae-title-input"
                  value={form.title || ''}
                  maxLength={300}
                  onChange={e => onField('title', e.target.value)}
                  placeholder="e.g. Q4 2026 IT Infrastructure & Security Audit"
                />
              </div>

              <span className="ae-grid-lbl">Scope Area</span>
              <div className="ae-grid-val">
                <select value={form.category || 'it_security'} onChange={e => onField('category', e.target.value)}>
                  {Object.entries(AUDIT_CATEGORIES).map(([catKey, label]) => (
                    <option key={catKey} value={catKey}>{label}</option>
                  ))}
                </select>
              </div>

              <span className="ae-grid-lbl">Overall Rating</span>
              <div className="ae-grid-val">
                <div className="ae-rating-selector">
                  {Object.entries(AUDIT_RATINGS).map(([rKey, info]) => {
                    const active = (form.rating || 'satisfactory') === rKey;
                    return (
                      <button
                        key={rKey}
                        type="button"
                        className={`ae-rating-btn ${active ? `active rating-${rKey}` : ''}`}
                        onClick={() => onField('rating', rKey)}
                      >
                        {info.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <span className="ae-grid-lbl">Period Covered</span>
              <div className="ae-grid-val">
                <input
                  type="date"
                  value={form.auditPeriodStart || ''}
                  onChange={e => onField('auditPeriodStart', e.target.value)}
                  title="Period Start Date"
                />
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>to</span>
                <input
                  type="date"
                  value={form.auditPeriodEnd || ''}
                  onChange={e => onField('auditPeriodEnd', e.target.value)}
                  title="Period End Date"
                />
              </div>

              <span className="ae-grid-lbl">Date Conducted</span>
              <div className="ae-grid-val">
                <input
                  type="date"
                  value={form.auditDate || ''}
                  onChange={e => onField('auditDate', e.target.value)}
                />
              </div>

              <span className="ae-grid-lbl">Date Issued</span>
              <div className="ae-grid-val">
                <input
                  type="date"
                  value={form.dateIssued || ''}
                  onChange={e => onField('dateIssued', e.target.value)}
                />
              </div>

              <span className="ae-grid-lbl">Lead Auditor</span>
              <div className="ae-grid-val">
                <input
                  value={form.leadAuditorName || ''}
                  maxLength={200}
                  onChange={e => onField('leadAuditorName', e.target.value)}
                  placeholder="Auditor Name"
                  style={{ flex: 1 }}
                />
                <input
                  value={form.leadAuditorTitle || ''}
                  maxLength={200}
                  onChange={e => onField('leadAuditorTitle', e.target.value)}
                  placeholder="Title / Role"
                  style={{ flex: 1 }}
                />
              </div>

              <span className="ae-grid-lbl">Auditee Entity</span>
              <div className="ae-grid-val full">
                <input
                  value={form.auditeeEntity || ''}
                  maxLength={200}
                  onChange={e => onField('auditeeEntity', e.target.value)}
                  placeholder="Department, system, or team audited (e.g. Engineering & Cloud Operations)"
                  style={{ flex: 2 }}
                />
                <input
                  value={form.auditeeContact || ''}
                  maxLength={200}
                  onChange={e => onField('auditeeContact', e.target.value)}
                  placeholder="Auditee Contact / Head"
                  style={{ flex: 1 }}
                />
              </div>

              <span className="ae-grid-lbl">Audit Team</span>
              <div className="ae-grid-val full">
                <input
                  value={form.auditTeam || ''}
                  maxLength={300}
                  onChange={e => onField('auditTeam', e.target.value)}
                  placeholder="Team members, co-auditors, or observers (comma-separated)"
                />
              </div>
            </div>

            <EditorContent editor={editor} />

            <div className="ae-signers-box">
              <div className="ae-signers-hd">
                <h4>Signers &amp; Audit Governance ({form.signers?.length || 0})</h4>
                <button type="button" className="btn btn-secondary btn-sm" onClick={addSigner}>
                  <Plus size={13} /> Add Signer
                </button>
              </div>

              <div className="ae-signers-grid">
                {(form.signers || []).map((s, index) => (
                  <div key={s.id || index} className="ae-signer-item">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <select
                        value={s.kind || 'auditor'}
                        onChange={e => updateSigner(index, 'kind', e.target.value)}
                        style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}
                      >
                        {Object.entries(SIGNER_KINDS).map(([kindKey, label]) => (
                          <option key={kindKey} value={kindKey}>{label}</option>
                        ))}
                      </select>
                      {form.signers.length > 1 && (
                        <button type="button" onClick={() => removeSigner(index)} style={{ border: 0, background: 'none', color: '#991b1b', cursor: 'pointer', padding: 2 }}>
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                    <input
                      value={s.name || ''}
                      placeholder="Signer Full Name"
                      onChange={e => updateSigner(index, 'name', e.target.value)}
                    />
                    <input
                      className="muted"
                      value={s.title || ''}
                      placeholder="Position / Role"
                      onChange={e => updateSigner(index, 'title', e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <footer className="ae-ft">
            <span>{BRAND_CO.name} · Audit Report</span>
            <span>{controlNumber || 'Draft'}</span>
          </footer>
          <div className="ae-foot-bar"><i /><b /></div>
        </article>
      </div>
    </div>
  );
}
