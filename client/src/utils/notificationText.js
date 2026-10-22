// Wording and icon (Material Symbols name) for each notification type.
// `tone` drives colour: 'warning' for postponements, 'success' for good news.

const APPLICATION_TONE = {
  Shortlisted: 'success',
  Interviewing: 'success',
  Offered: 'success',
  Rejected: 'neutral',
  Applied: 'neutral',
};

export const describeNotification = (n) => {
  switch (n.type) {
    case 'new':
      return { text: `New drive: ${n.company}`, icon: 'add_circle', tone: 'info' };
    case 'statusChange':
      return {
        text: n.status ? `${n.company} is now ${n.status}` : `${n.company} status updated`,
        icon: 'sync',
        tone: 'info',
      };
    case 'postponed':
      return { text: `${n.company} has been postponed`, icon: 'pause_circle', tone: 'warning' };
    case 'unpostponed':
      return { text: `${n.company} is back on schedule`, icon: 'play_circle', tone: 'info' };
    case 'edit':
      return { text: `${n.company} details were updated`, icon: 'edit_note', tone: 'info' };
    case 'applicationStatus':
      return {
        text: `Your application to ${n.company}: ${n.status}`,
        icon: 'how_to_reg',
        tone: APPLICATION_TONE[n.status] || 'neutral',
      };
    default:
      return { text: `${n.company} was updated`, icon: 'notifications', tone: 'info' };
  }
};

export const timeAgo = (iso) => {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};
