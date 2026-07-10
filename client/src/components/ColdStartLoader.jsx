const ColdStartLoader = ({ isColdStart }) => {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      {/* Spinner */}
      <div className="relative mb-6">
        <div className="w-12 h-12 rounded-full border-4 border-slate-200" />
        <div className="w-12 h-12 rounded-full border-4 border-brand-600 border-t-transparent animate-spin absolute inset-0" />
      </div>

      {isColdStart ? (
        <>
          <h3 className="text-lg font-semibold text-slate-700 mb-2">
            Waking up the server...
          </h3>
          <p className="text-sm text-slate-500 text-center max-w-md">
            The server is hosted on a free tier and may take up to a minute to start up after being idle. Thanks for your patience!
          </p>
        </>
      ) : (
        <p className="text-sm text-slate-500">Loading placements...</p>
      )}
    </div>
  );
};

export default ColdStartLoader;
