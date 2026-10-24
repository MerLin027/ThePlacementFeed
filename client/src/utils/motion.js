// Shared Motion settings, matching the CSS tokens in index.css (ease-out-soft, 150–240 ms).
// Under the OS "reduce motion" setting MotionConfig (App.jsx) keeps only the opacity fades.

export const EASE_OUT_SOFT = [0.22, 1, 0.36, 1];

// Dialogs: the wrapper stays while its children play their exit, the backdrop fades, the panel rises
export const dialogOverlay = { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 1 }, transition: { duration: 0.18 } };
export const dialogBackdrop = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.15 } };
export const dialogPanel = {
  initial: { opacity: 0, y: 8, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 4, scale: 0.98 },
  transition: { duration: 0.18, ease: EASE_OUT_SOFT },
};

// Menus and panels that drop down
export const dropDown = {
  initial: { opacity: 0, y: -6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.16, ease: EASE_OUT_SOFT },
};

// The sliding "current page" pill in the navbar
export const pillSpring = { type: 'spring', stiffness: 520, damping: 42 };
