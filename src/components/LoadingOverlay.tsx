import React from 'react';
import { Loader } from 'lucide-react';

interface LoadingOverlayProps {
  message?: string;
  isVisible: boolean;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ message, isVisible }) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-2xl border border-gray-200 dark:border-gray-700 max-w-md mx-4">
        <div className="flex flex-col items-center gap-4">
          <Loader className="animate-spin text-blue-600 dark:text-blue-400" size={48} />
          {message && (
            <p className="text-gray-700 dark:text-gray-300 text-center font-medium">
              {message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};




