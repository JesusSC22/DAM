import React from 'react';
import { X, Moon, Sun } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

interface SettingsModalProps {
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
  const { darkMode, toggleDarkMode } = useAppStore();

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-2xl flex flex-col transition-colors duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-800 rounded-t-2xl z-10 transition-colors duration-200">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Configuración</h2>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-500 dark:text-gray-400 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          
          {/* Theme Settings */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Apariencia</h3>
            
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${darkMode ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-orange-100 text-orange-600'}`}>
                  {darkMode ? <Moon size={20} /> : <Sun size={20} />}
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">Modo Oscuro</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Ajusta la apariencia de la aplicación</p>
                </div>
              </div>

              <button
                onClick={toggleDarkMode}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:ring-offset-2 ${
                  darkMode ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`${
                    darkMode ? 'translate-x-6' : 'translate-x-1'
                  } inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ease-in-out`}
                />
              </button>
            </div>
          </div>

          {/* More settings can go here */}
          
        </div>

      </div>
    </div>
  );
};









