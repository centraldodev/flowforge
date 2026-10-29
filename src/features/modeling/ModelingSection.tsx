import { useId, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import type { ModelingValidationIssue } from '../../engine/appModeling';

export function InlineIssues({ issues }: { issues: ModelingValidationIssue[] }) {
  if (!issues.length) return null;
  return (
    <ul className="modeling-inline-issues">
      {issues.map((issue) => (
        <li key={issue.id} id={`issue-${issue.id}`} className={`severity-${issue.severity}`}>
          {issue.message}
        </li>
      ))}
    </ul>
  );
}

export function ModelingSection({
  title,
  summary,
  children,
  ...props
}: {
  title: ReactNode;
  summary: ReactNode;
  children: ReactNode;
  'data-model-element-id'?: string;
}) {
  const id = useId();
  return (
    <details open className="modeling-card modeling-section" {...props}>
      <summary aria-controls={id}>
        <strong>{title}</strong>
        <span className="modeling-section-count">{summary}</span>
        <ChevronDown size={15} />
      </summary>
      <div id={id} className="modeling-section-body">
        {children}
      </div>
    </details>
  );
}
