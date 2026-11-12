import { useEffect, useRef, useState } from 'react';
import { useEditor, useEditorState, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TableKit } from '@tiptap/extension-table';
import TextAlign from '@tiptap/extension-text-align';
import { Placeholder } from '@tiptap/extensions';
import {
  Undo2, Redo2, Bold, Italic, Underline, Strikethrough,
  List, ListOrdered, Quote, AlignLeft, AlignCenter, AlignRight,
  AlignJustify, Eraser, Wand2, ClipboardCopy, Plus, Trash2,
} from 'lucide-react';
import { BRAND_CO, money } from '../../utils/brandDocument';
import {
  AI_QUOTATION_PROMPT, SIGNER_KINDS, parseQuotationText,
  calcLineAmount, calcQuotationTotals, renderMarkdownBody,
} from '../../utils/quotationDocument';
import { useBrandFonts } from '../../hooks/useBrandFonts';
import './QuotationEditor.css';

const BLOCKS = [
  { id: 'p', label: 'Normal text' },
  { id: 'h2', label: 'Section heading' },
  { id: 'h3', label: 'Sub-heading' },
];

const TABLE_ACTIONS = [
  ['insert', 'Insert table'],
  ['addRowAfter', 'Add row below'],
  ['addColumnAfter', 'Add column right'],
  ['deleteRow', 'Delete row'],
  ['deleteColumn', 'Delete col'],
  ['toggleHeaderRow', 'Header row'],
  ['deleteTable', 'Delete table'],
];

const DEFAULT_SCOPE_HTML = `
<h2>1. Project Objectives & Scope of Work</h2>
<p>OdysseyPH IT Solutions will engineer, configure, and deploy the agreed software solution according to standard software engineering best practices.</p>
<h2>2. Technical Deliverables & Modules</h2>
<ul>
  <li>Core Business Logic & Database Architecture</li>
  <li>Administrative Dashboard & User Management</li>
  <li>Responsive Web / Mobile User Experience</li>
  <li>Security Auditing, Role-Based Access & Data Encryption</li>
</ul>
<h2>3. Implementation Milestones</h2>
<p>Mobilization and UI/UX Approval &rarr; Beta Milestone & Technical Review &rarr; Final Acceptance & Turnover.</p>
<h2>4. Maintenance & Warranty</h2>
<p>Includes standard 30-day post-turnover warranty for bug fixes and technical support.</p>
`;

function ToolButton({ label, active, disabled, onClick, children }) {
  return (
    <button
      type="button"
      className="qe-tool"
      aria-label={label}
      title={label}
      aria-pressed={active === undefined ? undefined : active}
      disabled={disabled}
      onMouseDown={e => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor, onAiToggle }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      block: e.isActive('heading', { level: 2 }) ? 'h2' : e.isActive('heading', { level: 3 }) ? 'h3' : 'p',
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      quote: e.isActive('blockquote'),
      align: ['center', 'right', 'justify'].find(a => e.isActive({ textAlign: a })) || 'left',
      inTable: e.isActive('table'),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
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
    <div className="qe-toolbar" role="toolbar" aria-label="Editor Formatting">
      <ToolButton label="Undo" disabled={!state.canUndo} onClick={() => chain().undo().run()}>
        <Undo2 size={16} />
      </ToolButton>
      <ToolButton label="Redo" disabled={!state.canRedo} onClick={() => chain().redo().run()}>
        <Redo2 size={16} />
      </ToolButton>
      <span className="qe-sep" />

      <select
        aria-label="Text style"
        value={state.block}
        onChange={e => setBlock(e.target.value)}
      >
        {BLOCKS.map(b => (
          <option key={b.id} value={b.id}>{b.label}</option>
        ))}
      </select>

      <ToolButton label="Bold" active={state.bold} onClick={() => chain().toggleBold().run()}>
        <Bold size={16} />
      </ToolButton>
      <ToolButton label="Italic" active={state.italic} onClick={() => chain().toggleItalic().run()}>
        <Italic size={16} />
      </ToolButton>
      <ToolButton label="Underline" active={state.underline} onClick={() => chain().toggleUnderline().run()}>
        <Underline size={16} />
      </ToolButton>
      <ToolButton label="Strikethrough" active={state.strike} onClick={() => chain().toggleStrike().run()}>
        <Strikethrough size={16} />
      </ToolButton>
      <span className="qe-sep" />

      <ToolButton label="Bullet list" active={state.bullet} onClick={() => chain().toggleBulletList().run()}>
        <List size={16} />
      </ToolButton>
      <ToolButton label="Numbered list" active={state.ordered} onClick={() => chain().toggleOrderedList().run()}>
        <ListOrdered size={16} />
      </ToolButton>
      <ToolButton label="Blockquote" active={state.quote} onClick={() => chain().toggleBlockquote().run()}>
        <Quote size={16} />
      </ToolButton>
      <span className="qe-sep" />

      <ToolButton label="Align left" active={state.align === 'left'} onClick={() => chain().setTextAlign('left').run()}>
        <AlignLeft size={16} />
      </ToolButton>
      <ToolButton label="Align center" active={state.align === 'center'} onClick={() => chain().setTextAlign('center').run()}>
        <AlignCenter size={16} />
      </ToolButton>
      <ToolButton label="Align right" active={state.align === 'right'} onClick={() => chain().setTextAlign('right').run()}>
        <AlignRight size={16} />
      </ToolButton>
      <ToolButton label="Justify" active={state.align === 'justify'} onClick={() => chain().setTextAlign('justify').run()}>
        <AlignJustify size={16} />
      </ToolButton>
      <span className="qe-sep" />

      <select
        aria-label="Table actions"
        value=""
        onChange={e => {
          if (e.target.value) tableAction(e.target.value);
        }}
      >
        <option value="">Table...</option>
        {TABLE_ACTIONS.map(([id, label]) => (
          <option key={id} value={id} disabled={id !== 'insert' && !state.inTable}>{label}</option>
        ))}
      </select>

      <ToolButton label="Clear formatting" onClick={() => chain().unsetAllMarks().clearNodes().run()}>
        <Eraser size={16} />
      </ToolButton>
      <span className="qe-grow" />

      <button type="button" className="qe-ai" onClick={onAiToggle}>
        <Wand2 size={14} /> AI Assistant
      </button>
    </div>
  );
}

