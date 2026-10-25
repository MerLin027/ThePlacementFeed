/**
 * Heading block for each half of the sign-in sheet: an optional small line above the title, the
 * title, an optional note on the right, and the heavy rule. Every block has the same minimum
 * height, so the rules of neighbouring halves line up across the sheet.
 */
const SheetHeading = ({ as: Tag = 'h2', id, kicker, title, aside }) => (
  <div className="min-h-[3.75rem] flex items-end justify-between gap-x-sm pb-xs border-b-2 border-on-surface">
    <div className="min-w-0">
      {kicker && <p className="font-body-sm text-body-sm text-on-surface-variant">{kicker}</p>}
      <Tag id={id} className="font-headline-md text-headline-md text-on-surface">{title}</Tag>
    </div>
    {aside}
  </div>
);

export default SheetHeading;
