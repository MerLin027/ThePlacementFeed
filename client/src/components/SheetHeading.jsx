/**
 * Heading block for the sign-in style pages: an optional small line above the title (in the brand
 * colour), the title, and an optional note on the right, aligned to the title's baseline.
 */
const SheetHeading = ({ as: Tag = 'h2', id, kicker, kickerIcon, title, aside }) => (
  <div className="flex items-end justify-between gap-x-sm">
    <div className="min-w-0">
      {kicker && (
        <p className="mb-1 inline-flex items-center gap-1 font-label-sm text-label-sm font-semibold uppercase tracking-wider text-primary">
          {kickerIcon && <span className="material-symbols-outlined text-[16px]" aria-hidden="true">{kickerIcon}</span>}
          {kicker}
        </p>
      )}
      <Tag id={id} className="font-headline-md text-headline-md text-on-surface tracking-tight">{title}</Tag>
    </div>
    {aside}
  </div>
);

export default SheetHeading;
