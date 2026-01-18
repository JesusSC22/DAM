import Dexie, { Table } from 'dexie';
import { Asset } from '../types';
import { logger } from '../utils/logger';
import { SERVER_URL } from '../config/constants';
import { formatFileSize } from '../config/constants';


// Límite de cache de Blob URLs para prevenir memory leaks (LRU-like)
const MAX_BLOB_URL_CACHE_SIZE = 50;

export interface StoredAsset extends Omit<Asset, 'url' | 'thumbnail' | 'unityPackageUrl' | 'fbxZipUrl'> {
  thumbnailBlob?: Blob; // Stored directly in metadata table for faster access (if small)
}

export interface AssetFile {
  assetId: string;
  glb: Blob;
  unity?: Blob;
  zip?: Blob;
}

export class AppDatabase extends Dexie {
  assets!: Table<StoredAsset>;
  files!: Table<AssetFile>;

  constructor() {
    super('AssetDatabase');
    this.version(1).stores({
      assets: 'id, categoryId, name',
      files: 'assetId'
    });
  }
}

export const db = new AppDatabase();

// Helper to save asset (needed by initDB and exported for service)
export const saveAssetToDb = async (asset: Asset, files: {
  glb: Blob,
  thumbnail?: Blob | null,
  unity?: Blob | null,
  zip?: Blob | null
}): Promise<void> => {
  // Separate metadata and files
  const { url, thumbnail, unityPackageUrl, fbxZipUrl, thumbnailBlob, ...meta } = asset;
  
  // Asegurar que categoryId sea válido (no 'all' ni undefined)
  const validCategoryId = meta.categoryId && meta.categoryId !== 'all' ? meta.categoryId : 'prop';
  
  const storedAsset: StoredAsset = {
    ...meta,
    categoryId: validCategoryId,
    thumbnailBlob: files.thumbnail || undefined
  };

  const assetFiles: AssetFile = {
    assetId: asset.id,
    glb: files.glb,
    unity: files.unity || undefined,
    zip: files.zip || undefined
  };

  await db.transaction('rw', db.assets, db.files, async () => {
    // Dexie requiere 'as any' porque StoredAsset no incluye todas las propiedades que espera
    // pero esto es seguro porque separamos metadata de URLs
    await db.assets.put(storedAsset as unknown as StoredAsset);
    await db.files.put(assetFiles);
  });
};

/**
 * Inicializa la base de datos IndexedDB
 * 
 * IndexedDB es un CACHE local para performance y funcionamiento offline.
 * El servidor Express es la FUENTE ÚNICA DE VERDAD.
 * 
 * Siempre sincroniza desde el servidor al iniciar para tener los datos más actuales.
 */
export const initDB = async () => {
  // La sincronización desde servidor se hace en AssetContext usando syncFromServer()
  // para mantener toda la lógica de sincronización en un solo lugar
  logger.db.debug("IndexedDB inicializado. La sincronización se hará desde AssetContext.");
};

// Cache de Blob URLs para evitar generar nuevos cada vez (LRU-like con límite)
const blobUrlCache = new Map<string, string>();

// Helper para limpiar cache cuando excede el límite (elimina el más antiguo)
const cleanupBlobUrlCache = () => {
  if (blobUrlCache.size > MAX_BLOB_URL_CACHE_SIZE) {
    // Obtener la primera entrada (más antigua en Map)
    const firstKey = blobUrlCache.keys().next().value;
    if (firstKey) {
      const urlToRevoke = blobUrlCache.get(firstKey);
      if (urlToRevoke) {
        URL.revokeObjectURL(urlToRevoke);
      }
      blobUrlCache.delete(firstKey);
      logger.db.debug(`Revoked old Blob URL from cache: ${firstKey}`);
    }
  }
};

// Helper para verificar si una blob URL es válida (sin hacer fetch costoso)
// En la práctica, las blob URLs solo se invalidan cuando se revocan explícitamente
// Así que confiamos en que si está en cache, es válida
const isBlobUrlValid = (url: string): boolean => {
  if (!url.startsWith('blob:')) return true; // URLs no-blob se consideran válidas
  // Si está en el cache, asumimos que es válida (se revoca explícitamente cuando se elimina del cache)
  // Solo verificamos si la URL tiene el formato correcto
  return url.startsWith('blob:') && url.length > 5;
};

// Helper para obtener o crear Blob URL con cache
// Siempre regenera la URL para asegurar que sea válida (las blob URLs pueden invalidarse)
const getOrCreateBlobURL = (blob: Blob, cacheKey: string, forceRegenerate: boolean = false): string => {
  const cached = blobUrlCache.get(cacheKey);
  
  // Si no se fuerza la regeneración y hay una URL en cache válida, usarla
  if (!forceRegenerate && cached && isBlobUrlValid(cached)) {
    return cached;
  }
  
  // Si había una URL en cache (válida o no), limpiarla primero
  if (cached) {
    blobUrlCache.delete(cacheKey);
    try {
      URL.revokeObjectURL(cached);
      logger.db.debug(`Revoked old Blob URL for ${cacheKey}${forceRegenerate ? ' (forced regeneration)' : ' (invalid format)'}`);
    } catch (e) {
      // Ignorar errores al revocar URLs ya inválidas
    }
  }
  
  // Limpiar cache antes de agregar uno nuevo si es necesario
  cleanupBlobUrlCache();
  
  // Crear nueva blob URL desde el blob original
  const newUrl = URL.createObjectURL(blob);
  blobUrlCache.set(cacheKey, newUrl);
  logger.db.debug(`Created new Blob URL for ${cacheKey}`);
  return newUrl;
};

