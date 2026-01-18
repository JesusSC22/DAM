/**
 * Validación de archivos usando magic numbers en el servidor
 */

const fs = require('fs');

// Magic numbers para diferentes tipos de archivos
const MAGIC_NUMBERS = {
  GLB: Buffer.from([0x67, 0x6C, 0x54, 0x46]), // "glTF"
  ZIP: Buffer.from([0x50, 0x4B, 0x03, 0x04]), // ZIP
  ZIP_EMPTY: Buffer.from([0x50, 0x4B, 0x05, 0x06]),
  JPEG: Buffer.from([0xFF, 0xD8, 0xFF]),
  PNG: Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
};

/**
 * Lee los primeros bytes de un archivo
 */
function readFileHeader(filePath, bytes = 12) {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(bytes);
    fs.readSync(fd, buffer, 0, bytes, 0);
    fs.closeSync(fd);
    return buffer;
  } catch (error) {
    return null;
  }
}

/**
 * Verifica si un buffer empieza con un magic number
 */
function startsWithMagicNumber(buffer, magic) {
  if (buffer.length < magic.length) return false;
  return buffer.slice(0, magic.length).equals(magic);
}

/**
 * Valida si un archivo es realmente un GLB
 */
function isValidGLB(filePath) {
  const header = readFileHeader(filePath, 12);
  if (!header) return false;
  
  // Verificar magic number "glTF"
  if (!startsWithMagicNumber(header, MAGIC_NUMBERS.GLB)) {
    return false;
  }
  
  // Verificar versión (debe ser 1 o 2)
  const version = header.readUInt32LE(4);
  return version === 1 || version === 2;
}

/**
 * Valida si un archivo es realmente un ZIP
 */
function isValidZIP(filePath) {
  const header = readFileHeader(filePath, 4);
  if (!header) return false;
  
  return (
    startsWithMagicNumber(header, MAGIC_NUMBERS.ZIP) ||
    startsWithMagicNumber(header, MAGIC_NUMBERS.ZIP_EMPTY)
  );
}

/**
 * Valida si un archivo es realmente una imagen
 */
function isValidImage(filePath) {
  const header = readFileHeader(filePath, 8);
  if (!header) return false;
  
  return (
    startsWithMagicNumber(header, MAGIC_NUMBERS.JPEG) ||
    startsWithMagicNumber(header, MAGIC_NUMBERS.PNG)
  );
}

/**
 * Valida un archivo según su tipo esperado
 */
function validateFileType(filePath, expectedType) {
  try {
    switch (expectedType) {
      case 'glb':
        return isValidGLB(filePath);
      case 'zip':
      case 'unity':
        return isValidZIP(filePath);
      case 'image':
        return isValidImage(filePath);
      default:
        return false;
    }
  } catch (error) {
    console.error('Error validando archivo:', error);
    return false;
  }
}

module.exports = {
  validateFileType,
  isValidGLB,
  isValidZIP,
  isValidImage,
};




