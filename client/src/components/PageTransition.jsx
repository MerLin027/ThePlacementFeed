import { useLocation } from 'react-router';

/**
 * Fades each new page in (pathname changes only, not the query string). h-full keeps
 * pages that centre themselves in <main> (auth cards, 404) working as before.
 */
const PageTransition = ({ children }) => {
  const { pathname } = useLocation();
  return (
    <div key={pathname} className="h-full motion-safe:animate-page-in">
      {children}
    </div>
  );
};

export default PageTransition;
