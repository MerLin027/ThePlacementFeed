import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import StatusBadge from '../components/StatusBadge';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Strip raw HTML tags (e.g. <div align="center">, </div>) from markdown source
// so they don't render as visible literal text. react-markdown v9 does NOT
// render raw HTML by default (no rehype-raw), and without stripping they appear
// verbatim in the output.
const stripRawHtml = (text) => {
  if (!text) return '';
  // Remove complete HTML tags — both opening (<tag ...>) and closing (</tag>)
  return text.replace(/<\/?[a-zA-Z][^>]*>/g, '');
};

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
    <div className="w-full max-w-container-max mx-auto px-sm md:px-lg py-sm">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-xs md:gap-sm items-start">
        
        {/* Back navigation breadcrumb */}
        <div className="md:col-span-12">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-xs font-body-sm text-body-sm text-on-surface-variant hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-sm"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Back to Drives
          </button>
        </div>

        {/* Company Info Header Card */}
        <div className="md:col-span-12 bg-surface-container-lowest border border-surface-variant rounded-xl p-sm md:p-md">
          <div className="flex flex-col gap-4 items-start w-full">
            <div className="flex gap-4 items-start w-full">
              <div className="w-12 h-12 border border-surface-variant rounded-lg flex items-center justify-center overflow-hidden shrink-0">
                <span className="material-symbols-outlined text-secondary text-[28px]">domain</span>
              </div>
              <div className="flex-1 w-full">
                <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface mb-[2px]">{placement.company}</h1>
                <p className="font-headline-sm text-headline-sm text-on-surface-variant mb-3">{placement.role}</p>
                <div className="flex flex-wrap gap-2">
                  {placement.type && (
                    <span className={`font-label-sm text-label-sm uppercase px-3 py-1 rounded-full ${typeConfig[placement.type] || typeConfig['Full-Time']}`}>
                      {placement.type}
                    </span>
                  )}
                  <StatusBadge status={placement.status} />
                </div>
              </div>
            </div>
            
            {placement.formUrl && (
              <div className="border-t border-surface-variant pt-4 w-full">
                <a
                  href={placement.formUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary w-full py-2"
                >
                  Apply Now
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Stat Cards Row */}
        <div className="md:col-span-12 grid grid-cols-1 sm:grid-cols-3 gap-xs md:gap-sm mt-1">
          {/* CTC */}
          <div className="bg-surface-container-lowest border border-surface-variant rounded-xl p-sm flex flex-col items-center justify-center text-center">
            <span className="material-symbols-outlined text-primary mb-2 text-[24px]">payments</span>
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-1">Package (CTC)</span>
            <span className="font-headline-sm text-headline-sm text-on-surface">{placement.ctc} LPA</span>
          </div>
          {/* Branches */}
          <div className="bg-surface-container-lowest border border-surface-variant rounded-xl p-sm flex flex-col items-center justify-center text-center">
            <span className="material-symbols-outlined text-primary mb-2 text-[24px]">groups</span>
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-2">Eligible Branches</span>
            <div className="flex flex-wrap justify-center gap-1">
              {placement.eligibility?.branches?.length > 0
                ? placement.eligibility.branches.map(b => (
                    <span key={b} className="px-2 py-0.5 bg-surface-container text-on-surface-variant rounded text-xs font-medium">{b}</span>
                  ))
                : <span className="font-body-md text-body-md text-on-surface">All branches</span>}
            </div>
          </div>
          {/* Criteria */}
          <div className="bg-surface-container-lowest border border-surface-variant rounded-xl p-sm flex flex-col items-center justify-center text-center">
            <span className="material-symbols-outlined text-primary mb-2 text-[24px]">check_circle</span>
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-1">Minimum Criteria</span>
            <span className="font-headline-sm text-headline-sm text-on-surface">
              {placement.eligibility?.cgpa != null ? `${placement.eligibility.cgpa} CGPA` : 'Not specified'}
            </span>
            {placement.eligibility?.cgpa != null && (
              <span className={`font-label-sm text-label-sm mt-1 ${placement.eligibility.backlog === 0 ? 'text-error' : 'text-on-surface-variant'}`}>
                {placement.eligibility.backlog != null && placement.eligibility.backlog > 0 ? `Max ${placement.eligibility.backlog} backlogs` : 'No active backlogs'}
              </span>
            )}
          </div>
        </div>

        {/* Main Content: Left Column (8) */}
        <div className="md:col-span-8 flex flex-col gap-xs md:gap-sm mt-1">
          {/* Job Description */}
          {placement.jdDescription && (
            <section className="bg-surface-container-lowest border border-surface-variant rounded-xl p-sm md:p-md">
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-secondary">description</span>
                <h2 className="font-headline-sm text-headline-sm text-on-surface">Job Description</h2>
              </div>
              <div className="markdown-body">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    a: ({ node: _node, ...props }) => (
                      <a {...props} target="_blank" rel="noopener noreferrer" />
                    ),
                  }}
                >
                  {stripRawHtml(placement.jdDescription)}
                </ReactMarkdown>
              </div>
            </section>
          )}

          {/* Selection Process */}
          {placement.selectionRounds?.length > 0 && (
            <section className="bg-surface-container-lowest border border-surface-variant rounded-xl p-sm md:p-md">
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-secondary">timeline</span>
                <h2 className="font-headline-sm text-headline-sm text-on-surface">Selection Process</h2>
              </div>
              <div className="flex flex-col gap-4 relative">
                <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-surface-variant hidden sm:block" />
                {placement.selectionRounds.map((step, index) => (
                  <div key={index} className="flex items-start gap-3 relative z-10">
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
                      <h4 className="font-label-md text-label-md text-on-surface uppercase tracking-wider mb-1">
                        ROUND {index + 1}
                      </h4>
                      <p className="font-body-md text-body-md text-on-surface font-medium">{step.roundName}</p>
                      {step.roundDescription && (
                        <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">{step.roundDescription}</p>
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

        {/* Sidebar: Right Column (4) */}
        <div className="md:col-span-4 flex flex-col gap-xs md:gap-sm mt-1">
          {/* Important Dates */}
          <div className="bg-surface-container-lowest border border-surface-variant rounded-xl p-sm">
            <div className="flex items-center gap-2 mb-3 border-b border-surface-variant pb-2">
              <span className="material-symbols-outlined text-secondary text-[20px]">calendar_month</span>
              <h3 className="font-headline-sm text-headline-sm text-on-surface">
                Important Dates
              </h3>
            </div>
            
            <div className="space-y-3">
              {placement.deadline && (
                <div className="flex justify-between items-center">
                  <span className="font-body-sm text-body-sm text-on-surface-variant">Application Deadline</span>
                  <span className="font-label-md text-label-md text-error">{formatDateShort(placement.deadline)}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="font-body-sm text-body-sm text-on-surface-variant">Drive Date</span>
                <span className="font-label-md text-label-md text-on-surface">{formatDateShort(placement.driveDate)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Timestamps */}
        <div className="md:col-span-12 font-label-sm text-label-sm text-on-surface-variant text-right font-normal tracking-normal mt-2">
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
