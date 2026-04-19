import React, { useRef } from 'react';

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  max?: number;
}

export default function TagInput({ tags, onChange, placeholder = 'Type and press Enter…', max = 10 }: TagInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function addTag(raw: string) {
    const rawTokens = raw.split(',').map(s => s.trim()).filter(Boolean);
    if (!rawTokens.length) return;

    let newTags = [...tags];
    let changed = false;

    for (const val of rawTokens) {
      if (!newTags.includes(val) && newTags.length < max) {
        newTags.push(val);
        changed = true;
      }
    }

    if (changed) {
      onChange(newTags);
    }
  }

  function removeTag(idx: number) {
    onChange(tags.filter((_, i) => i !== idx));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    if ((e.key === 'Enter' || e.key === ',') && input.value.trim()) {
      e.preventDefault();
      addTag(input.value);
      input.value = '';
    }
    if (e.key === 'Backspace' && !input.value && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    if (e.currentTarget.value.trim()) {
      addTag(e.currentTarget.value);
      e.currentTarget.value = '';
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const paste = e.clipboardData.getData('text');
    if (paste.includes(',')) {
      e.preventDefault();
      addTag(paste);
    }
  }

  return (
    <div className="tag-input-wrap" onClick={() => inputRef.current?.focus()}>
      {tags.map((tag, i) => (
        <span key={i} className="tag">
          {tag}
          <button
            className="tag-x"
            type="button"
            onClick={(e) => { e.stopPropagation(); removeTag(i); }}
            aria-label={`Remove ${tag}`}
          >
            ×
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        className="tag-text-input"
        placeholder={tags.length === 0 ? placeholder : ''}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onPaste={handlePaste}
        disabled={tags.length >= max}
        aria-label="Add tag"
      />
    </div>
  );
}
