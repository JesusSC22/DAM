import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Viewer3D } from '../components/Viewer3D';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useAssets } from '../context/AssetContext';
import { useAppStore } from '../store/useAppStore';
import { ArrowLeft, Trash2, FileBox, FileArchive, Download, Tag, Plus, X } from 'lucide-react';
import { Asset } from '../types';
import { logger } from '../utils/logger';

export const AssetDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getAssetFull, deleteAsset, updateDoubleSide, updateTags } = useAssets();
  const { viewerDoubleSide, setViewerDoubleSide } = useAppStore();
  
  const [asset, setAsset] = useState<Asset | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [newTag, setNewTag] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useEffect(() => {
    const loadAsset = async () => {
        if (id) {
            logger.assetDetail.debug('Loading asset:', id);
            setIsLoading(true);
            setIsInitialLoad(true); // Resetear la bandera de carga inicial
            try {
                // Obtener asset desde el contexto (que viene del servidor)
                const loadedAsset = await getAssetFull(id);
                
                // Validar que el asset tiene una URL válida antes de renderizar
                if (loadedAsset && loadedAsset.url) {
                    logger.assetDetail.debug('Asset URL:', loadedAsset.url);
                    setAsset(loadedAsset);
                    // Sync global state with asset property on load
                    setViewerDoubleSide(!!loadedAsset.doubleSide);
                    // Marcar como carga completa después de un pequeño delay para evitar que se dispare el efecto de sincronización
                    setTimeout(() => setIsInitialLoad(false), 100);
                } else {
                    logger.assetDetail.error('Asset cargado pero sin URL válida:', loadedAsset);
                    setAsset(undefined);
                    setIsInitialLoad(false);
                }
            } catch (error) {
                logger.assetDetail.error('Error loading asset:', error);
                setAsset(undefined);
                setIsInitialLoad(false);
            } finally {
                setIsLoading(false);
            }
        }
    };
    loadAsset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, getAssetFull]); // Re-cargar cuando cambia el ID o la función getAssetFull

  // Sincronizar cambios de doubleSide del store con la base de datos
  // Solo actualizar si no es la carga inicial
  // IMPORTANTE: Este hook debe estar ANTES de los retornos condicionales
  useEffect(() => {
    if (isInitialLoad || !asset || !asset.id) return;
    
    const currentDoubleSide = !!asset.doubleSide;
    
    // Solo actualizar si el valor realmente cambió
    if (currentDoubleSide !== viewerDoubleSide) {
      updateDoubleSide(asset, viewerDoubleSide).catch(err => {
        logger.assetDetail.error('Error updating doubleSide in DB:', err);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerDoubleSide, isInitialLoad]);

  // Note: Ya no necesitamos limpiar Blob URLs aquí manualmente porque ahora se gestionan en db.ts
  // con el sistema de cache. Se revocan automáticamente cuando se elimina un asset o cuando el cache excede el límite.

  if (isLoading) {
      return (
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-950 transition-colors">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      );
  }

  if (!asset) {
    return (
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-950 transition-colors">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">Modelo no encontrado</h2>
            <button 
                onClick={() => navigate('/')}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
                <ArrowLeft size={18} />
                Volver a la galería
            </button>
        </div>
    );
  }

  const handleDelete = async () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    setShowDeleteConfirm(false);
    if (asset) {
      await deleteAsset(asset);
      navigate('/');
    }
  };

  const handleAddTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTag.trim() || !asset) return;
    
    const currentTags = asset.tags || [];
    // Evitar duplicados
    if (currentTags.includes(newTag.trim())) {
        setNewTag('');
        return;
    }
    
    const updatedTags = [...currentTags, newTag.trim()];
    
    // Update local state
    setAsset(prev => prev ? { ...prev, tags: updatedTags } : undefined);
    setNewTag('');
    
    // Update DB
    await updateTags(asset, updatedTags);
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    if (!asset) return;
    const currentTags = asset.tags || [];
    const updatedTags = currentTags.filter(t => t !== tagToRemove);
    
    setAsset(prev => prev ? { ...prev, tags: updatedTags } : undefined);
    await updateTags(asset, updatedTags);
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-white dark:bg-gray-900 overflow-hidden font-sans text-gray-900 dark:text-gray-100 transition-colors duration-200">
        <div className="h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center px-6 justify-between shrink-0 transition-colors duration-200">
          <button 
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors group"
          >
            <div className="p-1 rounded-md group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 transition-colors">
              <ArrowLeft size={18} />
            </div>
            Volver a la galería
          </button>
          <span className="font-bold text-gray-800 dark:text-gray-200">{asset.name}</span>
          <div className="w-32 flex justify-end">
            <button
              onClick={handleDelete}
              className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              title="Eliminar modelo"
            >
              <Trash2 size={18} />
            </button>
          </div> 
        </div>
        
        <div className="flex-1 relative bg-gray-900 overflow-hidden">
           <Viewer3D asset={asset} />
           
           <div className="absolute bottom-6 left-6 flex items-end gap-3 pointer-events-none">
             <div className="bg-white/95 dark:bg-gray-900/90 backdrop-blur shadow-2xl rounded-xl p-5 max-w-sm border border-gray-100 dark:border-gray-800 pointer-events-auto transition-colors duration-200">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 uppercase tracking-wider">
                    {asset.categoryId === 'scene' ? 'Escenario' : asset.categoryId === 'character' ? 'Personaje' : 'Prop'}
                  </span>
                  <span className="text-gray-400 dark:text-gray-600 text-xs">•</span>
                  <span className="text-gray-500 dark:text-gray-400 text-xs">{asset.metadata.createdDate}</span>
                </div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2 leading-tight">{asset.name}</h2>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 leading-relaxed">{asset.description}</p>
                
                <div className="mb-4">
                  <div className="flex flex-wrap gap-2 mb-2">
                    {asset.tags?.map(tag => (
                      <span key={tag} className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded text-xs group/tag">
                        <Tag size={10} />
                        {tag}
                        <button 
                          onClick={() => handleRemoveTag(tag)}
                          className="opacity-0 group-hover/tag:opacity-100 hover:text-red-500 transition-all ml-1"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <form onSubmit={handleAddTag} className="flex gap-2">
                    <input
                      type="text"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      placeholder="Añadir etiqueta..."
                      className="flex-1 px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded bg-transparent text-gray-800 dark:text-gray-200 focus:outline-none focus:border-blue-500 transition-colors placeholder:text-gray-400"
                    />
                    <button 
                      type="submit"
                      disabled={!newTag.trim()}
                      className="px-2 py-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 rounded disabled:opacity-50 transition-colors"
                    >
                      <Plus size={14} />
                    </button>
                  </form>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-100 dark:border-gray-800 mb-4">
                   <div>
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-bold">Tamaño</span>
                      <p className="font-mono text-sm font-medium text-gray-700 dark:text-gray-200">{asset.fileSize || 'N/A'}</p>
                   </div>
                   <div>
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-bold">Polígonos</span>
                      <p className="font-mono text-sm font-medium text-gray-700 dark:text-gray-200">{asset.metadata.polygons.toLocaleString()}</p>
                   </div>
                   <div>
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-bold">Vértices</span>
                      <p className="font-mono text-sm font-medium text-gray-700 dark:text-gray-200">{asset.metadata.vertices.toLocaleString()}</p>
                   </div>
                </div>

                <div className="flex gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                  <div className="flex w-full gap-2">
                    {asset.unityPackageUrl && (
                      <a href={asset.unityPackageUrl} download={`${asset.name}.unitypackage`} className="flex-1 flex items-center justify-center gap-2 px-2 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-xs font-medium transition-colors" title="Descargar Unity Package">
                        <FileBox size={14} />
                        Unity
                      </a>
                    )}
                    {asset.fbxZipUrl && (
                      <a href={asset.fbxZipUrl} download={`${asset.name}.zip`} className="flex-1 flex items-center justify-center gap-2 px-2 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-xs font-medium transition-colors" title="Descargar FBX + Texturas">
                        <FileArchive size={14} />
                        FBX
                      </a>
                    )}
                    <a href={asset.url} download={`${asset.name}.glb`} className="flex-1 flex items-center justify-center gap-2 px-2 py-2 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-medium transition-colors" title="Descargar GLB">
                        <Download size={14} />
                        GLB
                      </a>
                  </div>
                </div>

             </div>
           </div>
        </div>

        {asset && (
          <ConfirmDialog
            isOpen={showDeleteConfirm}
            title="Eliminar Modelo"
            message={`¿Estás seguro de que quieres eliminar "${asset.name}"? Esta acción no se puede deshacer.`}
            confirmText="Eliminar"
            cancelText="Cancelar"
            onConfirm={confirmDelete}
            onCancel={() => setShowDeleteConfirm(false)}
            variant="danger"
          />
        )}
    </div>
  );
};
