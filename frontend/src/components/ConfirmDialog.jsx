import React, { useEffect, useRef } from 'react';

const ConfirmDialog = ({
  open,
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  confirmButtonClassName = 'bg-red-600 hover:bg-red-700 text-white',
  cancelButtonClassName = 'bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-slate-800 dark:text-gray-200 dark:hover:bg-slate-700',
  confirmButtonProps = {},
  cancelButtonProps = {},
}) => {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const previouslyFocused = document.activeElement;

    const focusTimer = window.setTimeout(() => {
      if (dialogRef.current) {
        const focusable = dialogRef.current.querySelector(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable && focusable.focus) {
          focusable.focus();
        }
      }
    }, 0);

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel?.();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      if (previouslyFocused && previouslyFocused.focus) {
        previouslyFocused.focus();
      }
    };
  }, [open, onCancel]);

  if (!open) {
    return null;
  }

  const handleContainerClick = (event) => {
    if (event.target === event.currentTarget) {
      onCancel?.();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6"
      role="presentation"
      onClick={handleContainerClick}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl transition dark:bg-slate-900 dark:text-gray-100"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
        {body ? (
          <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">{body}</div>
        ) : null}
        <div className="mt-6 flex flex-row-reverse gap-3">
          <button
            type="button"
            onClick={onConfirm}
            className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 ${confirmButtonClassName}`}
            {...confirmButtonProps}
          >
            {confirmLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 ${cancelButtonClassName}`}
            {...cancelButtonProps}
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
