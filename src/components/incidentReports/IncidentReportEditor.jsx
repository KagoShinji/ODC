import { useEffect, useRef, useState } from 'react';
import { useEditor, useEditorState, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TableKit } from '@tiptap/extension-table';
import TextAlign from '@tiptap/extension-text-align';
import { Placeholder } from '@tiptap/extensions';
import {
  Undo2, Redo2, Bold, Italic, Underline, Strikethrough, List, ListOrdered, Quote, AlignLeft, AlignCenter, AlignRight, AlignJustify, Eraser, Wand2, ClipboardCopy, Plus, Trash2,
} from 'lucide-react';
import { BRAND_CO } from '../../utils/brandDocument';
import {
  AI_INCIDENT_PROMPT, SEVERITIES, CATEGORIES, SIGNER_KINDS,
  parseIncidentReportText, renderBody,
} from '../../utils/incidentReportDocument';
import { useBrandFonts } from '../../hooks/useBrandFonts';
import './IncidentReportEditor.css';

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
    <button type="button" className="ie-tool" aria-label={label} title={label} aria-pressed={active === undefined ? undefined : active} disabled={disabled}
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
    <div className="ie-toolbar" role="toolbar" aria-label="Formatting">
      <ToolButton label="Undo" disabled={!state.canUndo} onClick={() => chain().undo().run()}><Undo2 size={16} /></ToolButton>
      <ToolButton label="Redo" disabled={!state.canRedo} onClick={() => chain().redo().run()}><Redo2 size={16} /></ToolButton>
      <span className="ie-sep" />
      <select aria-label="Text style" value={state.block} onChange={e => setBlock(e.target.value)}>
        {BLOCKS.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
      </select>
      <span className="ie-sep" />
      <ToolButton label="Bold" active={state.bold} onClick={() => chain().toggleBold().run()}><Bold size={16} /></ToolButton>
      <ToolButton label="Italic" active={state.italic} onClick={() => chain().toggleItalic().run()}><Italic size={16} /></ToolButton>
      <ToolButton label="Underline" active={state.underline} onClick={() => chain().toggleUnderline?.().run()}><Underline size={16} /></ToolButton>
      <ToolButton label="Strikethrough" active={state.strike} onClick={() => chain().toggleStrike().run()}><Strikethrough size={16} /></ToolButton>
      <span className="ie-sep" />
      <ToolButton label="Bulleted list" active={state.bullet} onClick={() => chain().toggleBulletList().run()}><List size={16} /></ToolButton>
      <ToolButton label="Numbered list" active={state.ordered} onClick={() => chain().toggleOrderedList().run()}><ListOrdered size={16} /></ToolButton>
      <ToolButton label="Highlighted note" active={state.quote} onClick={() => chain().toggleBlockquote().run()}><Quote size={16} /></ToolButton>
      <span className="ie-sep" />
      <ToolButton label="Align left" active={state.align === 'left'} onClick={() => chain().setTextAlign('left').run()}><AlignLeft size={16} /></ToolButton>
      <ToolButton label="Align center" active={state.align === 'center'} onClick={() => chain().setTextAlign('center').run()}><AlignCenter size={16} /></ToolButton>
      <ToolButton label="Align right" active={state.align === 'right'} onClick={() => chain().setTextAlign('right').run()}><AlignRight size={16} /></ToolButton>
      <ToolButton label="Justify" active={state.align === 'justify'} onClick={() => chain().setTextAlign('justify').run()}><AlignJustify size={16} /></ToolButton>
      <span className="ie-sep" />
      <select aria-label="Table" value="" onChange={e => { if (e.target.value) tableAction(e.target.value); }}>
        <option value="">Table…</option>
        {TABLE_ACTIONS.map(([id, label]) => <option key={id} value={id} disabled={id !== 'insert' && !state.inTable}>{label}</option>)}
      </select>
      <ToolButton label="Clear formatting" onClick={() => chain().unsetAllMarks().clearNodes().run()}><Eraser size={16} /></ToolButton>
      <span className="ie-grow" />
      <button type="button" className="ie-ai" onMouseDown={e => e.preventDefault()} onClick={onAiPaste}><Wand2 size={15} /> Paste from AI</button>
    </div>
  );
}

