import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './MarkdownRenderer.css';

/**
 * MarkdownRenderer - A themed markdown rendering component
 * Renders markdown content with dark fantasy cyberpunk styling.
 * Supports GitHub Flavored Markdown (tables, strikethrough, task lists, etc.)
 */
function MarkdownRenderer({ content, className = '' }) {
  if (!content) {
    return null;
  }

  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Custom link rendering - open external links in new tab
          a: ({ node, children, href, ...props }) => {
            const isExternal = href && (href.startsWith('http://') || href.startsWith('https://'));
            return (
              <a
                href={href}
                {...props}
                {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              >
                {children}
              </a>
            );
          },
          // Handle pre element for code blocks (triple backticks)
          // In react-markdown v9, fenced code blocks render as <pre><code>content</code></pre>
          pre: ({ node, children, ...props }) => {
            // Extract language from the code child's className if present
            const codeChild = node?.children?.[0];
            const className = codeChild?.properties?.className?.[0] || '';
            const match = /language-(\w+)/.exec(className);
            const language = match ? match[1] : '';

            return (
              <div className="code-block-wrapper">
                {language && <span className="code-language">{language}</span>}
                <pre {...props}>
                  {children}
                </pre>
              </div>
            );
          },
          // Handle code element
          // In react-markdown v9, code blocks (triple backticks) are rendered as <pre><code>
          // while inline code (single backticks) is just <code>.
          // The pre component above handles wrapping, so code inside pre will have
          // a parent that's already been processed.
          code: ({ node, className, children, style, ...props }) => {
            // If className exists and starts with 'language-', this is a code block
            // (it will be wrapped by the pre component above)
            const isCodeBlock = className && className.startsWith('language-');

            // For code blocks, just render the code element - pre wrapper handles styling
            if (isCodeBlock) {
              return (
                <code className={className} style={style} {...props}>
                  {children}
                </code>
              );
            }

            // Check if this might be a code block without a language specified
            // by looking at node position info - code blocks tend to have specific patterns
            // However, the most reliable check is whether className exists at all
            // since react-markdown adds className for fenced code blocks

            // For inline code (no language class), apply inline styling
            return (
              <code className="inline-code" style={style} {...props}>
                {children}
              </code>
            );
          },
          // Custom table rendering for better styling control
          table: ({ node, children, ...props }) => (
            <div className="table-wrapper">
              <table {...props}>{children}</table>
            </div>
          ),
          // Custom image rendering with loading state
          img: ({ node, src, alt, ...props }) => (
            <span className="markdown-image-wrapper">
              <img
                src={src}
                alt={alt || 'Image'}
                loading="lazy"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling?.classList.add('visible');
                }}
                {...props}
              />
              <span className="image-error">Failed to load image</span>
            </span>
          ),
          // Custom checkbox rendering for task lists
          input: ({ node, type, checked, ...props }) => {
            if (type === 'checkbox') {
              return (
                <span className={`task-checkbox ${checked ? 'checked' : ''}`}>
                  {checked ? (
                    <svg viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="3" width="14" height="14" rx="2" />
                    </svg>
                  )}
                </span>
              );
            }
            return <input type={type} {...props} />;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default MarkdownRenderer;
