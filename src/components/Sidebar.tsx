import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { 
  Box, 
  Map, 
  User, 
  Grid,
  Hash,
  Calendar,
  Layers,
  X,
  Database
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { 
    selectedCategory, 
    setSelectedCategory,
    selectedTags,
    setSelectedTags,
    filterPolygonsRange,
    setFilterPolygonsRange,
    filterDateRange,
    setFilterDateRange
  } = useAppStore();

  const [tagInput, setTagInput] = useState('');

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      if (!selectedTags.includes(tagInput.trim())) {
        setSelectedTags([...selectedTags, tagInput.trim()]);
      }
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setSelectedTags(selectedTags.filter(t => t !== tag));
  };

  const handlePolygonChange = (index: 0 | 1, value: string) => {
    const val = value ? parseInt(value) : 0;
    const current = filterPolygonsRange || [0, 1000000];
    const newRange = [...current] as [number, number];
    if (value === '') {
       // Handle empty input if needed, mostly we just keep 0 or max
       newRange[index] = index === 0 ? 0 : 1000000;
    } else {
       newRange[index] = val;
    }
    // Only set if we have non-default values, otherwise null to clear filter? 
    // Or just always set. Let's always set for now, but maybe check if both are default.
    setFilterPolygonsRange(newRange);
  };

  const handleDateChange = (index: 0 | 1, value: string) => {
     const date = value ? new Date(value) : null;
     const current = filterDateRange || [null, null];
     const newRange = [...current] as [Date | null, Date | null];
     newRange[index] = date;
     setFilterDateRange(newRange);
  };

  return (
    <div className="w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col h-full shadow-sm z-20 shrink-0 transition-colors duration-200">
      
      {/* Navigation Area */}
      <div className="flex-1 overflow-y-auto px-4 py-2 custom-scrollbar mt-4">
        
        {/* Section: MANAGE */}
        <div className="mb-6">
          <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4 px-2">Biblioteca</h3>
          <ul className="space-y-1">
            <NavItem 
              icon={<Grid size={18} />} 
              label="Todos" 
              id="all" 
              isActive={selectedCategory === 'all'} 
              onClick={setSelectedCategory}
            />
            <NavItem 
              icon={<Box size={18} />} 
              label="Props" 
              id="prop" 
              isActive={selectedCategory === 'prop'} 
              onClick={setSelectedCategory}
            />
            <NavItem 
              icon={<Map size={18} />} 
              label="Escenarios" 
              id="scene" 
              isActive={selectedCategory === 'scene'} 
              onClick={setSelectedCategory}
            />
            <NavItem 
              icon={<User size={18} />} 
              label="Personajes" 
              id="character" 
              isActive={selectedCategory === 'character'} 
              onClick={setSelectedCategory}
            />
          </ul>
        </div>

        {/* Section: ADMINISTRACIÓN */}
        <div className="mb-6 pt-6 border-t border-gray-100 dark:border-gray-800">
          <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4 px-2">Administración</h3>
          <ul className="space-y-1">
            <li>
              <button 
                onClick={() => navigate('/database')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  location.pathname === '/database'
                    ? 'text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800/50 shadow-sm' 
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200 border border-transparent'
                }`}
              >
                <span className={location.pathname === '/database' ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400 dark:text-gray-500'}>
                  <Database size={18} />
                </span>
                <span>Gestión de Base de Datos</span>
              </button>
            </li>
          </ul>
        </div>

        {/* Section: FILTERS */}
        <div className="mb-6 pt-6 border-t border-gray-100 dark:border-gray-800">
          <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4 px-2">Filtros Avanzados</h3>
          
          <div className="space-y-6 px-2">
            {/* Tags */}
            <div>
              <div className="flex items-center gap-2 mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <Hash size={16} />
                <span>Etiquetas</span>
              </div>
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleAddTag}
                placeholder="Escribe y presiona Enter..."
                className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 placeholder-gray-400 dark:placeholder-gray-500"
              />
              <div className="flex flex-wrap gap-2 mt-2">
                {selectedTags.map(tag => (
                  <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded-md">
                    {tag}
                    <button onClick={() => removeTag(tag)} className="hover:text-blue-900 dark:hover:text-blue-100"><X size={12} /></button>
                  </span>
                ))}
              </div>
            </div>

            {/* Polygons */}
            <div>
               <div className="flex items-center gap-2 mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <Layers size={16} />
                <span>Polígonos</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  onChange={(e) => handlePolygonChange(0, e.target.value)}
                  className="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 placeholder-gray-400 dark:placeholder-gray-500"
                />
                <span className="text-gray-400">-</span>
                <input
                  type="number"
                  placeholder="Max"
                  onChange={(e) => handlePolygonChange(1, e.target.value)}
                  className="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 placeholder-gray-400 dark:placeholder-gray-500"
                />
              </div>
            </div>

             {/* Date */}
            <div>
               <div className="flex items-center gap-2 mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <Calendar size={16} />
                <span>Fecha</span>
              </div>
              <div className="space-y-2">
                <input
                  type="date"
                  onChange={(e) => handleDateChange(0, e.target.value)}
                  className="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <input
                  type="date"
                  onChange={(e) => handleDateChange(1, e.target.value)}
                  className="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Footer / Dark Mode Removed */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-xs text-center text-gray-400">
         v0.1.0 Beta
      </div>
    </div>
  );
};

// Componente auxiliar para los items del menú
const NavItem: React.FC<{ 
  icon: React.ReactNode; 
  label: string; 
  id: string;
  isActive?: boolean;
  onClick: (id: string) => void;
}> = ({ icon, label, id, isActive, onClick }) => (
  <li>
    <button 
      onClick={() => onClick(id)}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
        isActive 
          ? 'text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 shadow-sm' 
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200 border border-transparent'
      }`}
    >
      <span className={isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}>{icon}</span>
      <span>{label}</span>
    </button>
  </li>
);
