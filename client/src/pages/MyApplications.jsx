import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import api from '../api/axios';
import { ApplicationStatusPill } from '../components/ApplyButton';
import { FormAlert } from '../components/AuthCard';
import Pagination from '../components/Pagination';
import { PageSpinner } from '../components/RequireRole';
import { parseApiError } from '../utils/formErrors';
import { usePageTitle } from '../hooks/usePageTitle';

const PAGE_SIZE = 20;

const formatDate = (d) =>
  new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

// Every in-app application the student has made, newest first, with its current status
const MyApplications = () => {
  usePageTitle('My applications');
  const [page, setPage] = useState(1);
  // The last response, tagged with the page it answers: while it is for another page, that page is
  // still loading (derived, so the effect never has to reset state before fetching)
  const [result, setResult] = useState({ page: null, applications: [], pagination: { page: 1, totalPages: 0, total: 0 }, error: '' });
  const loading = result.page !== page;
  const { applications, pagination } = result;
  const error = loading ? '' : result.error;

  useEffect(() => {
    const controller = new AbortController();
    api
      .get('/api/applications/my', { params: { page, limit: PAGE_SIZE }, signal: controller.signal })
      .then((res) => {
        setResult({ page, applications: res.data.data, pagination: res.data.pagination, error: '' });
      })
      .catch((err) => {
        if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
        const message = parseApiError(err, "We couldn't load your applications.").message;
        setResult((prev) => ({ ...prev, page, error: message }));
      });
    return () => controller.abort();
  }, [page]);

  return (
    <div className="max-w-3xl mx-auto w-full px-sm md:px-lg py-sm md:py-lg">
      <div className="mb-md">
        <h1 className="font-headline-md text-headline-md text-on-surface">My applications</h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-base">
          Drives you applied to through The Placement Feed, and where each one stands.
        </p>
      </div>

      {error && <FormAlert>{error}</FormAlert>}

      {loading ? (
        <PageSpinner />
      ) : !error && applications.length === 0 ? (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-soft px-md py-lg text-center">
          <span className="material-symbols-outlined text-[40px] text-outline" aria-hidden="true">work_history</span>
          <h2 className="font-headline-sm text-headline-sm text-on-surface mt-xs">No applications yet</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-base max-w-(--container-md) mx-auto">
            When you apply to a drive here, it shows up on this page with its latest status.
          </p>
          <Link to="/" className="btn-primary mt-md min-h-[44px]">Browse drives</Link>
        </div>
      ) : (
        <ul className="space-y-xs" aria-label="Your applications">
          {applications.map((a, i) => (
            <li key={a.id} className="group/row motion-safe:rise-in-stagger" style={{ '--i': i }}>
              {a.driveId ? (
                <Link
                  to={`/placement/${a.driveId}`}
                  className="flex flex-col sm:flex-row sm:items-center gap-xs sm:gap-sm bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-soft p-sm group-hover/row:shadow-lift group-hover/row:border-primary-30 group-hover/row:-translate-y-0.5 transition-control focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-label-md text-label-md text-on-surface truncate">{a.company}</p>
                    <p className="font-body-sm text-body-sm text-on-surface-variant truncate">{a.role}</p>
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant whitespace-nowrap">
                    Applied {formatDate(a.submittedAt)}
                  </p>
                  <ApplicationStatusPill status={a.status} />
                </Link>
              ) : (
                <div className="flex items-center gap-sm bg-surface-container-low border border-outline-variant rounded-2xl p-sm">
                  <p className="flex-1 font-body-sm text-body-sm text-on-surface-variant">This drive was removed.</p>
                  <ApplicationStatusPill status={a.status} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <Pagination page={pagination.page} totalPages={pagination.totalPages} onPageChange={setPage} />
    </div>
  );
};

export default MyApplications;
