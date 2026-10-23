import { DriveGridSkeleton, TimelineSkeleton } from './Skeleton';

/**
 * Loading state for the drive list and timeline. Shows the page's shape with
 * skeletons; after a few seconds without a response (Render free-tier cold
 * start) it explains the wait instead of leaving the user guessing.
 */
const ColdStartLoader = ({ isColdStart, variant = 'cards' }) => (
  <div>
    <div role="status" aria-live="polite" className={isColdStart ? 'mb-md' : 'sr-only'}>
      {isColdStart ? (
        <div className="flex items-start gap-xs p-sm bg-surface-container-low border border-outline-variant rounded-xl">
          <span className="material-symbols-outlined text-[20px] text-primary shrink-0" aria-hidden="true">hourglass_top</span>
          <div>
            <p className="font-label-md text-label-md text-on-surface">Waking up the server…</p>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              It runs on a free tier and can take up to a minute to start after a quiet spell. Your drives will appear here.
            </p>
          </div>
        </div>
      ) : (
        'Loading drives'
      )}
    </div>
    {variant === 'timeline' ? <TimelineSkeleton /> : <DriveGridSkeleton />}
  </div>
);

export default ColdStartLoader;
