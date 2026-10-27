/**
 * Heading block for the sign-in style pages: an optional small line above the title, the title, an
 * optional note on the right, and an optional subtitle. `subtitleLines` reserves that many lines for
 * the subtitle, so two halves side by side start their content at the same height. `titleProps` go
 * on the title element (e.g. a ref and tabIndex to move focus to it).
 */
const SheetHeading = ({ as: Tag = 'h2', id, kicker, kickerIcon, title, subtitle, subtitleLines, aside, titleProps }) => (
  <div>
    <div className="flex items-end justify-between gap-x-sm">
      <div className="min-w-0">
        {kicker && (
          <p className="mb-1 inline-flex items-center gap-1 font-label-sm text-label-sm font-semibold uppercase tracking-wider text-primary">
            {kickerIcon && <span className="material-symbols-outlined text-[16px]" aria-hidden="true">{kickerIcon}</span>}
            {kicker}
          </p>
        )}
        <Tag
          id={id}
          {...titleProps}
          className={`font-headline-md text-[1.75rem] leading-9 font-semibold tracking-tight text-on-surface ${titleProps?.className || ''}`}
        >
          {title}
        </Tag>
      </div>
      {aside}
    </div>
    {subtitle && (
      <p
        className="mt-1.5 font-body-sm text-body-sm text-on-surface-variant"
        style={subtitleLines ? { minHeight: `${subtitleLines * 1.25}rem` } : undefined}
      >
        {subtitle}
      </p>
    )}
  </div>
);

export default SheetHeading;
