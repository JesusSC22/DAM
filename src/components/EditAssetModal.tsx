import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Tag, Plus } from 'lucide-react';
import { Asset, Category } from '../types';
import { useAssets } from '../context/AssetContext';
import toast from 'react-hot-toast';

interface EditAssetModalProps {
  asset: Asset;
  categories: Category[];
  isOpen: boolean;
  onClose: () => void;
}

export const EditAssetModal: React.FC<EditAssetModalProps> = ({ 
  asset, 
  categories, 
  isOpen, 
  onClose 
}) => {
  const { updateAssetInfo } = useAssets();
  // Filtrar categorías válidas y asegurar categoryId válido
  const validCategories = categories.filter(c => c.id !== 'all');
  const getValidCategoryId = (catId: string | undefined) => {
    if (catId && catId !== 'all' && validCategories.some(c => c.id === catId)) {
      return catId;
    }
    return validCategories[0]?.id || 'prop';
  };
  
  const [name, setName] = useState(asset.name);
  const [description, setDescription] = useState(asset.description || '');
  const [categoryId, setCategoryId] = useState(getValidCategoryId(asset.categoryId));
  const [tags, setTags] = useState<string[]>(asset.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Actualizar estados cuando cambia el asset
  useEffect(() => {
    if (asset && isOpen) {
      setName(asset.name);
      setDescription(asset.description || '');
      setCategoryId(getValidCategoryId(asset.categoryId));
      setTags(asset.tags || []);
      setTagInput('');
    }
  }, [asset, isOpen]);

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      if (!tags.includes(tagInput.trim())) {
        setTags([...tags, tagInput.trim()]);
      }
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('El nombre es requerido');
      return;
    }

    setIsSaving(true);
    try {
      // Preparar actualizaciones solo para campos que cambiaron
      const updates: { name?: string; description?: string; categoryId?: string; tags?: string[] } = {};
      
      if (name.trim() !== asset.name) {
        updates.name = name.trim();
      }
      
      if (description !== (asset.description || '')) {
        updates.description = description;
      }
      
      if (categoryId !== asset.categoryId) {
        updates.categoryId = categoryId;
      }
      
      const currentTags = asset.tags || [];
      const tagsChanged = tags.length !== currentTags.length || 
        tags.some(tag => !currentTags.includes(tag)) ||
        currentTags.some(tag => !tags.includes(tag));
      
      if (tagsChanged) {
        updates.tags = tags;
      }

      // Solo actualizar si hay cambios
      if (Object.keys(updates).length > 0) {
        await updateAssetInfo(asset, updates);
      }
      
      onClose();
    } catch (error) {
      console.error('Error actualizando información:', error);
      // El error ya se maneja en updateAssetInfo
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col transition-colors duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between transition-colors duration-200">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Editar Información</h2>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-500 dark:text-gray-400 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          
          {/* Nombre */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nombre del Modelo
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="Ej. Silla de Oficina Moderna"
            />
          </div>

          {/* Categoría */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Categoría
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
            >
              {validCategories.map(category => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Descripción
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder-gray-400 dark:placeholder-gray-500 resize-none"
              placeholder="Describe el modelo..."
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Etiquetas
            </label>
            <div className="flex items-center gap-1.5 mb-1.5">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleAddTag}
                className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder-gray-400 dark:placeholder-gray-500"
                placeholder="Presiona Enter para agregar"
              />
            </div>
            <div className="flex flex-wrap gap-1.5 min-h-[20px]">
              {tags.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded-md">
                  {tag}
                  <button 
                    type="button" 
                    onClick={() => removeTag(tag)} 
                    className="hover:text-blue-900 dark:hover:text-blue-100"
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="pt-4 mt-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 font-medium hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving || !name.trim()}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-lg shadow-blue-200 dark:shadow-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isSaving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );

  // Renderizar el modal usando Portal fuera del DOM del card
  return createPortal(modalContent, document.body);
};

