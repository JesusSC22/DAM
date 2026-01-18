import React, { createContext, useContext, useEffect, ReactNode, useState } from 'react';
import toast from 'react-hot-toast';
import { Asset } from '../types';
import { logger } from '../utils/logger';
import {
  syncFromServer,
  syncAssetToServer,
  updateAssetMetadataOnServer,
  updateAssetFilesOnServer,
  deleteAssetFromServer
} from '../services/serverSync';
import { useAppStore } from '../store/useAppStore';
import { SYNC_INTERVAL } from '../config/constants';

interface AssetContextType {
  assets: Asset[];
  getAsset: (id: string) => Asset | undefined; // Returns metadata from list
  getAssetFull: (id: string) => Promise<Asset | undefined>; // Returns full asset with URLs from server
  addAsset: (newAsset: Asset, files: { glb: File, thumbnail: File | null, unity: File | null, zip: File | null }) => Promise<void>;
  deleteAsset: (asset: Asset) => Promise<void>;
  deleteAssets: (assets: Asset[]) => Promise<void>; // Delete multiple assets
  renameAsset: (asset: Asset, newName: string) => Promise<void>;
  updateAssetFile: (asset: Asset, type: 'unity' | 'zip', file: File) => Promise<void>;
  updateDoubleSide: (asset: Asset, checked: boolean) => Promise<void>;
  updateCategory: (asset: Asset, newCategoryId: string) => Promise<void>;
  updateTags: (asset: Asset, newTags: string[]) => Promise<void>;
  updateAssetInfo: (asset: Asset, updates: { name?: string; description?: string; categoryId?: string; tags?: string[] }) => Promise<void>;
}

const AssetContext = createContext<AssetContextType | undefined>(undefined);

