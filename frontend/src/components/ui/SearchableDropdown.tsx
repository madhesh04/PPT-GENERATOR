import React, { useState, useRef, useEffect } from 'react';

interface Option {
  value: string;
  label: string;
}

interface SearchableDropdownProps {
  id: string;
  label?: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchable?: boolean;
  style?: React.CSSProperties;
}

export default function SearchableDropdown({
  id,
  label,
  value,
  options,
  onChange,
  placeholder = 'Select…',
  searchable = true,
  style,
}: SearchableDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);
  const displayText = selected ? selected.label : placeholder;

  const filtered = searchable
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  function pick(opt: Option) {
    onChange(opt.value);
    setOpen(false);
    setSearch('');
  }

  return (
    <div className={`sd-wrap${open ? ' open' : ''}`} id={id} ref={wrapRef} style={style}>
      <div
        className={`sd-trigger${open ? ' open' : ''}`}
        onClick={() => setOpen(!open)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {label && <span className="sd-label-txt">{label}</span>}
        <span className="sd-value">{displayText}</span>
        <svg className="sd-chevron" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      <div className="sd-panel" role="listbox">
        {searchable && (
          <div className="sd-search-row">
            <svg className="sd-search-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              className="sd-search-inp"
              type="text"
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              aria-label="Search options"
            />
          </div>
        )}
        <div className="sd-list">
          {filtered.map((opt) => (
            <div
              key={opt.value}
              className={`sd-opt${opt.value === value ? ' selected' : ''}`}
              onClick={() => pick(opt)}
              role="option"
              aria-selected={opt.value === value}
            >
              {opt.label}
              {opt.value === value && (
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              )}
            </div>
          ))}
          {filtered.length === 0 && <div className="sd-empty">No results</div>}
        </div>
      </div>
    </div>
  );
}