export default function QuotationEditor({
  form,
  controlNumber,
  initialContent,
  onField,
  onItemsChange,
  onDoc,
  onParsed,
}) {
  useBrandFonts();
  const [aiOpen, setAiOpen] = useState(false);
  const [pasteBuffer, setPasteBuffer] = useState('');
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const editorRef = useRef(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        code: false,
        codeBlock: false,
        heading: { levels: [2, 3] },
        link: { openOnClick: false, autolink: true },
      }),
      TableKit.configure({ table: { resizable: false } }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({
        placeholder: 'Detail the project scope, key deliverables, technical stack, and payment terms...',
      }),
    ],
    content: initialContent || form.scopeJson || DEFAULT_SCOPE_HTML,
    editorProps: {
      attributes: { class: 'qe-prose', 'aria-label': 'Quotation scope of work' },
    },
    onUpdate: ({ editor: e }) => {
      onDoc(e.getJSON(), e.getHTML());
    },
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  // Pricing calculations
  const totals = calcQuotationTotals(
    form.items || [],
    form.discountPercent || 0,
    form.taxPercent || 0,
  );

  const addItem = () => {
    const next = [
      ...(form.items || []),
      {
        id: `item_${Date.now()}_${(form.items || []).length + 1}`,
        description: '',
        quantity: 1,
        unitPrice: 0,
        amount: 0,
      },
    ];
    onItemsChange(next);
  };

  const updateItem = (id, key, val) => {
    const next = (form.items || []).map(it => {
      if (it.id !== id) return it;
      const updated = { ...it, [key]: val };
      if (key === 'quantity' || key === 'unitPrice') {
        const q = key === 'quantity' ? Number(val) || 0 : it.quantity;
        const p = key === 'unitPrice' ? Number(val) || 0 : it.unitPrice;
        updated.amount = calcLineAmount(q, p);
      }
      return updated;
    });
    onItemsChange(next);
  };

  const removeItem = id => {
    onItemsChange((form.items || []).filter(it => it.id !== id));
  };

  const copyPrompt = () => {
    navigator.clipboard.writeText(AI_QUOTATION_PROMPT);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2500);
  };

  const applyPastedText = () => {
    if (!pasteBuffer.trim()) return;
    const parsed = parseQuotationText(pasteBuffer);
    onParsed(parsed);
    if (parsed.scope && editorRef.current) {
      editorRef.current.commands.setContent(renderMarkdownBody(parsed.scope));
    }
    setPasteBuffer('');
    setAiOpen(false);
  };

  return (
    <div className="qe-wrap">
      {editor && <Toolbar editor={editor} onAiToggle={() => setAiOpen(v => !v)} />}

      {aiOpen && (
        <div className="qe-ai-panel">
          <p>
            Copy the structured prompt for ChatGPT, Claude, or Gemini to draft your project quotation.
            Paste the resulting text or markdown proposal below to automatically populate the project particulars,
            line-item pricing sheet, and rich-text scope.
          </p>
          <div className="qe-ai-actions">
            <button type="button" className="qe-primary" onClick={copyPrompt}>
              <ClipboardCopy size={14} /> {copiedPrompt ? 'Copied Prompt!' : 'Copy AI Prompt'}
            </button>
          </div>
          <textarea
            rows={5}
            style={{ width: '100%', padding: '8px', borderRadius: '6px', background: '#1f2735', color: '#fff', border: '1px solid #333' }}
            placeholder="Paste raw text or AI output here..."
            value={pasteBuffer}
            onChange={e => setPasteBuffer(e.target.value)}
          />
          <div className="qe-ai-actions">
            <button type="button" className="qe-primary" onClick={applyPastedText}>
              Apply to Quotation
            </button>
          </div>
        </div>
      )}

      <div className="qe-desk">
        <div className="qe-paper">
          {/* Header */}
          <div className="qe-hd">
            <img src="/brand/odc-mark.svg" alt="ODC" />
            <div>
              <div className="qe-co">{BRAND_CO.name}</div>
              <div className="qe-co-line">{BRAND_CO.address}</div>
              <div className="qe-co-line">{BRAND_CO.email} · {BRAND_CO.phone} · {BRAND_CO.site}</div>
            </div>
          </div>

          {/* Title Band */}
          <div className="qe-band">
            <i />
            <div>
              <h2>PRICE QUOTATION</h2>
              <div className="qe-docno">
                <small>QUOTATION NO.</small>
                <b>{controlNumber || 'QT-DRAFT'}</b>
              </div>
            </div>
          </div>

          <div className="qe-body">
            {/* Metadata Fields */}
            <div className="qe-memo">
              <div className="qe-memo-col">
                <div className="qe-memo-heading">Quoted To (Client Information)</div>
                <div className="qe-field-row">
                  <label>Company:</label>
                  <input
                    className="qe-lead-input"
                    value={form.clientBusiness || ''}
                    maxLength={300}
                    placeholder="Client Enterprise / Business Name"
                    onChange={e => onField('clientBusiness', e.target.value)}
                  />
                </div>
                <div className="qe-field-row">
                  <label>Attention:</label>
                  <input
                    value={form.clientName || ''}
                    maxLength={200}
                    placeholder="Authorized Representative"
                    onChange={e => onField('clientName', e.target.value)}
                  />
                </div>
                <div className="qe-field-row">
                  <label>Address:</label>
                  <input
                    value={form.clientAddress || ''}
                    maxLength={300}
                    placeholder="Business Address / Location"
                    onChange={e => onField('clientAddress', e.target.value)}
                  />
                </div>
                <div className="qe-field-row">
                  <label>Contact:</label>
                  <input
                    value={form.clientEmail || ''}
                    maxLength={100}
                    placeholder="email@company.com"
                    onChange={e => onField('clientEmail', e.target.value)}
                  />
                </div>
              </div>

              <div className="qe-memo-col">
                <div className="qe-memo-heading">Quotation Details</div>
                <div className="qe-field-row">
                  <label>Project:</label>
                  <input
                    className="qe-lead-input"
                    value={form.projectName || ''}
                    maxLength={300}
                    placeholder="Software Platform / Project Name"
                    onChange={e => onField('projectName', e.target.value)}
                  />
                </div>
                <div className="qe-field-row">
                  <label>Date Issued:</label>
                  <input
                    type="date"
                    value={form.date || ''}
                    onChange={e => onField('date', e.target.value)}
                  />
                </div>
                <div className="qe-field-row">
                  <label>Valid Until:</label>
                  <input
                    type="date"
                    value={form.validUntil || ''}
                    onChange={e => onField('validUntil', e.target.value)}
                  />
                </div>
                <div className="qe-field-row">
                  <label>Payment:</label>
                  <input
                    value={form.paymentTerms || ''}
                    maxLength={200}
                    placeholder="e.g. 50% Mobilization, 50% Final Handover"
                    onChange={e => onField('paymentTerms', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Dynamic Itemizer Table */}
            <div className="qe-items-box">
              <table className="qe-items-table">
                <thead>
                  <tr>
                    <th style={{ width: '36px' }}>#</th>
                    <th>Item & Specification</th>
                    <th style={{ width: '70px', textAlign: 'center' }}>Qty</th>
                    <th style={{ width: '130px', textAlign: 'right' }}>Unit Price (₱)</th>
                    <th style={{ width: '130px', textAlign: 'right' }}>Total (₱)</th>
                    <th style={{ width: '36px' }} />
                  </tr>
                </thead>
                <tbody>
                  {(form.items || []).map((it, idx) => (
                    <tr key={it.id || idx}>
                      <td style={{ textAlign: 'center', color: 'var(--muted)' }}>{idx + 1}</td>
                      <td>
                        <input
                          value={it.description || ''}
                          maxLength={300}
                          placeholder="Module or Service Description"
                          onChange={e => updateItem(it.id, 'description', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="1"
                          style={{ textAlign: 'center' }}
                          value={it.quantity ?? 1}
                          onChange={e => updateItem(it.id, 'quantity', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="500"
                          style={{ textAlign: 'right' }}
                          value={it.unitPrice ?? 0}
                          onChange={e => updateItem(it.id, 'unitPrice', e.target.value)}
                        />
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        ₱ {money(it.amount || calcLineAmount(it.quantity, it.unitPrice))}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="qe-action-btn"
                          aria-label="Remove item"
                          onClick={() => removeItem(it.id)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <button type="button" className="qe-add-row" onClick={addItem}>
                <Plus size={14} /> Add Line Item
              </button>
            </div>

            {/* Financial Summary Card */}
            <div className="qe-summary-container">
              <div className="qe-summary-card">
                <div className="qe-sum-row">
                  <span>Subtotal:</span>
                  <b>₱ {money(totals.subtotal)}</b>
                </div>

                <div className="qe-sum-row">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    Discount (%):
                    <input
                      type="number"
                      min="0"
                      max="100"
                      style={{ width: '56px', padding: '2px 4px !important' }}
                      value={form.discountPercent ?? 0}
                      onChange={e => onField('discountPercent', Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                    />
                  </span>
                  <b style={{ color: totals.discountAmount > 0 ? '#b42318' : 'inherit' }}>
                    {totals.discountAmount > 0 ? `- ₱ ${money(totals.discountAmount)}` : '₱ 0.00'}
                  </b>
                </div>

                <div className="qe-sum-row">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={Boolean(form.taxPercent && form.taxPercent > 0)}
                        onChange={e => onField('taxPercent', e.target.checked ? 12 : 0)}
                        style={{ width: 'auto' }}
                      />
                      Apply 12% VAT
                    </label>
                  </span>
                  <b>₱ {money(totals.taxAmount)}</b>
                </div>

                <div className="qe-sum-total">
                  <span>GRAND TOTAL:</span>
                  <b>₱ {money(totals.total)}</b>
                </div>

                <div className="qe-words-text">{totals.totalWords}</div>
              </div>
            </div>

            {/* TipTap Rich Text Scope */}
            <div style={{ marginTop: '20px' }}>
              <div className="qe-memo-heading" style={{ marginBottom: '8px' }}>
                Scope of Work, Deliverables & Contractual Terms
              </div>
              <EditorContent editor={editor} />
            </div>

            {/* Signers Block Preview */}
            <div className="qe-signers-grid">
              {(form.signers || []).map(s => (
                <div className="qe-sig-card" key={s.id}>
                  <small>{SIGNER_KINDS[s.kind] || 'Signatory'}</small>
                  <div className="qe-sig-line" />
                  <b>{s.name || (s.kind === 'accepted' ? 'Client Representative' : BRAND_CO.approvedBy)}</b>
                  <span>{s.title || (s.kind === 'accepted' ? 'Authorized Signatory' : 'Executive Lead')}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="qe-ft">
            <span>{BRAND_CO.name} · Official Project Proposal</span>
            <span>Document Code: {controlNumber || 'QT-DRAFT'}</span>
          </div>
          <div className="qe-foot-bar">
            <i />
            <b />
          </div>
        </div>
      </div>
    </div>
  );
}

