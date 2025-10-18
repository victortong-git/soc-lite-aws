import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
        // Customize heading styles
        h1: ({ node, ...props }) => <h1 className="text-2xl font-bold mb-4 text-theme-text" {...props} />,
        h2: ({ node, ...props }) => <h2 className="text-xl font-semibold mb-3 text-theme-text" {...props} />,
        h3: ({ node, ...props }) => <h3 className="text-lg font-semibold mb-2 text-theme-text" {...props} />,

        // Customize paragraph styles
        p: ({ node, ...props }) => <p className="mb-3 text-theme-text leading-relaxed" {...props} />,

        // Customize list styles
        ul: ({ node, ...props }) => <ul className="list-disc list-inside mb-3 space-y-1.5 text-theme-text" {...props} />,
        ol: ({ node, ...props }) => <ol className="list-decimal list-inside mb-3 space-y-1.5 text-theme-text" {...props} />,
        li: ({ node, ...props }) => <li className="text-theme-text leading-relaxed" {...props} />,

        // Customize strong (bold) styles
        strong: ({ node, ...props }) => <strong className="font-semibold text-theme-text" {...props} />,

        // Customize emphasis (italic) styles
        em: ({ node, ...props }) => <em className="italic text-theme-text-secondary" {...props} />,

        // Customize code styles
        code: ({ node, inline, ...props }: any) =>
          inline ? (
            <code className="bg-theme-surface px-1.5 py-0.5 rounded text-xs font-mono text-theme-text border border-theme-border" {...props} />
          ) : (
            <code className="block bg-theme-surface p-3 rounded text-xs font-mono text-theme-text border border-theme-border overflow-x-auto" {...props} />
          ),

        // Customize pre (code block) styles
        pre: ({ node, ...props }) => <pre className="mb-3 overflow-x-auto" {...props} />,

        // Customize link styles
        a: ({ node, ...props }) => <a className="text-primary-600 dark:text-primary-400 hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,

        // Customize blockquote styles
        blockquote: ({ node, ...props }) => (
          <blockquote className="border-l-4 border-primary-500 pl-4 py-2 mb-3 text-theme-text-secondary italic" {...props} />
        ),

        // Customize horizontal rule
        hr: ({ node, ...props }) => <hr className="my-4 border-theme-border" {...props} />,
      }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
