import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';

// Markdown job description (GFM + sanitised HTML). Loaded lazily by the drive page: the Markdown
// pipeline is about half of the app's library code and no other page needs it.
const JobDescription = ({ source }) => (
  <div className="markdown-body">
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw, rehypeSanitize]}
      components={{
        a: ({ node: _node, ...props }) => (
          <a {...props} target="_blank" rel="noopener noreferrer" />
        ),
      }}
    >
      {source}
    </ReactMarkdown>
  </div>
);

export default JobDescription;
