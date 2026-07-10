import { useState } from 'react';

const TagInput = ({ tags = [], onChange }) => {
  const [inputValue, setInputValue] = useState('');

  const addTag = (tag) => {
    const trimmed = tag.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInputValue('');
  };

  const removeTag = (index) => {
    onChange(tags.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  };

  return (
    <div className="w-full">
      <div className="input-field flex flex-wrap gap-2 min-h-[42px] !p-2 focus-within:ring-2 focus-within:ring-brand-500 focus-within:border-brand-500">
        {tags.map((tag, index) => (
          <span
            key={index}
            className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-brand-50 text-brand-700 text-sm rounded-md border border-brand-200"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(index)}
              className="text-brand-400 hover:text-brand-600 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? 'Type and press Enter to add tags' : ''}
          className="flex-1 min-w-[120px] outline-none border-none bg-transparent text-sm placeholder-slate-400"
        />
      </div>
    </div>
  );
};

export default TagInput;
