import { useState, useEffect, lazy, Suspense } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router';
import api from '../api/axios';
import StatusBadge from '../components/StatusBadge';
import CompanyMonogram from '../components/CompanyMonogram';
import { TYPE_META } from '../constants/applications';
import { deadlineInfo, DEADLINE_TONE_CLASS } from '../utils/deadline';
import { DetailApplyPanel } from '../components/ApplyButton';
import ApplyModal from '../components/ApplyModal';
import { useApplyState } from '../hooks/useApplyState';
import { useAuth } from '../context/auth';
import { useCatalog } from '../stores/catalog';
import { describeAcademicRequirement } from '../utils/eligibility';
import { DetailSkeleton, Skeleton } from '../components/Skeleton';
import { usePageTitle } from '../hooks/usePageTitle';

const JobDescription = lazy(() => import('../components/JobDescription'));



const PlacementDetail = () => {
  const { formatBranches } = useCatalog();
  const { id } = useParams();
  const navigate = useNavigate();
  const [placement, setPlacement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [isApplyOpen, setIsApplyOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  usePageTitle(placement ? `${placement.company} — ${placement.role}` : 'Drive details');

  useEffect(() => {
    const abortController = new AbortController();

    const fetchPlacement = async () => {
      setLoading(true);
      setError('');
      setNotFound(false);
      try {
        const res = await api.get(`/api/drives/${id}`, {
          signal: abortController.signal
        });
        setPlacement(res.data.data);
        setLoading(false);
      } catch (err) {
        if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
        // 404 = deleted drive, 400 = malformed id in the URL; both mean "not here"
        if (err.response?.status === 404 || err.response?.status === 400) setNotFound(true);
        else setError("We couldn't load this drive. Check your connection and try again.");
        setLoading(false);
      }
    };
    fetchPlacement();

    return () => abortController.abort();
  }, [id, reloadKey]);

  // ?apply=1 (from a card, or after login/profile) opens the form once the drive is eligible
  const applyRequested = searchParams.get('apply') === '1';
  const applyKind = useApplyState(placement || { _id: id }).kind;
  const { loading: authLoading } = useAuth();
  // Wait for the drive and the session check (or a logged-in student would look logged out). Each
  // ?apply=1 is handled once, during render; the effect below only removes it from the URL.
  const applyReady = Boolean(placement) && applyRequested && !authLoading;
  const [applyHandled, setApplyHandled] = useState(false);
  if (applyReady && !applyHandled) {
    setApplyHandled(true);
    if (applyKind === 'apply') setIsApplyOpen(true);
  } else if (!applyRequested && applyHandled) {
    setApplyHandled(false);
  }
  useEffect(() => {
    if (!applyReady) return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('apply');
      return next;
    }, { replace: true });
  }, [applyReady, setSearchParams]);

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatDateShort = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  if (loading) return <DetailSkeleton />;

  if (notFound || error) {
    return (
      <div className="w-full max-w-container-max mx-auto px-md md:px-lg py-xl text-center">
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-soft p-xl max-w-(--container-lg) mx-auto">
          <span className="material-symbols-outlined text-[48px] text-outline mb-sm block" aria-hidden="true">
            {notFound ? 'event_busy' : 'cloud_off'}
          </span>
          <h1 className="font-headline-md text-headline-md text-on-surface mb-xs">
            {notFound ? 'This drive is no longer available' : "Couldn't load this drive"}
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant mb-md">
            {notFound
              ? 'It may have been removed by the CDPC, or the link is incorrect.'
              : error}
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-xs">
            {!notFound && (
              <button type="button" onClick={() => setReloadKey((k) => k + 1)} className="btn-primary min-h-[44px]">
                Try again
              </button>
            )}
            <button type="button" onClick={() => navigate('/')} className={`${notFound ? 'btn-primary' : 'btn-secondary'} min-h-[44px]`}>
              Browse drives
            </button>
          </div>
        </div>
      </div>
    );
  }

  const closing = placement.status === 'Upcoming' && !placement.isPostponed ? deadlineInfo(placement.deadline) : null;

  const typeMeta = TYPE_META[placement.type];

  return (
    // py-sm (16px top+bottom) — tighter than py-lg/py-md; gives the layout room to breathe without wasting vertical space
    <div className="w-full max-w-container-max mx-auto px-sm md:px-lg py-sm">
      {/* Outer grid: gap-xs vertically between the breadcrumb row and the columns */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-xs md:gap-sm items-start">

        {/* Back navigation breadcrumb */}
        <div className="md:col-span-12">
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-xs min-h-[44px] pr-xs font-body-sm text-body-sm text-on-surface-variant hover:text-primary transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-full group/back"
          >
            <span className="material-symbols-outlined text-[18px] transition-transform duration-200 ease-snappy group-hover/back:[transform:translateX(-3px)]" aria-hidden="true">arrow_back</span>
            Back to drives
          </button>
        </div>

        {/* Left column. On mobile it dissolves (display: contents) so cards follow the
            order classes: apply → eligibility → dates → process → description → tags */}
        <div className="contents md:flex md:flex-col md:col-span-4 md:gap-sm">

          {/* 1. Company Info Card */}
          <div className="relative order-1 md:order-0 bg-surface-container-lowest border border-surface-variant rounded-2xl shadow-soft p-sm flex flex-col motion-safe:rise-in-stagger" style={{ '--i': 0 }}>
            <div className="mb-xs">
              <CompanyMonogram name={placement.company} size="sm" />
            </div>
            <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface mb-[2px]">{placement.company}</h1>
            <p className="font-headline-sm text-headline-sm text-on-surface-variant mb-xs">{placement.role}</p>
            <div className="flex items-baseline gap-xs mb-xs">
              <span className="font-headline-md text-headline-md text-primary tabular-nums">₹{placement.ctc} LPA</span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">(CTC)</span>
            </div>
            <div className="flex flex-wrap gap-xs">
              {placement.type && (
                <span className={`font-label-md text-label-md px-2.5 py-0.5 rounded-full ${typeMeta?.pill || TYPE_META['Full-Time'].pill}`}>
                  {placement.type}
                </span>
              )}
              <StatusBadge status={placement.status} isPostponed={placement.isPostponed} />
            </div>
            <DetailApplyPanel drive={placement} onApply={() => setIsApplyOpen(true)} />
            {/* Timestamp footnote */}
            <div className="border-t border-surface-variant mt-xs pt-xs">
              <p className="font-label-sm text-label-sm text-outline font-normal tracking-normal">
                Added {formatDate(placement.createdAt)}
                {placement.updatedAt !== placement.createdAt && (
                  <span> · Updated {formatDate(placement.updatedAt)}</span>
                )}
              </p>
            </div>
          </div>

          {/* 2. Important Dates Card */}
          <section className="order-3 md:order-0 bg-surface-container-lowest border border-surface-variant rounded-2xl shadow-soft p-sm motion-safe:rise-in-stagger" style={{ '--i': 2 }} aria-labelledby="dates-heading">
            <h2 id="dates-heading" className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-xs border-b border-surface-variant pb-xs">
              Important Dates
            </h2>
            {closing && (
              <p className={`inline-flex items-center gap-1 mb-xs px-2 py-0.5 rounded-md border font-label-sm text-label-sm ${DEADLINE_TONE_CLASS[closing.tone]}`}>
                <span className="material-symbols-outlined text-[16px]" aria-hidden="true">schedule</span>
                {closing.label}
              </p>
            )}
            {placement.deadline && (
              <div className="flex justify-between items-center py-[6px]">
                <span className="font-body-sm text-body-sm text-on-surface-variant">Application deadline</span>
                <span className="font-label-md text-label-md text-on-surface">{formatDateShort(placement.deadline)}</span>
              </div>
            )}
            <div className="flex justify-between items-center py-[6px]">
              <span className="font-body-sm text-body-sm text-on-surface-variant">Drive date</span>
              <span className="font-label-md text-label-md text-on-surface">{formatDateShort(placement.driveDate)}</span>
            </div>
          </section>

          {/* 3. Selection process Card */}
          {placement.selectionRounds?.length > 0 && (
            <section className="order-4 md:order-0 bg-surface-container-lowest border border-surface-variant rounded-2xl shadow-soft p-sm motion-safe:rise-in-stagger" style={{ '--i': 3 }}>
              <h2 className="font-headline-sm text-headline-sm text-on-surface mb-xs pb-xs border-b border-surface-variant">
                Selection Process
              </h2>
              <div className="flex flex-col gap-xs relative">
                <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-surface-variant hidden sm:block" />
                {placement.selectionRounds.map((step, index) => (
                  <div key={index} className="flex items-start gap-xs relative z-10">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center font-label-sm text-label-sm shrink-0 mt-0.5 bg-primary-container text-on-primary-container"
                    >
                      {index + 1}
                    </div>
                    <div>
                      <h4 className="font-label-md text-label-md text-on-surface">
                        {step.roundName}
                      </h4>
                      {step.roundDescription && (
                        <p className="font-body-sm text-body-sm text-on-surface-variant">{step.roundDescription}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

        </div>

        {/* Right column (contents on mobile, see above) */}
        <div className="contents md:flex md:flex-col md:col-span-8 md:gap-sm">

          {/* 1. Eligibility Section */}
          <section className="order-2 md:order-0 bg-surface-container-lowest border border-surface-variant rounded-2xl shadow-soft p-sm motion-safe:rise-in-stagger" style={{ '--i': 1 }}>
            <div className="flex items-center gap-xs mb-xs">
              <span className="material-symbols-outlined text-secondary text-[20px]" aria-hidden="true">verified_user</span>
              <h2 className="font-headline-sm text-headline-sm text-on-surface">Eligibility Criteria</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-xs">
              <div className="flex flex-col bg-surface-container-low p-xs rounded-xl">
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase mb-[3px]">
                  Academic requirement
                </span>
                <span className="font-body-md text-body-md text-on-surface">
                  {describeAcademicRequirement(placement.eligibility)}
                </span>
              </div>
              <div className="flex flex-col bg-surface-container-low p-xs rounded-xl">
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase mb-[3px]">
                  Eligible Branches
                </span>
                <span className="font-body-md text-body-md text-on-surface">
                  {placement.eligibility?.branches?.length > 0
                    ? formatBranches(placement.eligibility.branches)
                    : 'All branches'}
                </span>
              </div>
            </div>
          </section>

          {/* 2. Job Description Section */}
          {placement.jdDescription && (
            <section className="order-5 md:order-0 bg-surface-container-lowest border border-surface-variant rounded-2xl shadow-soft p-sm motion-safe:rise-in-stagger" style={{ '--i': 4 }}>
              <h2 className="font-headline-sm text-headline-sm text-on-surface mb-xs pb-xs border-b border-surface-variant">
                Job Description
              </h2>
              <Suspense fallback={<div className="space-y-xs" aria-hidden="true"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-5/6" /><Skeleton className="h-4 w-2/3" /></div>}>
                <JobDescription source={placement.jdDescription} />
              </Suspense>
            </section>
          )}

          {/* Tags */}
          {placement.tags?.length > 0 && (
            <section className="order-6 md:order-0 bg-surface-container-lowest border border-surface-variant rounded-2xl shadow-soft p-sm motion-safe:rise-in-stagger" style={{ '--i': 5 }}>
              <h2 className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-xs">Tags</h2>
              <div className="flex flex-wrap gap-xs">
                {placement.tags.map((tag, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 font-label-sm text-label-sm bg-surface-container text-on-surface-variant rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </section>
          )}

        </div>



      </div>

      {isApplyOpen && (
        <ApplyModal drive={placement} isOpen={isApplyOpen} onClose={() => setIsApplyOpen(false)} />
      )}
    </div>
  );
};

export default PlacementDetail;
