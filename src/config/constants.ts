/**
 * Constantes de configuración del proyecto
 * 
 * Usa variables de entorno cuando estén disponibles, con valores por defecto para desarrollo.
 */

/**
 * URL del servidor Express (backend)
 * 
 * En desarrollo: http://localhost:3001 (por defecto)
 * En producción: Debe establecerse mediante VITE_SERVER_URL
 * 
 * Vite expone variables de entorno con el prefijo VITE_ al código del cliente
 * 
 * IMPORTANTE: En producción (GitHub Pages), si VITE_SERVER_URL no está configurado,
 * SERVER_URL será una cadena vacía para evitar intentos de conexión a localhost
 */
const getServerUrl = (): string => {
  const envUrl = import.meta.env.VITE_SERVER_URL;
  
  // Si hay una URL configurada, usarla
  if (envUrl && envUrl.trim() !== '') {
    return envUrl.trim();
  }
  
  // En desarrollo (localhost), usar localhost:3001
  if (typeof window !== 'undefined' && 
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return 'http://localhost:3001';
  }
  
  // En producción sin URL configurada, retornar vacío (modo demo)
  return '';
};

export const SERVER_URL = getServerUrl();

/**
 * Timeout para peticiones al servidor (en milisegundos)
 */
export const SERVER_TIMEOUT = 5000;

/**
 * Intervalo de sincronización automática (en milisegundos)
 * Sincroniza con el servidor cada 30 segundos
 */
export const SYNC_INTERVAL = 30000;

/**
 * Límites máximos de tamaño de archivos (en bytes)
 */
export const FILE_SIZE_LIMITS = {
  // Modelo GLB/GLTF (principal)
  GLB: 100 * 1024 * 1024, // 100 MB
  
  // Paquete Unity
  UNITY: 200 * 1024 * 1024, // 200 MB
  
  // Archivo ZIP (FBX + texturas)
  ZIP: 200 * 1024 * 1024, // 200 MB
  
  // Thumbnail/Imagen
  THUMBNAIL: 10 * 1024 * 1024, // 10 MB
} as const;

/**
 * Formatea bytes a una representación legible (KB, MB, GB)
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
};

/**
 * Detecta si la app está en modo demo (sin servidor disponible)
 * Esto ocurre cuando:
 * - SERVER_URL está vacío
 * - SERVER_URL apunta a localhost (en producción)
 * - Estamos en GitHub Pages
 */
export const isDemoMode = (): boolean => {
  const serverUrl = SERVER_URL;
  if (!serverUrl || serverUrl.trim() === '') return true;
  if (serverUrl.includes('localhost') || serverUrl.includes('127.0.0.1')) {
    // En producción, localhost no funciona
    return window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
  }
  return false;
};

