const StatusBadge = ({ status, isPostponed }) => {
  if (isPostponed) {
    return (
      <span className="inline-flex items-center font-label-sm text-label-sm px-3 py-1 rounded-full uppercase tracking-wider bg-red-100 text-red-700">
        Postponed
      </span>
    );
  }

  const config = {
    Upcoming: 'bg-primary-fixed text-on-primary-fixed',
    Ongoing: 'bg-amber-100 text-amber-700',
    Completed: 'bg-emerald-100 text-emerald-700',
  };

  const style = config[status] || config.Upcoming;

  return (
    <span
      className={`inline-flex items-center font-label-sm text-label-sm px-3 py-1 rounded-full uppercase tracking-wider ${style}`}
    >
      {status}
    </span>
  );
};

export default StatusBadge;
