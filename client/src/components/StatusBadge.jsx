const StatusBadge = ({ status, isPostponed }) => {
  if (isPostponed) {
    return (
      <span className="inline-flex items-center font-label-md text-label-md px-2.5 py-0.5 rounded-full bg-red-100 text-red-800">
        Postponed
      </span>
    );
  }

  const config = {
    Upcoming: 'bg-primary-fixed text-on-primary-fixed',
    Ongoing: 'bg-amber-100 text-amber-800',
    Completed: 'bg-emerald-100 text-emerald-800',
  };

  const style = config[status] || config.Upcoming;

  return (
    <span
      className={`inline-flex items-center font-label-md text-label-md px-2.5 py-0.5 rounded-full ${style}`}
    >
      {status}
    </span>
  );
};

export default StatusBadge;
