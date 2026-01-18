/**
 * Servicio de sincronización con servidor Express
 * 
 * El servidor Express es la FUENTE ÚNICA DE VERDAD.
 * Todas las instancias (Chrome, Cursor, app) comparten la misma base de datos en el servidor.
 * IndexedDB es solo un CACHE local para performance y funcionamiento offline.
 * 
 * Sincronización:
 * - Al iniciar: Descarga datos del servidor a IndexedDB
 * - Periódicamente: Sincroniza cada 30 segundos
 * - Al hacer focus: Sincroniza cuando la ventana recupera el foco
 * - Al guardar/eliminar: Sincroniza inmediatamente con el servidor
 */

import { Asset } from '../types';
import { logger } from '../utils/logger';
import { saveAssetToDb } from './db';
import { SERVER_URL } from '../config/constants';

/**
 * Sincroniza TODOS los assets DESDE el servidor hacia IndexedDB local
 * Esta es la función principal para mantener sincronización
 */
export const syncFromServer = async (): Promise<boolean> => {
  // Si no hay servidor configurado (modo demo), no intentar sincronizar
  if (!SERVER_URL || SERVER_URL.trim() === '') {
    logger.default.debug("Modo demo: No hay servidor configurado, omitiendo sincronización");
    return false;
  }
  
  try {
    const response = await fetch(`${SERVER_URL}/api/assets`);
    if (!response.ok) {
      logger.default.warn("Error sincronizando desde servidor:", response.status);
      return false;
    }

    const serverAssets = await response.json();
    if (!Array.isArray(serverAssets)) {
      logger.default.warn("Respuesta del servidor no es un array");
      return false;
    }

    logger.assetContext.info(`Sincronizando ${serverAssets.length} assets desde servidor...`);

    let syncedCount = 0;
    for (const asset of serverAssets) {
      try {
        // Construir URLs completas
        const fixUrl = (u: string) => u?.startsWith('http') ? u : `${SERVER_URL}${u}`;
        
        if (!asset.url) continue;

        // Descargar archivos del servidor
        const glbResp = await fetch(fixUrl(asset.url));
        if (!glbResp.ok) continue;
        const glbBlob = await glbResp.blob();

        let thumbnailBlob = null;
        if (asset.thumbnail) {
          try {
            const thumbResp = await fetch(fixUrl(asset.thumbnail));
            if (thumbResp.ok) thumbnailBlob = await thumbResp.blob();
          } catch (e) {
            logger.default.debug("Fallo descarga thumbnail", asset.name);
          }
        }

        let unityBlob = null;
        if (asset.unityPackageUrl) {
          try {
            const uResp = await fetch(fixUrl(asset.unityPackageUrl));
            if (uResp.ok) unityBlob = await uResp.blob();
          } catch (e) {
            // Archivos opcionales
          }
        }
        
        let zipBlob = null;
        if (asset.fbxZipUrl) {
          try {
            const zResp = await fetch(fixUrl(asset.fbxZipUrl));
            if (zResp.ok) zipBlob = await zResp.blob();
          } catch (e) {
            // Archivos opcionales
          }
        }

        // Limpiar URLs del objeto asset (se almacenan como blobs en IndexedDB)
        const assetToSave = { ...asset };
        delete assetToSave.url;
        delete assetToSave.thumbnail;
        delete assetToSave.unityPackageUrl;
        delete assetToSave.fbxZipUrl;

        // Guardar en IndexedDB local (cache)
        await saveAssetToDb(assetToSave, {
          glb: glbBlob,
          thumbnail: thumbnailBlob,
          unity: unityBlob,
          zip: zipBlob
        });

        syncedCount++;
      } catch (err) {
        logger.assetContext.warn("Error sincronizando asset individual:", err);
      }
    }

    logger.assetContext.info(`Sincronización completada: ${syncedCount}/${serverAssets.length} assets`);
    return true;
  } catch (error) {
    logger.default.warn("Servidor no disponible para sincronización:", error);
    return false;
  }
};

/**
 * Verifica si el servidor está disponible
 */
export const isServerAvailable = async (): Promise<boolean> => {
  // Si no hay servidor configurado, no está disponible
  if (!SERVER_URL || SERVER_URL.trim() === '') {
    return false;
  }
  
  try {
    const response = await fetch(`${SERVER_URL}/api/assets`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(2000) // Timeout de 2 segundos
    });
    return response.ok;
  } catch {
    return false;
  }
};

/**
 * Sincroniza un asset al servidor (crear o actualizar)
 */
