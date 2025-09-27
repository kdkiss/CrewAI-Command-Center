import React, { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';

const baseContainerClasses = 'rounded-lg border bg-white shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900';
const headerClasses =
  'flex w-full items-center justify-between gap-2 px-6 py-4 text-left text-xl font-heading font-semibold text-gray-900 dark:text-gray-100 sm:text-2xl';
const headerFocusClasses =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900';
const toggleIconClasses = 'h-5 w-5 transition-transform duration-200';
const contentClasses = 'px-6 pb-6';

const CollapsibleSection = ({
  title,
  icon: Icon,
  children,
  className = '',
  contentClassName = '',
  defaultCollapsed = false,
  isCollapsed: controlledCollapsed,
  onToggle,
  toggleAriaLabel,
}) => {
  const isControlled = controlledCollapsed !== undefined;
  const [internalCollapsed, setInternalCollapsed] = useState(defaultCollapsed);
  const collapsed = isControlled ? controlledCollapsed : internalCollapsed;
  const sectionId = useId();
  const contentId = `${sectionId}-content`;

  const handleToggle = () => {
    const nextCollapsed = !collapsed;

    if (!isControlled) {
      setInternalCollapsed(nextCollapsed);
    }

    if (typeof onToggle === 'function') {
      onToggle(nextCollapsed);
    }
  };

  const combinedContainerClasses = [baseContainerClasses, className]
    .filter(Boolean)
    .join(' ');

  const combinedContentClasses = [contentClasses, contentClassName]
    .filter(Boolean)
    .join(' ');

  return (
    <section className={combinedContainerClasses}>
      <button
        type="button"
        className={`${headerClasses} ${headerFocusClasses}`}
        onClick={handleToggle}
        aria-expanded={!collapsed}
        aria-controls={contentId}
      >
        <span className="flex items-center gap-2">
          {Icon ? <Icon className="h-5 w-5" aria-hidden="true" /> : null}
          <span>{title}</span>
        </span>
        <span className="ml-auto flex items-center">
          <span className="sr-only">{toggleAriaLabel || `Toggle ${title}`}</span>
          <ChevronDown
            aria-hidden="true"
            className={`${toggleIconClasses} ${collapsed ? '-rotate-90' : 'rotate-0'}`}
          />
        </span>
      </button>
      {!collapsed ? (
        <div id={contentId} className={combinedContentClasses}>
          {children}
        </div>
      ) : null}
    </section>
  );
};

export default CollapsibleSection;
