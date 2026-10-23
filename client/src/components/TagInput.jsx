import { useState } from 'react';

// Free-form tags: type and press Enter (or comma) to add; Backspace on an empty input removes the last.
const TagInput = ({ id, label = 'Tags', tags = [], onChange }) => {
  const [inputValue, setInputValue] = useState('');

  const addTag = (tag) => {
    const trimmed = tag.trim();
    if (trimmed && !tags.includes(trimmed) && tags.length < 20) {
      onChange([...tags, trimmed]);
    }
    setInputValue('');
  };

  const removeTag = (index) => {
    onChange(tags.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  };

  return (
    <div className="w-full">
      {/* Grows with its content (input-field's fixed 44px height is overridden) */}
      <div className="input-field !h-auto min-h-[44px] flex flex-wrap items-center gap-2 !p-2 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary">
        {tags.map((tag, index) => (
          <span
            key={`${tag}-${index}`}
            className="inline-flex items-center gap-1 pl-2.5 bg-primary/5 text-primary font-label-sm text-label-sm rounded-lg border border-primary/20"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(index)}
              aria-label={`Remove tag ${tag}`}
              className="w-8 h-8 flex items-center justify-center rounded-md text-primary/70 hover:text-primary hover:bg-primary/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">close</span>
            </button>
          </span>
        ))}
        <input
          id={id}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => inputValue && addTag(inputValue)}
          aria-label={label}
          placeholder={tags.length === 0 ? 'Type and press Enter to add tags' : 'Add another'}
          maxLength={50}
          className="flex-1 min-w-[140px] h-[36px] outline-none border-none bg-transparent font-body-sm text-body-sm placeholder-outline"
        />
      </div>
    </div>
  );
};

export default TagInput;