export const syncAssetToServer = async (
  asset: Asset,
  files: {
    glb: File | Blob;
    thumbnail?: File | Blob | null;
    unity?: File | Blob | null;
    zip?: File | Blob | null;
  }
): Promise<boolean> => {
  // Si no hay servidor configurado (modo demo), no intentar sincronizar
  if (!SERVER_URL || SERVER_URL.trim() === '') {
    logger.default.debug("Modo demo: No hay servidor configurado, omitiendo sincronización");
    return false;
  }
  
  try {
    // Preparar FormData para multipart/form-data
    const formData = new FormData();
    
    // Metadata del asset (sin URLs, se generan en el servidor)
    const { url, thumbnail, unityPackageUrl, fbxZipUrl, ...assetMetadata } = asset;
    formData.append('data', JSON.stringify(assetMetadata));
    
    // Archivos
    if (files.glb) formData.append('glb', files.glb);
    if (files.thumbnail) formData.append('thumbnail', files.thumbnail);
    if (files.unity) formData.append('unity', files.unity);
    if (files.zip) formData.append('zip', files.zip);

    const response = await fetch(`${SERVER_URL}/api/assets`, {
      method: 'POST',
      body: formData,
      // No establecer Content-Type - el navegador lo hace automáticamente para FormData
    });

    if (response.ok) {
      logger.assetContext.info(`Asset sincronizado con servidor: ${asset.name}`);
      return true;
    } else {
      logger.assetContext.warn(`Error sincronizando asset: ${response.status} ${response.statusText}`);
      return false;
    }
  } catch (error) {
    logger.default.warn("Servidor no disponible para sincronización:", error);
    return false;
  }
};

/**
 * Actualiza solo la metadata de un asset en el servidor
 */
export const updateAssetMetadataOnServer = async (asset: Asset): Promise<boolean> => {
  // Si no hay servidor configurado (modo demo), no intentar actualizar
  if (!SERVER_URL || SERVER_URL.trim() === '') {
    logger.default.debug("Modo demo: No hay servidor configurado, omitiendo actualización");
    return false;
  }
  
  try {
    // Metadata sin URLs y sin blobs
    const { url, thumbnail, unityPackageUrl, fbxZipUrl, thumbnailBlob, ...assetMetadata } = asset;

    const response = await fetch(`${SERVER_URL}/api/assets/${asset.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(assetMetadata),
    });

    if (response.ok) {
      logger.assetContext.debug(`Metadata actualizada en servidor: ${asset.name}`);
      return true;
    } else {
      logger.assetContext.warn(`Error actualizando metadata: ${response.status}`);
      return false;
    }
  } catch (error) {
    logger.default.warn("Servidor no disponible para actualizar metadata:", error);
    return false;
  }
};

/**
 * Actualiza archivos de un asset en el servidor
 */
export const updateAssetFilesOnServer = async (
  asset: Asset,
  files: {
    glb?: File | Blob | null;
    thumbnail?: File | Blob | null;
    unity?: File | Blob | null;
    zip?: File | Blob | null;
  }
): Promise<boolean> => {
  // Si no hay servidor configurado (modo demo), no intentar actualizar
  if (!SERVER_URL || SERVER_URL.trim() === '') {
    logger.default.debug("Modo demo: No hay servidor configurado, omitiendo actualización de archivos");
    return false;
  }
  
  try {
    const formData = new FormData();
    
    // Metadata opcional
    const { url, thumbnail, unityPackageUrl, fbxZipUrl, ...assetMetadata } = asset;
    formData.append('data', JSON.stringify(assetMetadata));
    
    // Archivos opcionales
    if (files.glb) formData.append('glb', files.glb);
    if (files.thumbnail) formData.append('thumbnail', files.thumbnail);
    if (files.unity) formData.append('unity', files.unity);
    if (files.zip) formData.append('zip', files.zip);

    const response = await fetch(`${SERVER_URL}/api/assets/${asset.id}/files`, {
      method: 'PUT',
      body: formData,
    });

    if (response.ok) {
      logger.assetContext.debug(`Archivos actualizados en servidor: ${asset.name}`);
      return true;
    } else {
      logger.assetContext.warn(`Error actualizando archivos: ${response.status}`);
      return false;
    }
  } catch (error) {
    logger.default.warn("Servidor no disponible para actualizar archivos:", error);
    return false;
  }
};

/**
 * Elimina un asset del servidor
 */
export const deleteAssetFromServer = async (assetId: string): Promise<boolean> => {
  // Si no hay servidor configurado (modo demo), no intentar eliminar
  if (!SERVER_URL || SERVER_URL.trim() === '') {
    logger.default.debug("Modo demo: No hay servidor configurado, omitiendo eliminación");
    return false;
  }
  
  try {
    const response = await fetch(`${SERVER_URL}/api/assets/${assetId}`, {
      method: 'DELETE',
    });

    if (response.ok) {
      logger.assetContext.info(`Asset eliminado del servidor: ${assetId}`);
      return true;
    } else {
      logger.assetContext.warn(`Error eliminando asset del servidor: ${response.status}`);
      return false;
    }
  } catch (error) {
    logger.default.warn("Servidor no disponible para eliminar asset:", error);
    return false;
  }
};
