import { Link } from 'react-router';
import { usePageTitle } from '../hooks/usePageTitle';

const NotFound = () => {
  usePageTitle('Page not found');
  return (
    <div className="w-full max-w-container-max mx-auto px-sm md:px-lg py-xl flex items-center justify-center min-h-[60vh]">
      <div className="text-center max-w-(--container-md)">
        <div className="w-20 h-20 bg-surface-container rounded-full flex items-center justify-center mx-auto mb-md">
          <span className="material-symbols-outlined text-[40px] text-on-surface-variant" aria-hidden="true">explore_off</span>
        </div>
        <p className="font-label-md text-label-md text-on-surface-variant mb-base">Error 404</p>
        <h1 className="font-headline-md text-headline-md text-on-surface mb-xs">Page not found</h1>
        <p className="font-body-md text-body-md text-on-surface-variant mb-lg">
          This link doesn&apos;t lead anywhere. It may be mistyped, or the page may have moved.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-xs">
          <Link to="/" className="btn-primary">Browse drives</Link>
          <Link to="/timeline" className="btn-secondary">View timeline</Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