export function AssetProvider({ children }: { children: ReactNode }) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const { setLoading, setSyncing } = useAppStore();
  
  // Cargar assets desde el servidor al iniciar
  useEffect(() => {
    const loadAssets = async () => {
      logger.assetContext.debug("Cargando assets desde servidor al iniciar...");
      setSyncing(true);
      try {
        const serverAssets = await syncFromServer();
        setAssets(serverAssets);
      } catch (error) {
        logger.assetContext.warn("Error cargando assets desde servidor al iniciar:", error);
      } finally {
        setSyncing(false);
      }
    };
    
    loadAssets();
  }, [setSyncing]);

  // Sincronización periódica cada 30 segundos (mantener datos actualizados desde otras ventanas)
  // Esta sincronización es silenciosa - no muestra el overlay de loading
  useEffect(() => {
    const syncInterval = setInterval(async () => {
      logger.assetContext.debug("Sincronización periódica desde servidor...");
      try {
        const serverAssets = await syncFromServer();
        setAssets(serverAssets);
      } catch (error) {
        logger.assetContext.debug("Error en sincronización periódica:", error);
      }
      // No activamos setSyncing para que sea silenciosa
    }, SYNC_INTERVAL); // Intervalo configurado en constants.ts

    return () => clearInterval(syncInterval);
  }, []);

  // Sincronizar cuando la ventana recupera el foco (detecta cambios de otras ventanas)
  // Esta sincronización es silenciosa - no muestra el overlay de loading
  useEffect(() => {
    const handleFocus = async () => {
      logger.assetContext.debug("Ventana recuperó foco, sincronizando desde servidor...");
      try {
        const serverAssets = await syncFromServer();
        setAssets(serverAssets);
      } catch (error) {
        logger.assetContext.debug("Error sincronizando al recuperar foco:", error);
      }
      // No activamos setSyncing para que sea silenciosa
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const getAsset = (id: string) => {
    return assets.find(a => a.id === id);
  };

  const getAssetFull = async (id: string): Promise<Asset | undefined> => {
    // Primero buscar en el estado
    let asset = assets.find(a => a.id === id);
    
    // Si no está en el estado, intentar obtenerlo directamente del servidor
    if (!asset && SERVER_URL && SERVER_URL.trim() !== '') {
      try {
        const response = await fetch(`${SERVER_URL}/api/assets/${id}`);
        if (response.ok) {
          const serverAsset = await response.json();
          
          // Construir URLs completas
          const fixUrl = (u: string | undefined) => {
            if (!u) return '';
            return u.startsWith('http') ? u : `${SERVER_URL}${u}`;
          };
          
          asset = {
            ...serverAsset,
            url: fixUrl(serverAsset.url),
            thumbnail: fixUrl(serverAsset.thumbnail),
            unityPackageUrl: serverAsset.unityPackageUrl ? fixUrl(serverAsset.unityPackageUrl) : undefined,
            fbxZipUrl: serverAsset.fbxZipUrl ? fixUrl(serverAsset.fbxZipUrl) : undefined,
          } as Asset;
          
          // Agregar al estado para futuras referencias
          setAssets(prev => {
            const exists = prev.find(a => a.id === id);
            if (!exists) {
              return [...prev, asset!];
            }
            return prev;
          });
        }
      } catch (error) {
        logger.assetContext.error("Error obteniendo asset del servidor:", error);
      }
    }
    
    return asset;
  };

  const addAsset = async (newAsset: Asset, files: { glb: File, thumbnail: File | null, unity: File | null, zip: File | null }) => {
    setLoading(true, 'Subiendo modelo al servidor...');
    try {
      // Subir directamente al servidor
      const success = await syncAssetToServer(newAsset, {
        glb: files.glb,
        thumbnail: files.thumbnail,
        unity: files.unity,
        zip: files.zip
      });
      
      if (!success) {
        throw new Error('Error al subir el modelo al servidor');
      }
      
      // Recargar assets desde el servidor para obtener las URLs correctas
      const serverAssets = await syncFromServer();
      setAssets(serverAssets);
      
      toast.success('Modelo subido correctamente');
    } catch (error) {
      logger.assetContext.error("Error subiendo el asset:", error);
      toast.error('Hubo un error subiendo el modelo al servidor');
    } finally {
      setLoading(false);
    }
  };

  const deleteAsset = async (asset: Asset) => {
    setLoading(true, 'Eliminando modelo del servidor...');
    try {
      // Eliminar del servidor
      const success = await deleteAssetFromServer(asset.id);
      
      if (!success) {
        throw new Error('Error al eliminar el modelo del servidor');
      }
      
      // Actualizar estado local
      setAssets(prev => prev.filter(a => a.id !== asset.id));
      
      toast.success('Modelo eliminado correctamente');
    } catch (error) {
      logger.assetContext.error("Error eliminando asset:", error);
      toast.error('Hubo un error eliminando el modelo del servidor');
    } finally {
      setLoading(false);
    }
  };

  const deleteAssets = async (assetsToDelete: Asset[]) => {
    if (assetsToDelete.length === 0) return;
    
    setLoading(true, `Eliminando ${assetsToDelete.length} modelo(s) del servidor...`);
    try {
      let successCount = 0;
      let failCount = 0;
      
      // Eliminar del servidor
      for (const asset of assetsToDelete) {
        try {
          const success = await deleteAssetFromServer(asset.id);
          if (success) {
            successCount++;
          } else {
            failCount++;
          }
        } catch (error) {
          logger.assetContext.error(`Error eliminando asset ${asset.id}:`, error);
          failCount++;
        }
      }
      
      // Actualizar estado local
      const deletedIds = new Set(assetsToDelete.map(a => a.id));
      setAssets(prev => prev.filter(a => !deletedIds.has(a.id)));
      
      if (successCount > 0) {
        toast.success(`${successCount} modelo(s) eliminado(s) correctamente${failCount > 0 ? ` (${failCount} fallaron)` : ''}`);
      } else {
        toast.error('No se pudo eliminar ningún modelo');
      }
    } catch (error) {
      logger.assetContext.error("Error en eliminación en lote:", error);
      toast.error('Hubo un error eliminando los modelos');
    } finally {
      setLoading(false);
    }
  };

  const renameAsset = async (asset: Asset, newName: string) => {
    setLoading(true, 'Actualizando nombre en servidor...');
    try {
      const updatedAsset = { ...asset, name: newName };
      
      // Actualizar en servidor
      const success = await updateAssetMetadataOnServer(updatedAsset);
      
      if (!success) {
        throw new Error('Error al actualizar el nombre en el servidor');
      }
      
      // Actualizar estado local
      setAssets(prev => prev.map(a => a.id === asset.id ? updatedAsset : a));
      
      toast.success('Nombre actualizado correctamente');
    } catch (error) {
      logger.assetContext.error("Error actualizando nombre:", error);
      toast.error('Error al actualizar el nombre');
    } finally {
      setLoading(false);
    }
  };

  const updateAssetFile = async (asset: Asset, type: 'unity' | 'zip', file: File) => {
    setLoading(true, `Actualizando archivo ${type} en servidor...`);
    try {
      // Actualizar archivo en servidor
      const success = await updateAssetFilesOnServer(asset, {
        unity: type === 'unity' ? file : undefined,
        zip: type === 'zip' ? file : undefined
      });
      
      if (!success) {
        throw new Error('Error al actualizar el archivo en el servidor');
      }
      
      // Recargar assets desde el servidor para obtener las URLs actualizadas
      const serverAssets = await syncFromServer();
      setAssets(serverAssets);
      
      toast.success('Archivo actualizado correctamente');
    } catch (error) {
      logger.assetContext.error("Error actualizando archivo:", error);
      toast.error('Hubo un error actualizando el archivo en el servidor');
    } finally {
      setLoading(false);
    }
  };

  const updateDoubleSide = async (asset: Asset, checked: boolean) => {
      const updatedAsset = { ...asset, doubleSide: checked };
      
      try {
          // Actualizar metadata en servidor
          const success = await updateAssetMetadataOnServer(updatedAsset);
          
          if (!success) {
            throw new Error('Error al actualizar la configuración en el servidor');
          }
          
          // Actualizar estado local
          setAssets(prev => prev.map(a => a.id === asset.id ? updatedAsset : a));
          
          toast.success('Configuración actualizada correctamente');
      } catch (error) {
        logger.assetContext.error("Error updating double side:", error);
        toast.error('Error al actualizar la configuración de renderizado');
      }
  };

  const updateCategory = async (asset: Asset, newCategoryId: string) => {
    try {
      const updatedAsset = { ...asset, categoryId: newCategoryId };
      
      // Actualizar en servidor
      const success = await updateAssetMetadataOnServer(updatedAsset);
      
      if (!success) {
        throw new Error('Error al actualizar la categoría en el servidor');
      }
      
      // Actualizar estado local
      setAssets(prev => prev.map(a => a.id === asset.id ? updatedAsset : a));
      
      toast.success('Categoría actualizada');
    } catch (error) {
      logger.assetContext.error("Error actualizando categoría:", error);
      toast.error('Error al actualizar la categoría');
    }
  };

  const updateTags = async (asset: Asset, newTags: string[]) => {
    try {
      const updatedAsset = { ...asset, tags: newTags };
      
      // Actualizar en servidor
      const success = await updateAssetMetadataOnServer(updatedAsset);
      
      if (!success) {
        throw new Error('Error al actualizar las etiquetas en el servidor');
      }
      
      // Actualizar estado local
      setAssets(prev => prev.map(a => a.id === asset.id ? updatedAsset : a));
      
      toast.success('Etiquetas actualizadas');
    } catch (error) {
      logger.assetContext.error("Error actualizando etiquetas:", error);
      toast.error('Error al actualizar las etiquetas');
    }
  };

  const updateAssetInfo = async (asset: Asset, updates: { name?: string; description?: string; categoryId?: string; tags?: string[] }) => {
    setLoading(true, 'Actualizando información en servidor...');
    try {
      const updatedAsset = { 
        ...asset, 
        ...(updates.name && { name: updates.name }),
        ...(updates.description !== undefined && { description: updates.description }),
        ...(updates.categoryId && { categoryId: updates.categoryId }),
        ...(updates.tags && { tags: updates.tags })
      };
      
      // Actualizar en servidor
      const success = await updateAssetMetadataOnServer(updatedAsset);
      
      if (!success) {
        throw new Error('Error al actualizar la información en el servidor');
      }
      
      // Actualizar estado local
      setAssets(prev => prev.map(a => a.id === asset.id ? updatedAsset : a));
      
      toast.success('Información actualizada correctamente');
    } catch (error) {
      logger.assetContext.error("Error actualizando información:", error);
      toast.error('Error al actualizar la información');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AssetContext.Provider value={{ 
      assets, 
      getAsset, 
      getAssetFull,
      addAsset, 
      deleteAsset,
      deleteAssets,
      renameAsset, 
      updateAssetFile,
      updateDoubleSide,
      updateCategory,
      updateTags,
      updateAssetInfo
    }}>
      {children}
    </AssetContext.Provider>
  );
}

export function useAssets() {
  const context = useContext(AssetContext);
  if (context === undefined) {
    throw new Error('useAssets must be used within an AssetProvider');
  }
  return context;
}
