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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="relative">
          <div className="w-10 h-10 rounded-full border-4 border-slate-200" />
          <div className="w-10 h-10 rounded-full border-4 border-brand-600 border-t-transparent animate-spin absolute inset-0" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h2 className="text-xl font-semibold text-slate-700 mb-2">Oops!</h2>
        <p className="text-slate-500 mb-6">{error}</p>
        <button onClick={() => navigate('/')} className="btn-primary">
          Back to Home
        </button>
      </div>
    );
  }

  const typeColor = {
    'Full-Time': 'bg-violet-50 text-violet-700 border-violet-200',
    'Internship': 'bg-sky-50 text-sky-700 border-sky-200',
    '6M Intern + FTE': 'bg-teal-50 text-teal-700 border-teal-200',
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="p-6 sm:p-8 border-b border-slate-200">
          <div className="flex flex-wrap items-start gap-3 mb-4">
            <StatusBadge status={placement.status} />
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium border ${typeColor[placement.type] || ''}`}>
              {placement.type}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">
            {placement.company}
          </h1>
          <p className="text-lg text-slate-600">{placement.role}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-sm text-slate-500">CTC:</span>
              <span className="text-lg font-bold text-slate-900">₹{placement.ctc} LPA</span>
            </div>
            {placement.formUrl && (
              <a
                href={placement.formUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary shadow-sm hover:shadow-md transition-all flex items-center gap-2 px-6 py-2.5 group"
              >
                Apply Now
                <svg className="w-4 h-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}
          </div>
        </div>

        {/* Details grid */}
        <div className="p-6 sm:p-8 grid grid-cols-1 sm:grid-cols-2 gap-6 border-b border-slate-200">
          <div>
            <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-1">Drive Date</h3>
            <p className="text-slate-900 font-medium">{formatDate(placement.driveDate)}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-1">Application Deadline</h3>
            <p className="text-slate-900 font-medium">{formatDate(placement.deadline)}</p>
          </div>
        </div>

        {/* Eligibility */}
        <div className="p-6 sm:p-8 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Eligibility Criteria</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-sm text-slate-500 mb-1">Minimum CGPA</p>
              <p className="text-xl font-bold text-slate-900">
                {placement.eligibility?.cgpa != null ? placement.eligibility.cgpa : 'Not specified'}
              </p>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-sm text-slate-500 mb-1">Max Backlogs</p>
              <p className="text-xl font-bold text-slate-900">
                {placement.eligibility?.backlog != null ? placement.eligibility.backlog : 'Not specified'}
              </p>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-sm text-slate-500 mb-1">Branches</p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {placement.eligibility?.branches?.length > 0 ? (
                  placement.eligibility.branches.map((b) => (
                    <span key={b} className="px-2 py-0.5 text-xs font-medium bg-brand-50 text-brand-700 rounded border border-brand-200">
                      {b}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-slate-500">All branches</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* JD Description */}
        {placement.jdDescription && (
          <div className="p-6 sm:p-8 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Job Description</h2>
            <div className="markdown-body max-w-none text-slate-700 bg-slate-50/50 p-6 rounded-lg border border-slate-100">
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
          </div>
        )}

        {/* Tags */}
        {placement.tags?.length > 0 && (
          <div className="p-6 sm:p-8">
            <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">Tags</h2>
            <div className="flex flex-wrap gap-2">
              {placement.tags.map((tag, i) => (
                <span
                  key={i}
                  className="px-3 py-1 text-sm bg-slate-100 text-slate-600 rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Timestamps */}
      <div className="mt-4 text-xs text-slate-400 text-right">
        <span>Added {formatDate(placement.createdAt)}</span>
        {placement.updatedAt !== placement.createdAt && (
          <span> · Updated {formatDate(placement.updatedAt)}</span>
        )}
      </div>
    </div>
  );
};

export default PlacementDetail;
