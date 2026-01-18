/**
 * Validación de esquemas usando Zod
 * Valida los datos de entrada antes de procesarlos
 */

const { z } = require('zod');

// Esquema para metadata de asset
const AssetMetadataSchema = z.object({
  vertices: z.number().int().min(0).optional(),
  polygons: z.number().int().min(0).optional(),
  materialCount: z.number().int().min(0).optional(),
  createdDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// Esquema para Asset completo
const AssetSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(255).trim(),
  description: z.string().max(5000).optional().default(''),
  categoryId: z.string().min(1).max(50),
  type: z.enum(['model', 'texture', 'scene']).default('model'),
  tags: z.array(z.string().max(50)).optional().default([]),
  metadata: AssetMetadataSchema.optional(),
  fileSize: z.string().optional(),
  url: z.string().optional(),
  thumbnail: z.string().optional(),
  unityPackageUrl: z.string().optional(),
  fbxZipUrl: z.string().optional(),
  doubleSide: z.boolean().optional().default(false),
});

// Esquema para actualización de Asset (todos los campos opcionales excepto id)
const AssetUpdateSchema = AssetSchema.partial().extend({
  id: z.string().min(1).max(100), // ID siempre requerido
});

// Esquema para validar ID de asset
const AssetIdSchema = z.string().min(1).max(100);

/**
 * Valida un asset completo
 */
function validateAsset(data) {
  try {
    return AssetSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
      }));
      throw new Error(`Validation error: ${JSON.stringify(errors)}`);
    }
    throw error;
  }
}

/**
 * Valida una actualización de asset
 */
function validateAssetUpdate(data) {
  try {
    return AssetUpdateSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
      }));
      throw new Error(`Validation error: ${JSON.stringify(errors)}`);
    }
    throw error;
  }
}

/**
 * Valida un ID de asset
 */
function validateAssetId(id) {
  try {
    return AssetIdSchema.parse(id);
  } catch (error) {
    throw new Error('Invalid asset ID format');
  }
}

module.exports = {
  validateAsset,
  validateAssetUpdate,
  validateAssetId,
  AssetSchema,
  AssetUpdateSchema,
};

