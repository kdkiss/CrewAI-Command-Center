import React from 'react';
import { CheckCircle, AlertCircle, RefreshCw, Clock } from 'lucide-react';

const OperationProgress = ({ operation }) => {
  const getProgressPercentage = () => {
    if (operation.status === 'complete') return 100;
    if (operation.status === 'error') return 100;

    if (operation.total_steps) {
      return Math.min(Math.round((operation.current_step / operation.total_steps) * 100), 99);
    }

    return 50;
  };

  const getStatusIcon = () => {
    switch (operation.status) {
      case 'complete':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'in_progress':
        return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="mt-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs text-gray-600 dark:text-gray-300">
          Status: {operation.status === 'in_progress'
            ? '🔄 In Progress'
            : operation.status === 'complete'
              ? '✅ Complete'
              : operation.status === 'error'
                ? '❌ Error'
                : 'Pending'}
        </span>
        {getStatusIcon()}
      </div>
      <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-slate-800">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${
            operation.status === 'error'
              ? 'bg-red-500'
              : operation.status === 'complete'
                ? 'bg-green-500'
                : 'bg-blue-500'
          }`}
          style={{ width: `${getProgressPercentage()}%` }}
        />
      </div>
    </div>
  );
};

export default OperationProgress;
