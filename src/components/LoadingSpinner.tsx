import React from 'react';
import { Loader } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: number;
  className?: string;
  message?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 24, 
  className = '',
  message 
}) => {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Loader className="animate-spin text-blue-600 dark:text-blue-400" size={size} />
      {message && (
        <span className="text-gray-600 dark:text-gray-400 text-sm">{message}</span>
      )}
    </div>
  );
};




