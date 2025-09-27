import React from 'react';
import { CheckCircle, AlertCircle, Info } from 'lucide-react';

const ToastContainer = ({ toasts, onDismiss }) => {
  const typeStyles = {
    success: { border: 'border-green-500', iconColor: 'text-green-500', Icon: CheckCircle },
    error: { border: 'border-red-500', iconColor: 'text-red-500', Icon: AlertCircle },
    warning: { border: 'border-yellow-500', iconColor: 'text-yellow-500', Icon: AlertCircle },
    info: { border: 'border-blue-500', iconColor: 'text-blue-500', Icon: Info }
  };

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-3">
      {toasts.map((toast) => {
        const config = typeStyles[toast.type] || typeStyles.info;
        const Icon = config.Icon;

        return (
          <div
            key={toast.id}
            className={`w-80 max-w-sm rounded-lg border border-gray-200 border-l-4 bg-white p-4 shadow-lg transition-transform dark:border-slate-700 dark:bg-slate-900 ${config.border}`}
            role={toast.type === 'error' ? 'alert' : 'status'}
            aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
            aria-atomic="true"
          >
            <div className="flex items-start gap-3">
              {Icon && <Icon className={`w-5 h-5 mt-0.5 ${config.iconColor}`} />}
              <div className="flex-1">
                {toast.title && <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{toast.title}</h4>}
                {toast.message && <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{toast.message}</p>}
              </div>
              <button
                type="button"
                onClick={() => onDismiss(toast.id)}
                className="text-gray-600 transition-colors hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                aria-label="Dismiss notification"
              >
                &times;
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ToastContainer;