export default function IncidentReportEditor({ form, controlNumber, initialContent, onField, onDoc, onParsed }) {
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
    const parsed = parseIncidentReportText(text);
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
      Placeholder.configure({ placeholder: 'Start typing incident narrative, timeline, root causes, or paste from AI…' }),
    ],
    content: initialContent,
    editorProps: {
      attributes: { class: 'ie-prose', 'aria-label': 'Incident report content' },
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
    list.push({ id: `s${Date.now()}`, kind: 'investigator', name: '', title: '', order: nextNum });
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
    <div className="ie-wrap">
      <Toolbar editor={editor} onAiPaste={() => setAiOpen(v => !v)} />
      {aiOpen && (
        <div className="ie-ai-panel">
          <p>Paste text from ChatGPT, Claude, Word or an incident log. Title, date, severity, category, and persons involved will automatically populate the header fields, and narrative sections format directly into the document.</p>
          <textarea value={aiText} onChange={e => setAiText(e.target.value)} rows={7} aria-label="Text to format" placeholder="Paste incident report draft here…" />
          <div className="ie-ai-actions">
            <button type="button" onClick={() => navigator.clipboard.writeText(AI_INCIDENT_PROMPT).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); })}>
              <ClipboardCopy size={14} /> {copied ? 'Prompt copied — paste into AI chat' : 'Copy AI incident prompt'}
            </button>
            <button type="button" onClick={() => setAiOpen(false)}>Cancel</button>
            <button type="button" className="ie-primary" disabled={!aiText.trim()} onClick={() => { applyDraft(aiText); setAiText(''); setAiOpen(false); }}>
              <Wand2 size={14} /> Format into report
            </button>
          </div>
        </div>
      )}

      <div className="ie-desk">
        <article className="ie-paper" aria-label="Incident report page">
          <header className="ie-hd">
            <img src="/brand/odc-mark.svg" alt="ODC" />
            <div>
              <div className="ie-co">{BRAND_CO.name}</div>
              <div className="ie-co-line">{BRAND_CO.address}</div>
              <div className="ie-co-line">{BRAND_CO.email} · {BRAND_CO.phone} · {BRAND_CO.site}</div>
            </div>
          </header>

          <div className="ie-band">
            <i />
            <div>
              <h2>INCIDENT REPORT</h2>
              <div className="ie-docno"><small>CONTROL / TRACKING NO.</small><b>{controlNumber || 'Assigned on save'}</b></div>
            </div>
          </div>

          <div className="ie-body">
            <div className="ie-grid">
              <span className="ie-grid-lbl">Title</span>
              <div className="ie-grid-val full">
                <input
                  className="ie-title-input"
                  value={form.title || ''}
                  maxLength={300}
                  onChange={e => onField('title', e.target.value)}
                  placeholder="e.g. Fiber Line Cut & Internet Outage"
                />
              </div>

              <span className="ie-grid-lbl">Incident Date</span>
              <div className="ie-grid-val">
                <input
                  type="date"
                  value={form.incidentDate || ''}
                  onChange={e => onField('incidentDate', e.target.value)}
                />
              </div>

              <span className="ie-grid-lbl">Time</span>
              <div className="ie-grid-val">
                <input
                  value={form.incidentTime || ''}
                  maxLength={30}
                  onChange={e => onField('incidentTime', e.target.value)}
                  placeholder="e.g. 09:30 AM"
                />
              </div>

              <span className="ie-grid-lbl">Date Reported</span>
              <div className="ie-grid-val">
                <input
                  type="date"
                  value={form.dateReported || ''}
                  onChange={e => onField('dateReported', e.target.value)}
                />
              </div>

              <span className="ie-grid-lbl">Location</span>
              <div className="ie-grid-val">
                <input
                  value={form.location || ''}
                  maxLength={200}
                  onChange={e => onField('location', e.target.value)}
                  placeholder="e.g. Talisay Office, Server Room"
                />
              </div>

              <span className="ie-grid-lbl">Category</span>
              <div className="ie-grid-val">
                <select value={form.category || 'operational'} onChange={e => onField('category', e.target.value)}>
                  {Object.entries(CATEGORIES).map(([catKey, label]) => (
                    <option key={catKey} value={catKey}>{label}</option>
                  ))}
                </select>
              </div>

              <span className="ie-grid-lbl">Severity</span>
              <div className="ie-grid-val">
                <div className="ie-sev-selector">
                  {Object.entries(SEVERITIES).map(([sevKey, info]) => {
                    const active = (form.severity || 'medium') === sevKey;
                    return (
                      <button
                        key={sevKey}
                        type="button"
                        className={`ie-sev-btn ${active ? `active sev-${sevKey}` : ''}`}
                        onClick={() => onField('severity', sevKey)}
                      >
                        {info.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <span className="ie-grid-lbl">Reported By</span>
              <div className="ie-grid-val full">
                <input
                  value={form.reportedByName || ''}
                  maxLength={200}
                  onChange={e => onField('reportedByName', e.target.value)}
                  placeholder="Reporter Name"
                  style={{ flex: 1 }}
                />
                <input
                  value={form.reportedByTitle || ''}
                  maxLength={200}
                  onChange={e => onField('reportedByTitle', e.target.value)}
                  placeholder="Position / Title"
                  style={{ flex: 1 }}
                />
              </div>

              <span className="ie-grid-lbl">Involved</span>
              <div className="ie-grid-val full">
                <input
                  value={form.personsInvolved || ''}
                  maxLength={300}
                  onChange={e => onField('personsInvolved', e.target.value)}
                  placeholder="Names of witnesses or involved personnel (optional)"
                />
              </div>
            </div>

            <EditorContent editor={editor} />

            <div className="ie-signers-box">
              <div className="ie-signers-hd">
                <h4>Signers &amp; Reviewers ({form.signers?.length || 0})</h4>
                <button type="button" className="btn btn-secondary btn-sm" onClick={addSigner}>
                  <Plus size={13} /> Add Signer
                </button>
              </div>

              <div className="ie-signers-grid">
                {(form.signers || []).map((s, index) => (
                  <div key={s.id || index} className="ie-signer-item">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <select
                        value={s.kind || 'reporter'}
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

          <footer className="ie-ft">
            <span>{BRAND_CO.name} · Incident Report</span>
            <span>{controlNumber || 'Draft'}</span>
          </footer>
          <div className="ie-foot-bar"><i /><b /></div>
        </article>
      </div>
    </div>
  );
}
