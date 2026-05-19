/**
 * StudyDesignSearch — the global search in the Study Design top header.
 *
 * Types as you go; surfaces a dropdown of matching Blocks / Pages / Fields
 * read from `studyFormSlice`. Selecting a result dispatches the appropriate
 * select action so the canvas jumps to that node.
 *
 * Shortcut: pressing Ctrl/⌘ + K from anywhere on the page focuses the input.
 * Pressing Esc closes the dropdown.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Search, Layers, FileText, Type as TypeIcon, CornerDownRight,
} from 'lucide-react';
import {
  selectBlocks,
  selectBlock,
  selectPage,
  selectField,
} from '@/features/cro/store/studyFormSlice';
import s from './StudyDesignSearch.module.css';

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Highlight every match of `needle` inside `text`. */
function HighlightedText({ text, needle }) {
  if (!needle) return <>{text}</>;
  const re = new RegExp(`(${escapeRegExp(needle)})`, 'ig');
  const parts = String(text ?? '').split(re);
  return (
    <>
      {parts.map((p, i) =>
        p.toLowerCase() === needle.toLowerCase()
          ? <mark key={i} className={s.mark}>{p}</mark>
          : <span key={i}>{p}</span>
      )}
    </>
  );
}

export default function StudyDesignSearch() {
  const dispatch = useDispatch();
  const blocks   = useSelector(selectBlocks);

  const [q,    setQ]    = useState('');
  const [open, setOpen] = useState(false);
  const [hi,   setHi]   = useState(0);

  const inputRef = useRef(null);
  const popRef   = useRef(null);

  // Flatten blocks → pages → fields into a searchable index.
  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    const out = [];
    for (const block of blocks) {
      const bMatch = (block.title ?? '').toLowerCase().includes(needle);
      if (bMatch) {
        out.push({
          kind: 'block',
          id: block.id,
          label: block.title || 'Untitled Block',
          path: 'Block',
          blockId: block.id,
        });
      }
      for (const page of block.pages ?? []) {
        const pMatch = (page.title ?? '').toLowerCase().includes(needle);
        if (pMatch) {
          out.push({
            kind: 'page',
            id: page.id,
            label: page.title || 'Untitled Page',
            path: `${block.title || 'Block'} › Page`,
            blockId: block.id,
            pageId:  page.id,
          });
        }
        for (const field of page.fields ?? []) {
          const haystack = `${field.label ?? ''} ${field.key ?? ''}`.toLowerCase();
          if (haystack.includes(needle)) {
            out.push({
              kind: 'field',
              id: field.id,
              label: field.label || field.key || '(unnamed field)',
              path: `${block.title || 'Block'} › ${page.title || 'Page'}`,
              blockId: block.id,
              pageId:  page.id,
              fieldId: field.id,
            });
          }
        }
      }
    }
    // Cap to a reasonable number so the dropdown stays usable on huge studies.
    return out.slice(0, 30);
  }, [q, blocks]);

  // Reset highlight whenever results change.
  useEffect(() => { setHi(0); }, [results]);

  // Global Ctrl/⌘ + K → focus the search.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Close when clicking outside the popover.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (
        !popRef.current?.contains(e.target) &&
        !inputRef.current?.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  const jumpTo = (r) => {
    if (r.kind === 'block') {
      dispatch(selectBlock(r.blockId));
    } else if (r.kind === 'page') {
      dispatch(selectPage({ blockId: r.blockId, pageId: r.pageId }));
    } else if (r.kind === 'field') {
      dispatch(selectPage({ blockId: r.blockId, pageId: r.pageId }));
      dispatch(selectField(r.fieldId));
      // Best-effort scroll into view once the canvas re-renders.
      requestAnimationFrame(() => {
        const node = document.querySelector(`[data-field-id="${r.fieldId}"]`);
        if (node?.scrollIntoView) {
          node.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    }
    setOpen(false);
    setQ('');
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHi((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHi((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      if (results[hi]) {
        e.preventDefault();
        jumpTo(results[hi]);
      }
    }
  };

  const iconFor = (kind) =>
    kind === 'block' ? <Layers   size={13} />
  : kind === 'page'  ? <FileText size={13} />
  :                    <TypeIcon size={13} />;

  const labelFor = (kind) =>
    kind === 'block' ? 'Block'
  : kind === 'page'  ? 'Page'
  :                    'Field';

  return (
    <div className={s.wrap}>
      <Search size={14} className={s.icon} />
      <input
        ref={inputRef}
        type="text"
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => q && setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Search pages, blocks, fields..."
        className={s.input}
        aria-label="Search the study form"
      />
      <span className={s.kbd}>Ctrl + K</span>

      {open && q && (
        <div ref={popRef} className={s.pop} role="listbox">
          {results.length === 0 ? (
            <div className={s.empty}>No matches for &ldquo;{q}&rdquo;</div>
          ) : (
            results.map((r, i) => (
              <button
                key={`${r.kind}-${r.id}`}
                type="button"
                className={`${s.row} ${i === hi ? s.rowActive : ''}`}
                onMouseEnter={() => setHi(i)}
                onMouseDown={(e) => { e.preventDefault(); jumpTo(r); }}
                role="option"
                aria-selected={i === hi}
              >
                <span className={`${s.kindBadge} ${s[`kind_${r.kind}`]}`}>
                  {iconFor(r.kind)} {labelFor(r.kind)}
                </span>
                <span className={s.label}>
                  <HighlightedText text={r.label} needle={q} />
                </span>
                <span className={s.path}>
                  <CornerDownRight size={11} /> {r.path}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
