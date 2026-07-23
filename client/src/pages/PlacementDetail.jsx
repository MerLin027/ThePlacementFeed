import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import StatusBadge from '../components/StatusBadge';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const PlacementDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [placement, setPlacement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const abortController = new AbortController();

    const fetchPlacement = async () => {
      try {
        const res = await api.get(`/api/placements/${id}`, {
          signal: abortController.signal
        });
        setPlacement(res.data.data);
      } catch (err) {
        if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
        setError(err.response?.data?.message || 'Failed to load placement');
      } finally {
        setLoading(false);
      }
    };
    fetchPlacement();

    return () => abortController.abort();
  }, [id]);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-4 border-outline-variant" />
          <div className="w-12 h-12 rounded-full border-4 border-primary-container border-t-transparent animate-spin absolute inset-0" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-container-max mx-auto px-md md:px-lg py-xl text-center">
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-xl">
          <span className="material-symbols-outlined text-[48px] text-error mb-md block">error</span>
          <h2 className="font-headline-md text-headline-md text-on-surface mb-xs">Oops!</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mb-md">{error}</p>
          <button onClick={() => navigate('/')} className="btn-primary">
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const typeConfig = {
    'Full-Time': 'bg-primary-container/10 text-primary',
    'Internship': 'bg-surface-container-high text-on-surface-variant border border-surface-variant',
    '6M Intern + FTE': 'bg-tertiary-container/10 text-tertiary',
  };

  return (
    // py-sm (16px top+bottom) — tighter than py-lg/py-md; gives the layout room to breathe without wasting vertical space
    <div className="w-full max-w-container-max mx-auto px-sm md:px-lg py-sm">
      {/* Outer grid: gap-xs vertically between the breadcrumb row and the columns */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-xs md:gap-sm items-start">

        {/* Back navigation breadcrumb — no negative margin needed; gap-xs handles spacing */}
        <div className="md:col-span-12">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-xs font-body-sm text-body-sm text-on-surface-variant hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-sm"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Back to Drives
          </button>
        </div>

        {/* Left Column */}
        <div className="md:col-span-4 flex flex-col gap-xs">

          {/* Company Info Card — p-sm (16px) instead of p-md (24px) */}
          <div className="bg-surface-container-lowest border border-surface-variant rounded-xl p-sm flex flex-col">
            {/* Logo icon — slightly smaller */}
            <div className="w-10 h-10 border border-surface-variant rounded-lg flex items-center justify-center overflow-hidden mb-xs">
              <span className="material-symbols-outlined text-secondary text-[24px]">domain</span>
            </div>
            {/* Company name — unchanged (display-lg, primary content) */}
            <h1 className="font-display-lg text-display-lg text-on-surface mb-[2px]">{placement.company}</h1>
            {/* Role — unchanged (headline-sm) */}
            <p className="font-headline-sm text-headline-sm text-on-surface-variant mb-xs">{placement.role}</p>
            {/* CTC — unchanged (headline-md, primary content) */}
            <div className="flex items-baseline gap-xs mb-xs">
              <span className="font-headline-md text-headline-md text-primary">{placement.ctc} LPA</span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">(CTC)</span>
            </div>
            {/* Badges */}
            <div className="flex flex-wrap gap-xs">
              {placement.type && (
                <span className={`font-label-sm text-label-sm uppercase px-3 py-1 rounded-full ${typeConfig[placement.type] || typeConfig['Full-Time']}`}>
                  {placement.type}
                </span>
              )}
              <StatusBadge status={placement.status} />
            </div>
            {placement.formUrl && (
              <div className="border-t border-surface-variant mt-xs pt-xs">
                <a
                  href={placement.formUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary w-full py-2 mt-auto"
                >
                  Apply Now
                </a>
              </div>
            )}
          </div>

          {/* Important Dates Card — p-sm, compact rows */}
          <div className="bg-surface-container-lowest border border-surface-variant rounded-xl p-sm">
            {/* Section label — label-sm (12px) instead of label-md (14px) */}
            <h3 className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-xs border-b border-surface-variant pb-xs">
              Important Dates
            </h3>
            {placement.deadline && (
              <div className="flex justify-between items-center py-[6px]">
                <span className="font-body-sm text-body-sm text-on-surface-variant">Application Deadline</span>
                <span className="font-label-md text-label-md text-on-surface">{formatDateShort(placement.deadline)}</span>
              </div>
            )}
            <div className="flex justify-between items-center py-[6px]">
              <span className="font-body-sm text-body-sm text-on-surface-variant">Drive Date</span>
              <span className="font-label-md text-label-md text-on-surface">{formatDateShort(placement.driveDate)}</span>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="md:col-span-8 flex flex-col gap-xs">

          {/* Eligibility Section — p-sm, tighter header margin */}
          <section className="bg-surface-container-lowest border border-surface-variant rounded-xl p-sm">
            <div className="flex items-center gap-xs mb-xs">
              <span className="material-symbols-outlined text-secondary text-[20px]">verified_user</span>
              <h2 className="font-headline-sm text-headline-sm text-on-surface">Eligibility Criteria</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-xs">
              <div className="flex flex-col bg-surface-container-low p-xs rounded-lg">
                {/* Sub-label — label-sm (12px) */}
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase mb-[3px]">
                  Academic Requirement
                </span>
                {/* Value — body-md unchanged (primary content) */}
                <span className="font-body-md text-body-md text-on-surface">
                  {placement.eligibility?.cgpa != null
                    ? `CGPA > ${placement.eligibility.cgpa}${placement.eligibility.backlog != null ? ` (Max ${placement.eligibility.backlog} Backlogs)` : ' (No Active Backlogs)'}`
                    : 'Not specified'}
                </span>
              </div>
              <div className="flex flex-col bg-surface-container-low p-xs rounded-lg">
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase mb-[3px]">
                  Eligible Branches
                </span>
                <span className="font-body-md text-body-md text-on-surface">
                  {placement.eligibility?.branches?.length > 0
                    ? placement.eligibility.branches.join(', ')
                    : 'All branches'}
                </span>
              </div>
            </div>
          </section>

          {/* Job Description Section */}
          {placement.jdDescription && (
            <section className="bg-surface-container-lowest border border-surface-variant rounded-xl p-sm">
              <h2 className="font-headline-sm text-headline-sm text-on-surface mb-xs pb-xs border-b border-surface-variant">
                Job Description &amp; Responsibilities
              </h2>
              <div className="prose prose-sm max-w-none font-body-md text-body-md text-on-surface-variant">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    a: ({ node: _node, ...props }) => (
                      <a {...props} target="_blank" rel="noopener noreferrer" />
                    ),
                  }}
                >
                  {placement.jdDescription}
                </ReactMarkdown>
              </div>
            </section>
          )}

          {/* Selection Process Section */}
          {placement.selectionProcess?.length > 0 && (
            <section className="bg-surface-container-lowest border border-surface-variant rounded-xl p-sm">
              <h2 className="font-headline-sm text-headline-sm text-on-surface mb-xs pb-xs border-b border-surface-variant">
                Selection Process
              </h2>
              <div className="flex flex-col gap-xs relative">
                <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-surface-variant hidden sm:block" />
                {placement.selectionProcess.map((step, index) => (
                  <div key={index} className="flex items-start gap-xs relative z-10">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center font-label-sm text-label-sm flex-shrink-0 mt-0.5 ${
                        index === 0
                          ? 'bg-primary-container text-on-primary-container'
                          : 'bg-surface-container-high border border-surface-variant text-on-surface'
                      }`}
                    >
                      {index + 1}
                    </div>
                    <div>
                      <h4 className="font-label-md text-label-md text-on-surface">
                        {typeof step === 'string' ? step : step.title || step.name || `Step ${index + 1}`}
                      </h4>
                      {typeof step === 'object' && step.description && (
                        <p className="font-body-sm text-body-sm text-on-surface-variant">{step.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Tags */}
          {placement.tags?.length > 0 && (
            <section className="bg-surface-container-lowest border border-surface-variant rounded-xl p-sm">
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

        {/* Timestamps — label-sm (12px) instead of body-sm (14px) */}
        <div className="md:col-span-12 font-label-sm text-label-sm text-on-surface-variant text-right font-normal tracking-normal">
          <span>Added {formatDate(placement.createdAt)}</span>
          {placement.updatedAt !== placement.createdAt && (
            <span> · Updated {formatDate(placement.updatedAt)}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlacementDetail;
