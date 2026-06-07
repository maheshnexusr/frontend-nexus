/**
 * PostalCodeSelect — searchable dropdown of the study's locations, keyed by
 * Postal Code. Selecting a postal code returns the full location so the Add-Site
 * form can auto-load City / District / State (per spec item 6).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Search, ChevronDown } from 'lucide-react';

export default function PostalCodeSelect({ value, locations, onSelect, invalid, placeholder }) {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? locations.filter((l) =>
          `${l.postalCode} ${l.city} ${l.district} ${l.state}`.toLowerCase().includes(q))
      : locations;
    return list.slice(0, 50);
  }, [locations, query]);

  // Show the chosen postal code when closed; the live query when open.
  const display = open ? query : (value || '');

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
        <input
          value={display}
          placeholder={placeholder || 'Search postal code…'}
          onFocus={() => { setOpen(true); setQuery(''); }}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          style={{
            width: '100%', padding: '8px 30px 8px 30px', borderRadius: 8, fontSize: 13,
            border: `1px solid ${invalid ? '#fca5a5' : '#cbd5e1'}`, outline: 'none',
          }}
        />
        <ChevronDown size={15} style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
      </div>
      {open && (
        <div style={dropdown}>
          {matches.length === 0 ? (
            <div style={{ padding: '10px 12px', fontSize: 12.5, color: '#94a3b8' }}>
              {locations.length === 0
                ? 'No locations configured for this study. Add them in Masters → Locations.'
                : 'No matching postal code.'}
            </div>
          ) : (
            matches.map((l) => (
              <button
                key={l.locationId || `${l.postalCode}-${l.city}`}
                type="button"
                style={row}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onSelect(l); setOpen(false); setQuery(''); }}
              >
                <span style={{ fontWeight: 700 }}>{l.postalCode}</span>
                <span style={{ color: '#64748b' }}>
                  {[l.city, l.district, l.state].filter(Boolean).join(', ')}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

PostalCodeSelect.propTypes = {
  value: PropTypes.string,
  locations: PropTypes.array,
  onSelect: PropTypes.func.isRequired,
  invalid: PropTypes.bool,
  placeholder: PropTypes.string,
};
PostalCodeSelect.defaultProps = { value: '', locations: [], invalid: false };

const dropdown = {
  position: 'absolute', zIndex: 50, top: 'calc(100% + 4px)', left: 0, right: 0,
  maxHeight: 240, overflow: 'auto', background: '#fff',
  border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
};
const row = {
  display: 'flex', flexDirection: 'column', gap: 2, width: '100%', textAlign: 'left',
  padding: '8px 12px', background: 'none', border: 'none', borderBottom: '1px solid #f1f5f9',
  cursor: 'pointer', fontSize: 13,
};
