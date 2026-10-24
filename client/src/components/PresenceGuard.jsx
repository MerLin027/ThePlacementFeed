import { useIsPresent } from 'motion/react';

/**
 * Inside AnimatePresence: once its parent is closing (playing its exit animation), the content is
 * hidden from assistive technology and can no longer be focused or clicked, so a closed dialog is
 * gone for everyone at once even while it fades out.
 */
const PresenceGuard = ({ children }) => {
  const present = useIsPresent();
  return (
    <div className="contents" inert={!present || undefined} aria-hidden={!present || undefined}>
      {children}
    </div>
  );
};

export default PresenceGuard;
