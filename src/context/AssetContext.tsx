import React, { createContext, useContext, useEffect, ReactNode, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import toast from 'react-hot-toast';
import { Asset } from '../types';
import { 
  db, 
  initDB, 
  saveAssetToDb, 
  deleteAssetFromDb, 
  updateAssetInDb, 
  getAssetWithBlobs 
} from '../services/db';
import { thumbnailGenerator } from '../services/thumbnailGenerator';
import { logger } from '../utils/logger';
import {
  syncFromServer,
  syncAssetToServer,
  updateAssetMetadataOnServer,
  updateAssetFilesOnServer,
  deleteAssetFromServer
} from '../services/serverSync';
import { useAppStore } from '../store/useAppStore';
import { SYNC_INTERVAL, formatFileSize } from '../config/constants';

interface AssetContextType {
  assets: Asset[];
  getAsset: (id: string) => Asset | undefined; // Returns metadata from list
  getAssetFull: (id: string) => Promise<Asset | undefined>; // Returns full asset with blobs/URLs
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
  // Keep a single init promise to avoid racing migrations / double work
  const initPromiseRef = useRef<Promise<void> | null>(null);
  const { setLoading, setSyncing } = useAppStore();
  
  // Initialize DB and sync from server
  useEffect(() => {
    if (!initPromiseRef.current) {
      initPromiseRef.current = initDB();
    }
    initPromiseRef.current
      .then(async () => {
        // Después de inicializar IndexedDB, sincronizar desde el servidor (fuente de verdad)
        logger.assetContext.debug("Sincronizando desde servidor al iniciar...");
        setSyncing(true);
        try {
          await syncFromServer();
        } catch (error) {
          logger.assetContext.warn("Error sincronizando desde servidor al iniciar:", error);
        } finally {
          setSyncing(false);
        }
      })
      .catch((error) => {
        logger.assetContext.error('Error initializing database:', error);
      });
  }, [setSyncing]);

  // Sincronización periódica cada 30 segundos (mantener datos actualizados desde otras ventanas)
  // Esta sincronización es silenciosa - no muestra el overlay de loading
  useEffect(() => {
    const syncInterval = setInterval(async () => {
      logger.assetContext.debug("Sincronización periódica desde servidor...");
      try {
        await syncFromServer();
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
        await syncFromServer();
      } catch (error) {
        logger.assetContext.debug("Error sincronizando al recuperar foco:", error);
      }
      // No activamos setSyncing para que sea silenciosa
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  // Live Query for Assets List (Metadata only)
  // We use useLiveQuery to automatically update when DB changes
  const assets = useLiveQuery(
    async () => {
      // We explicitly cast because the DB stores StoredAsset but we want to return Asset compatible objects
      // Note: These assets will NOT have valid 'url' for GLB, as that's in 'files' table.
      // They WILL have 'thumbnailBlob' if available.
      const items = await db.assets.toArray();
      
      // Calcular fileSize para cada asset si no existe
      const assetsWithSize = await Promise.all(
        items.map(async (item) => {
          // StoredAsset omite url/thumbnail pero puede tenerlos en datos legacy
          const legacyAsset = item as unknown as Partial<Asset>;
          
          // Si ya tiene fileSize, usarlo
          let fileSize = item.fileSize;
          
          // Si no tiene fileSize, calcularlo desde el blob del GLB
          if (!fileSize) {
            const files = await db.files.get(item.id);
            if (files?.glb && files.glb instanceof Blob) {
              fileSize = formatFileSize(files.glb.size);
            }
          }
          
          return {
            ...item,
            url: legacyAsset.url || '', // Placeholder or legacy URL
            thumbnail: legacyAsset.thumbnail || '', // Placeholder or legacy URL
            unityPackageUrl: legacyAsset.unityPackageUrl,
            fbxZipUrl: legacyAsset.fbxZipUrl,
            fileSize // Incluir fileSize calculado
          } as Asset;
        })
      );
      
      return assetsWithSize;
    },
    []
  ) || [];

  const getAsset = (id: string) => {
    return assets.find(a => a.id === id);
  };

  const getAssetFull = async (id: string) => {
    // Ensure DB initialization/migration has finished before trying to read blobs
    if (!initPromiseRef.current) {
      initPromiseRef.current = initDB();
    }
    try {
      await initPromiseRef.current;
    } catch {
      // If init fails (e.g. server offline) we still attempt to read whatever exists locally
    }
    return await getAssetWithBlobs(id);
  };

  const addAsset = async (newAsset: Asset, files: { glb: File, thumbnail: File | null, unity: File | null, zip: File | null }) => {
    setLoading(true, 'Guardando modelo...');
    try {
      // 1. Guardar en IndexedDB local (siempre primero para tener datos localmente)
      await saveAssetToDb(newAsset, files);
      
      // 2. Sincronizar con servidor (en paralelo, no bloquea si falla)
      setLoading(true, 'Sincronizando con servidor...');
      await syncAssetToServer(newAsset, {
        glb: files.glb,
        thumbnail: files.thumbnail,
        unity: files.unity,
        zip: files.zip
      }).catch(() => {
        // Si falla la sincronización, solo logueamos - no bloqueamos el flujo
        logger.assetContext.debug("Sincronización con servidor falló, pero asset guardado localmente");
      });
      
      toast.success('Modelo guardado correctamente');
    } catch (error) {
      logger.assetContext.error("Error guardando el asset:", error);
      toast.error('Hubo un error guardando el modelo localmente');
    } finally {
      setLoading(false);
    }
  };

  const deleteAsset = async (asset: Asset) => {
    setLoading(true, 'Eliminando modelo...');
    try {
      // 1. Eliminar de IndexedDB local
      await deleteAssetFromDb(asset.id);
      
      // 2. Eliminar del servidor (en paralelo, no bloquea si falla)
      setLoading(true, 'Sincronizando con servidor...');
      await deleteAssetFromServer(asset.id).catch(() => {
        logger.assetContext.debug("Eliminación en servidor falló, pero asset eliminado localmente");
      });
      
      toast.success('Modelo eliminado correctamente');
    } catch (error) {
      logger.assetContext.error("Error eliminando asset:", error);
      toast.error('Hubo un error eliminando el modelo de la base de datos');
    } finally {
      setLoading(false);
    }
  };

  const deleteAssets = async (assetsToDelete: Asset[]) => {
    if (assetsToDelete.length === 0) return;
    
    setLoading(true, `Eliminando ${assetsToDelete.length} modelo(s)...`);
    try {
      let successCount = 0;
      let failCount = 0;
      
      // Eliminar de IndexedDB local y del servidor
      for (const asset of assetsToDelete) {
        try {
          // 1. Eliminar de IndexedDB local
          await deleteAssetFromDb(asset.id);
          
          // 2. Eliminar del servidor (no bloquea si falla)
          await deleteAssetFromServer(asset.id).catch(() => {
            logger.assetContext.debug(`Eliminación en servidor falló para ${asset.id}, pero eliminado localmente`);
          });
          
          successCount++;
        } catch (error) {
          logger.assetContext.error(`Error eliminando asset ${asset.id}:`, error);
          failCount++;
        }
      }
      
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
    setLoading(true, 'Actualizando nombre...');
    try {
      const updatedAsset = { ...asset, name: newName };
      // 1. Actualizar en IndexedDB local
      await updateAssetInDb(updatedAsset);
      
      // 2. Sincronizar metadata con servidor
      await updateAssetMetadataOnServer(updatedAsset).catch(() => {
        logger.assetContext.debug("Actualización de nombre en servidor falló, pero actualizado localmente");
      });
      
      toast.success('Nombre actualizado correctamente');
    } catch (error) {
      logger.assetContext.error("Error actualizando nombre:", error);
      toast.error('Error al actualizar el nombre');
    } finally {
      setLoading(false);
    }
  };

  const updateAssetFile = async (asset: Asset, type: 'unity' | 'zip', file: File) => {
    setLoading(true, `Actualizando archivo ${type}...`);
    try {
      let updatedAsset = { ...asset };
      
      // 1. Actualizar en IndexedDB local
      if (type === 'unity') {
          await updateAssetInDb(updatedAsset, undefined, file, undefined);
      } else {
          await updateAssetInDb(updatedAsset, undefined, undefined, file);
      }
      
      // 2. Sincronizar archivo con servidor
      setLoading(true, 'Sincronizando archivo con servidor...');
      await updateAssetFilesOnServer(updatedAsset, {
        unity: type === 'unity' ? file : undefined,
        zip: type === 'zip' ? file : undefined
      }).catch(() => {
        logger.assetContext.debug("Actualización de archivo en servidor falló, pero actualizado localmente");
      });
      
      toast.success('Archivo actualizado correctamente');
    } catch (error) {
      logger.assetContext.error("Error actualizando archivo en DB:", error);
      toast.error('Hubo un error guardando el archivo en la base de datos');
    } finally {
      setLoading(false);
    }
  };

  const updateDoubleSide = async (asset: Asset, checked: boolean) => {
      const updatedAsset = { ...asset, doubleSide: checked };
      
      try {
          // 1. Regenerar thumbnail si es necesario
          const fullAsset = await getAssetFull(asset.id);
          let newThumbnailBlob: Blob | null = null;
          
          if (fullAsset && fullAsset.url) {
             const fileRecord = await db.files.get(asset.id);
             if (fileRecord && fileRecord.glb) {
                 newThumbnailBlob = await thumbnailGenerator.generateFromBlob(fileRecord.glb, { doubleSide: checked });
                 await updateAssetInDb(updatedAsset, newThumbnailBlob);
             } else {
                 // Fallback if no local blob (legacy asset?)
                 await updateAssetInDb(updatedAsset);
             }
          }
          
          // 2. Sincronizar con servidor
          // Si hay thumbnail nuevo, actualizamos archivos; si no, solo metadata
          if (newThumbnailBlob) {
            updateAssetFilesOnServer(updatedAsset, {
              thumbnail: newThumbnailBlob
            }).catch(() => {
              logger.assetContext.debug("Actualización de doubleSide en servidor falló, pero actualizado localmente");
            });
          } else {
            updateAssetMetadataOnServer(updatedAsset).catch(() => {
              logger.assetContext.debug("Actualización de doubleSide en servidor falló, pero actualizado localmente");
            });
          }
      } catch (error) {
        logger.assetContext.error("Error updating double side:", error);
        toast.error('Error al actualizar la configuración de renderizado');
      }
  };

  const updateCategory = async (asset: Asset, newCategoryId: string) => {
    try {
      const updatedAsset = { ...asset, categoryId: newCategoryId };
      // 1. Actualizar en IndexedDB local
      await updateAssetInDb(updatedAsset);
      
      // 2. Sincronizar con servidor
      updateAssetMetadataOnServer(updatedAsset).catch(() => {
        logger.assetContext.debug("Actualización de categoría en servidor falló, pero actualizada localmente");
      });
      
      toast.success('Categoría actualizada');
    } catch (error) {
      logger.assetContext.error("Error actualizando categoría:", error);
      toast.error('Error al actualizar la categoría');
    }
  };

  const updateTags = async (asset: Asset, newTags: string[]) => {
    try {
      const updatedAsset = { ...asset, tags: newTags };
      // 1. Actualizar en IndexedDB local
      await updateAssetInDb(updatedAsset);
      
      // 2. Sincronizar con servidor
      updateAssetMetadataOnServer(updatedAsset).catch(() => {
        logger.assetContext.debug("Actualización de etiquetas en servidor falló, pero actualizadas localmente");
      });
      
      toast.success('Etiquetas actualizadas');
    } catch (error) {
      logger.assetContext.error("Error actualizando etiquetas:", error);
      toast.error('Error al actualizar las etiquetas');
    }
  };

  const updateAssetInfo = async (asset: Asset, updates: { name?: string; description?: string; categoryId?: string; tags?: string[] }) => {
    setLoading(true, 'Actualizando información...');
    try {
      const updatedAsset = { 
        ...asset, 
        ...(updates.name && { name: updates.name }),
        ...(updates.description !== undefined && { description: updates.description }),
        ...(updates.categoryId && { categoryId: updates.categoryId }),
        ...(updates.tags && { tags: updates.tags })
      };
      
      // 1. Actualizar en IndexedDB local
      await updateAssetInDb(updatedAsset);
      
      // 2. Sincronizar con servidor
      await updateAssetMetadataOnServer(updatedAsset).catch(() => {
        logger.assetContext.debug("Actualización de información en servidor falló, pero actualizada localmente");
      });
      
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
