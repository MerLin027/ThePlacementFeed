const ColdStartLoader = ({ isColdStart }) => {
  return (
    <div className="flex flex-col items-center justify-center py-xl">
      {/* Spinner */}
      <div className="relative mb-md">
        <div className="w-12 h-12 rounded-full border-4 border-outline-variant" />
        <div className="w-12 h-12 rounded-full border-4 border-primary-container border-t-transparent animate-spin absolute inset-0" />
      </div>

      {isColdStart ? (
        <>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mb-xs">
            Waking up the server...
          </h3>
          <p className="font-body-sm text-body-sm text-on-surface-variant text-center max-w-md">
            The server is hosted on a free tier and may take up to a minute to start up after being idle. Thanks for your patience!
          </p>
        </>
      ) : (
        <p className="font-body-sm text-body-sm text-on-surface-variant">Loading placements...</p>
      )}
    </div>
  );
};

export default ColdStartLoader;
