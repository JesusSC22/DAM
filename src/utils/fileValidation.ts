/**
 * Utilidades para validar archivos usando magic numbers
 * Los magic numbers son los primeros bytes de un archivo que identifican su tipo real
 */

/**
 * Magic numbers para diferentes tipos de archivos
 */
const MAGIC_NUMBERS = {
  // GLB (glTF Binary) - formato: 4 bytes "glTF" + 4 bytes versión + 4 bytes longitud
  GLB: new Uint8Array([0x67, 0x6C, 0x54, 0x46]), // "glTF" en ASCII
  
  // ZIP (también usado por Unity packages y otros)
  ZIP: new Uint8Array([0x50, 0x4B, 0x03, 0x04]), // "PK" + versión ZIP
  ZIP_EMPTY: new Uint8Array([0x50, 0x4B, 0x05, 0x06]), // ZIP vacío
  ZIP_SPANNED: new Uint8Array([0x50, 0x4B, 0x07, 0x08]), // ZIP multi-volumen
  
  // JPEG
  JPEG: new Uint8Array([0xFF, 0xD8, 0xFF]),
  
  // PNG
  PNG: new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
  
  // GIF
  GIF_87: new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]), // GIF87a
  GIF_89: new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]), // GIF89a
} as const;

/**
 * Lee los primeros bytes de un archivo
 */
async function readFileHeader(file: File, bytes: number = 8): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const blob = file.slice(0, bytes);
    
    reader.onload = (e) => {
      if (e.target?.result instanceof ArrayBuffer) {
        resolve(new Uint8Array(e.target.result));
      } else {
        reject(new Error('No se pudo leer el archivo'));
      }
    };
    
    reader.onerror = () => reject(new Error('Error leyendo el archivo'));
    reader.readAsArrayBuffer(blob);
  });
}

/**
 * Compara si un array de bytes empieza con un magic number
 */
function startsWithMagicNumber(header: Uint8Array, magic: Uint8Array): boolean {
  if (header.length < magic.length) return false;
  
  for (let i = 0; i < magic.length; i++) {
    if (header[i] !== magic[i]) return false;
  }
  
  return true;
}

/**
 * Valida si un archivo es realmente un GLB/GLTF
 */
export async function isValidGLB(file: File): Promise<boolean> {
  try {
    const header = await readFileHeader(file, 12);
    
    // GLB tiene un formato específico:
    // - Bytes 0-3: "glTF" (0x67, 0x6C, 0x54, 0x46)
    // - Bytes 4-7: Versión (normalmente 2)
    // - Bytes 8-11: Longitud total del archivo
    
    // Verificar magic number "glTF"
    const gltfMagic = header.slice(0, 4);
    if (!startsWithMagicNumber(gltfMagic, MAGIC_NUMBERS.GLB)) {
      return false;
    }
    
    // Verificar que la versión sea razonable (1 o 2)
    const version = new DataView(header.buffer, 4, 4).getUint32(0, true);
    if (version !== 1 && version !== 2) {
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error validando GLB:', error);
    return false;
  }
}

/**
 * Valida si un archivo es realmente un ZIP
 */
export async function isValidZIP(file: File): Promise<boolean> {
  try {
    const header = await readFileHeader(file, 4);
    
    // ZIP puede empezar con diferentes variantes
    return (
      startsWithMagicNumber(header, MAGIC_NUMBERS.ZIP) ||
      startsWithMagicNumber(header, MAGIC_NUMBERS.ZIP_EMPTY) ||
      startsWithMagicNumber(header, MAGIC_NUMBERS.ZIP_SPANNED)
    );
  } catch (error) {
    console.error('Error validando ZIP:', error);
    return false;
  }
}

/**
 * Valida si un archivo es realmente una imagen (JPEG, PNG, GIF)
 */
export async function isValidImage(file: File): Promise<boolean> {
  try {
    const header = await readFileHeader(file, 8);
    
    return (
      startsWithMagicNumber(header, MAGIC_NUMBERS.JPEG) ||
      startsWithMagicNumber(header, MAGIC_NUMBERS.PNG) ||
      startsWithMagicNumber(header, MAGIC_NUMBERS.GIF_87) ||
      startsWithMagicNumber(header, MAGIC_NUMBERS.GIF_89)
    );
  } catch (error) {
    console.error('Error validando imagen:', error);
    return false;
  }
}

/**
 * Valida un archivo según su tipo esperado
 */
export async function validateFileType(
  file: File,
  expectedType: 'glb' | 'zip' | 'image' | 'unity'
): Promise<{ valid: boolean; error?: string }> {
  try {
    switch (expectedType) {
      case 'glb':
        const isGLB = await isValidGLB(file);
        if (!isGLB) {
          return {
            valid: false,
            error: 'El archivo no es un GLB/GLTF válido. Verifica que el archivo no esté corrupto o sea de otro tipo.'
          };
        }
        break;
        
      case 'zip':
        const isZIP = await isValidZIP(file);
        if (!isZIP) {
          return {
            valid: false,
            error: 'El archivo no es un ZIP válido. Verifica que el archivo no esté corrupto.'
          };
        }
        break;
        
      case 'image':
        const isImage = await isValidImage(file);
        if (!isImage) {
          return {
            valid: false,
            error: 'El archivo no es una imagen válida (JPEG, PNG o GIF).'
          };
        }
        break;
        
      case 'unity':
        // Unity packages son básicamente tar.gz, pero pueden variar
        // Por ahora validamos como ZIP ya que muchos Unity packages usan formato ZIP
        const isUnity = await isValidZIP(file);
        if (!isUnity) {
          return {
            valid: false,
            error: 'El archivo no parece ser un Unity package válido.'
          };
        }
        break;
    }
    
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: `Error validando el archivo: ${error instanceof Error ? error.message : 'Error desconocido'}`
    };
  }
}




