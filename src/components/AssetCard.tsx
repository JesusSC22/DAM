import React, { useState, useRef, useEffect } from 'react';
import { Asset } from '../types';
import { categories } from '../data/assets';
import { MoreVertical, Box, Trash2, FileBox, FileArchive, Info } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { EditAssetModal } from './EditAssetModal';

interface AssetCardProps {
  asset: Asset;
  onClick: (asset: Asset) => void;
  onDelete?: (asset: Asset) => void;
  onRename?: (asset: Asset, newName: string) => void;
  onUpdateFile?: (asset: Asset, type: 'unity' | 'zip', file: File) => void;
  onUpdateCategory?: (asset: Asset, categoryId: string) => void;
  className?: string;
}

export const AssetCard: React.FC<AssetCardProps> = ({ 
  asset, 
  onClick, 
  onDelete,
  onRename,
  onUpdateFile,
  onUpdateCategory,
  className 
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const unityInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const [thumbnailSrc, setThumbnailSrc] = useState<string>(asset.thumbnail || '');

  useEffect(() => {
    let url = '';
    if (asset.thumbnailBlob) {
      url = URL.createObjectURL(asset.thumbnailBlob);
      setThumbnailSrc(url);
    } else {
      setThumbnailSrc(asset.thumbnail || '');
    }
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [asset.thumbnail, asset.thumbnailBlob]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
    } catch (e) {
      return dateString;
    }
  };

  const formatCount = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toString();
  };

  const handleMenuAction = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation();
    action();
    setShowMenu(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'unity' | 'zip') => {
    if (e.target.files && e.target.files[0] && onUpdateFile) {
      onUpdateFile(asset, type, e.target.files[0]);
    }
    // Reset value so same file can be selected again
    e.target.value = '';
  };

  // Buscar categoría, si no existe o es 'all', usar 'prop' como default
  const categoryId = asset.categoryId && asset.categoryId !== 'all' ? asset.categoryId : 'prop';
  const category = categories.find(c => c.id === categoryId);

  return (
    <div 
      className={twMerge(
        "bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-300 group flex flex-col relative h-[360px]",
        className
      )}
    >
      {/* Hidden File Inputs */}
      <input 
        type="file" 
        ref={unityInputRef} 
        className="hidden" 
        accept=".unitypackage"
        onChange={(e) => handleFileChange(e, 'unity')}
        onClick={(e) => e.stopPropagation()}
      />
      <input 
        type="file" 
        ref={zipInputRef} 
        className="hidden" 
        accept=".zip,.rar,.7z"
        onChange={(e) => handleFileChange(e, 'zip')}
        onClick={(e) => e.stopPropagation()}
      />

      {/* Three dots menu */}
      <div className="absolute top-4 right-4 z-20" ref={menuRef}>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded-full hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm"
        >
          <MoreVertical size={20} />
        </button>

        {showMenu && (
          <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-100 dark:border-gray-700 py-1 z-30 animate-in fade-in zoom-in-95 duration-100 origin-top-right">
            <button 
              onClick={(e) => handleMenuAction(e, () => setShowEditModal(true))}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <Info size={16} /> Editar Información
            </button>
            <div className="h-px bg-gray-100 dark:bg-gray-700 my-1"></div>
            <button 
              onClick={(e) => handleMenuAction(e, () => unityInputRef.current?.click())}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <FileBox size={16} /> Cambiar Unity Pkg
            </button>
            <button 
              onClick={(e) => handleMenuAction(e, () => zipInputRef.current?.click())}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <FileArchive size={16} /> Cambiar Zip
            </button>
            <div className="h-px bg-gray-100 dark:bg-gray-700 my-1"></div>
            <button 
              onClick={(e) => handleMenuAction(e, () => onDelete && onDelete(asset))}
              className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
            >
              <Trash2 size={16} /> Eliminar
            </button>
          </div>
        )}
      </div>

      {/* Image Container - Solo esta área es clickeable */}
      <div 
        role="button"
        tabIndex={0}
        aria-label={`Abrir ${asset.name}`}
        onClick={(e) => {
          e.stopPropagation();
          if (!showEditModal) {
            onClick(asset);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            if (!showEditModal) {
              onClick(asset);
            }
          }
        }}
        className="flex-1 flex items-center justify-center relative mb-2 overflow-hidden cursor-pointer rounded-lg transition-all duration-200"
      >
        {thumbnailSrc && !thumbnailSrc.includes('via.placeholder') ? (
          <img 
            src={thumbnailSrc} 
            alt={asset.name} 
            className="w-full h-full object-contain transition-transform duration-500 ease-out scale-110 group-hover:scale-125"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-gray-300 dark:text-gray-600">
            <Box size={64} strokeWidth={1} />
          </div>
        )}
      </div>

      {/* Tags */}
      {asset.tags && asset.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2 h-6 overflow-hidden">
          {asset.tags.slice(0, 3).map((tag, i) => (
            <span key={i} className="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded-md">
              #{tag}
            </span>
          ))}
          {asset.tags.length > 3 && (
            <span className="text-[10px] text-gray-400 dark:text-gray-500 px-1 py-0.5">
              +{asset.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Info Footer */}
      <div className="mt-auto w-full">
        <div className="flex justify-between items-end gap-2">
          {/* Left Side: Name and Size */}
          <div className="flex flex-col gap-1 min-w-0 flex-1">
            <h3 className="font-bold text-slate-800 dark:text-gray-100 text-lg truncate leading-none" title={asset.name}>
              {asset.name}
            </h3>
            
            <div className="flex flex-col gap-0.5">
              <span className="text-base text-slate-500 dark:text-gray-400 font-medium truncate">
                {asset.fileSize || '4.51 MB'}
              </span>
              <div className="flex items-center gap-2 text-sm text-slate-400 dark:text-gray-500">
                <span>{formatCount(asset.metadata.polygons)} Poly</span>
                <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                <span>{formatCount(asset.metadata.vertices)} Vert</span>
              </div>
            </div>
          </div>
          
          {/* Right Side: Date */}
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0 mb-0.5">
            {category && category.id !== 'all' && (
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-300 border border-slate-200 dark:border-gray-600 uppercase tracking-wide">
                {category.name}
              </span>
            )}
            <span className="text-xs text-slate-400 dark:text-gray-500 whitespace-nowrap">
              {formatDate(asset.metadata.createdDate)}
            </span>
          </div>
        </div>
      </div>

      {/* Edit Asset Modal - Renderizado fuera del card usando Portal */}
      {showEditModal && (
        <EditAssetModal
          asset={asset}
          categories={categories.filter(c => c.id !== 'all')}
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
        />
      )}
    </div>
  );
};
