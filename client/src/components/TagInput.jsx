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
      <div className="input-field flex flex-wrap gap-2 min-h-[42px] !p-2 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary">
        {tags.map((tag, index) => (
          <span
            key={index}
            className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-primary/5 text-primary font-label-sm text-label-sm rounded-lg border border-primary/20"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(index)}
              className="text-primary/50 hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">close</span>
            </button>
          </span>
        ))}
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? 'Type and press Enter to add tags' : ''}
          className="flex-1 min-w-[120px] outline-none border-none bg-transparent font-body-sm text-body-sm placeholder-outline"
        />
      </div>
    </div>
  );
};

export default TagInput;
