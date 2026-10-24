import { useLocation } from 'react-router';

/**
 * Fades each new page in (pathname changes only, not the query string). flex-1 fills the space
 * above the footer, so pages that centre themselves (auth cards, 404) still centre in the window.
 */
const PageTransition = ({ children }) => {
  const { pathname } = useLocation();
  return (
    <div key={pathname} className="flex-1 motion-safe:animate-page-in">
      {children}
    </div>
  );
};

export default PageTransition;
