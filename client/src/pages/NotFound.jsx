import { Link } from 'react-router';

const NotFound = () => {
  return (
    <div className="w-full max-w-container-max mx-auto px-sm md:px-lg py-xl flex items-center justify-center min-h-[60vh]">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-surface-container rounded-full flex items-center justify-center mx-auto mb-md">
          <span className="material-symbols-outlined text-[40px] text-outline">search_off</span>
        </div>
        <h1 className="font-display-lg text-display-lg text-on-surface mb-xs">404</h1>
        <h2 className="font-headline-md text-headline-md text-on-surface mb-xs">Page not found</h2>
        <p className="font-body-md text-body-md text-on-surface-variant mb-lg">
          The page you're looking for doesn't exist or may have been moved.
        </p>
        <Link to="/" className="btn-primary">
          Back to Home
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
