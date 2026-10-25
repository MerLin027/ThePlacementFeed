/**
 * A native <select> drawn as a slim 36px pill inside a 44px tap area (the pill is a layer behind the
 * transparent select, so the whole 44px stays clickable and the browser's own picker and keyboard
 * handling are kept). Used for compact choices in toolbars, table rows and the selection bar.
 *
 * tone: 'outline' (default), 'dark' (on the inverse-surface selection bar), or a class string for
 * the pill (e.g. a status colour from STATUS_META). size: 'sm' (36px pill, default) or 'md' (the full
 * 44px, to line up with toolbar buttons).
 */
const TONES = {
  outline: 'bg-surface-container-lowest border border-outline-variant shadow-soft group-hover/ps:border-outline',
  dark: 'bg-white/10 group-hover/ps:bg-white/15',
};

const PillSelect = ({ id, value, onChange, options, label, icon, tone = 'outline', size = 'sm', disabled = false, className = '' }) => (
  <span className={`group/ps relative isolate inline-flex items-center h-[44px] ${disabled ? 'opacity-60' : ''} ${className}`}>
    <span
      className={`absolute inset-x-0 ${size === 'md' ? 'inset-y-0' : 'inset-y-1'} -z-10 rounded-full transition-colors duration-200 group-has-[:focus-visible]/ps:ring-2 group-has-[:focus-visible]/ps:ring-primary ${TONES[tone] || tone}`}
      aria-hidden="true"
    />
    {icon && (
      <span className="material-symbols-outlined pointer-events-none absolute left-3 text-[18px] opacity-80" aria-hidden="true">
        {icon}
      </span>
    )}
    <select
      id={id}
      aria-label={label}
      value={value}
      onChange={onChange}
      disabled={disabled}
      className={`appearance-none w-full h-full bg-transparent text-inherit ${icon ? 'pl-9' : 'pl-3.5'} pr-8 rounded-full font-label-md text-label-md cursor-pointer focus:outline-hidden disabled:cursor-not-allowed [&>option]:bg-surface-container-lowest [&>option]:text-on-surface`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
    <span className="material-symbols-outlined pointer-events-none absolute right-2.5 text-[18px] opacity-70 transition-transform duration-200 group-hover/ps:translate-y-px" aria-hidden="true">
      expand_more
    </span>
  </span>
);

export default PillSelect;
