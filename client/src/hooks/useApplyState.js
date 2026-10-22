import { useAuth } from '../context/AuthContext';
import { useMyApplications } from '../context/MyApplicationsContext';
import { getApplyState } from '../utils/applyState';

// Apply-control state for one drive, from the current student and their applications
export const useApplyState = (drive) => {
  const { student } = useAuth();
  const { byDrive } = useMyApplications();
  return getApplyState({ drive, student, application: byDrive.get(drive._id) });
};