// Función pública para limpiar Blob URLs cuando se elimina un asset
export const revokeBlobUrlsForAsset = (assetId: string): void => {
  const keysToRevoke = [`${assetId}:glb`, `${assetId}:thumbnail`, `${assetId}:unity`, `${assetId}:zip`];
  keysToRevoke.forEach(key => {
    const url = blobUrlCache.get(key);
    if (url) {
      URL.revokeObjectURL(url);
      blobUrlCache.delete(key);
      logger.db.debug(`Revoked Blob URL for ${key}`);
    }
  });
};

// Helper to get asset with generated URLs
export const getAssetWithBlobs = async (id: string, forceRegenerateUrls: boolean = false): Promise<Asset | undefined> => {
  logger.db.debug('getAssetWithBlobs called for:', id, forceRegenerateUrls ? '(forcing URL regeneration)' : '');
  try {
      const assetMeta = await db.assets.get(id);
      if (!assetMeta) {
        logger.db.warn('Asset metadata not found for ID:', id);
        return undefined;
      }

      const files = await db.files.get(id);
      
      // Legacy support: algunos assets antiguos pueden tener URLs directamente en metadata
      // En la nueva arquitectura, estas URLs no deberían existir
      const legacyUrl = (assetMeta as unknown as Partial<Asset>).url;
      const legacyThumbnail = (assetMeta as unknown as Partial<Asset>).thumbnail;
      const legacyUnityUrl = (assetMeta as unknown as Partial<Asset>).unityPackageUrl;
      const legacyZipUrl = (assetMeta as unknown as Partial<Asset>).fbxZipUrl;
      
      let url = legacyUrl || '';
      let thumbnail = legacyThumbnail || '';
      let unityPackageUrl = legacyUnityUrl;
      let fbxZipUrl = legacyZipUrl;

      // If we have blobs, create URLs (siempre regenerar para asegurar validez)
      let glbSize: number | undefined;
      if (files?.glb) {
        if (files.glb instanceof Blob) {
          url = getOrCreateBlobURL(files.glb, `${id}:glb`, forceRegenerateUrls);
          glbSize = files.glb.size;
          logger.db.debug('Using cached or generated Blob URL for GLB, size:', glbSize, 'bytes');
        } else {
          logger.db.error('files.glb is not a Blob:', typeof files.glb);
        }
      } else {
        if (!url) {
          logger.db.error('WARNING: Asset has no URL and no GLB blob!');
        } else {
          logger.db.debug('No GLB blob found, using stored URL');
        }
      }
      
      if (assetMeta.thumbnailBlob) {
        thumbnail = getOrCreateBlobURL(assetMeta.thumbnailBlob, `${id}:thumbnail`, forceRegenerateUrls);
        logger.db.debug('Using cached or generated Blob URL for thumbnail');
      }
    
      if (files?.unity) {
        unityPackageUrl = getOrCreateBlobURL(files.unity, `${id}:unity`, forceRegenerateUrls);
        logger.db.debug('Using cached or generated Blob URL for Unity package');
      }
    
      if (files?.zip) {
        fbxZipUrl = getOrCreateBlobURL(files.zip, `${id}:zip`, forceRegenerateUrls);
        logger.db.debug('Using cached or generated Blob URL for FBX zip');
      }
    
      // Calcular fileSize si no existe y tenemos el blob del GLB
      const fileSize = assetMeta.fileSize || (glbSize ? formatFileSize(glbSize) : undefined);
      
      const result: Asset = {
        ...assetMeta,
        url,
        thumbnail,
        unityPackageUrl,
        fbxZipUrl,
        fileSize
      };
      
      logger.db.debug('Returning asset with URL:', result.url ? 'present' : 'missing');
      return result;
  } catch (e) {
      logger.db.error('Error in getAssetWithBlobs:', e);
      throw e;
  }
};

// CRUD Operations

export const deleteAssetFromDb = async (id: string): Promise<void> => {
  // Revocar Blob URLs antes de eliminar para liberar memoria
  revokeBlobUrlsForAsset(id);
  
  await db.transaction('rw', db.assets, db.files, async () => {
    await db.assets.delete(id);
    await db.files.delete(id);
  });
};

export const updateAssetInDb = async (asset: Asset, newThumbnailBlob?: Blob | null, newUnityBlob?: Blob | null, newZipBlob?: Blob | null): Promise<void> => {
   const existingFiles = await db.files.get(asset.id);
   
   const { url, thumbnail, unityPackageUrl, fbxZipUrl, thumbnailBlob, ...meta } = asset;
   
   // Asegurar que categoryId sea válido (no 'all' ni undefined)
   const validCategoryId = meta.categoryId && meta.categoryId !== 'all' ? meta.categoryId : 'prop';
   
   const updatedMeta: StoredAsset = {
       ...meta,
       categoryId: validCategoryId,
       thumbnailBlob: newThumbnailBlob || (asset.thumbnailBlob)
   };

   const updatedFiles: AssetFile = {
       assetId: asset.id,
       glb: existingFiles?.glb || new Blob(),
       unity: newUnityBlob || existingFiles?.unity,
       zip: newZipBlob || existingFiles?.zip
   };

   await db.transaction('rw', db.assets, db.files, async () => {
       // Similar al saveAssetToDb, necesario para compatibilidad con Dexie
       await db.assets.put(updatedMeta as unknown as StoredAsset);
       if (existingFiles) {
           await db.files.put(updatedFiles);
       }
   });
};
