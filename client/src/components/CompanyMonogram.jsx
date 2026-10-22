// Company initials on a tinted tile — replaces the identical building icon on
// every card so drives are easier to tell apart at a glance. The tint is
// derived from the name, so a company always gets the same colour.
const TINTS = [
  'bg-primary-fixed text-on-primary-fixed',
  'bg-amber-100 text-amber-900',
  'bg-emerald-100 text-emerald-900',
  'bg-sky-100 text-sky-900',
  'bg-rose-100 text-rose-900',
  'bg-violet-100 text-violet-900',
];

const initials = (name = '') => {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
};

const tintFor = (name = '') => {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return TINTS[hash % TINTS.length];
};

const SIZES = {
  md: 'w-12 h-12 text-[1.05rem]',
  sm: 'w-10 h-10 text-[0.95rem]',
};

const CompanyMonogram = ({ name, size = 'md' }) => (
  <span
    className={`${SIZES[size]} ${tintFor(name)} rounded-lg flex items-center justify-center font-headline-sm font-semibold flex-shrink-0 select-none`}
    aria-hidden="true"
  >
    {initials(name)}
  </span>
);

export default CompanyMonogram;
