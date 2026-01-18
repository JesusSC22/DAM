const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const { validateFileType } = require('./fileValidation');
const { validateAsset, validateAssetUpdate, validateAssetId } = require('./validation');

const app = express();
// Puerto del servidor (puede configurarse mediante variable de entorno)
const PORT = process.env.PORT || 3001;
const DB_FILE = path.join(__dirname, 'db.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// Middleware
// CORS restrictivo - solo permite orígenes específicos
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:3000', 'https://jesussc22.github.io'];

app.use(cors({
  origin: function (origin, callback) {
    // Permitir requests sin origin (mobile apps, Postman, etc.) solo en desarrollo
    if (!origin && process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());

// Rate limiting para prevenir abuso
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20, // máximo 20 peticiones por IP
  message: 'Demasiadas peticiones desde esta IP, intenta de nuevo en 15 minutos.',
  standardHeaders: true,
  legacyHeaders: false,
});

const strictUploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // máximo 10 uploads por IP
  message: 'Demasiados uploads desde esta IP, intenta de nuevo en 15 minutos.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Servir archivos estáticos (modelos e imágenes)
app.use('/uploads', express.static(UPLOADS_DIR));

// Ensure uploads dir exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer storage config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    // Keep original extension, add timestamp to avoid collisions
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

// Límites de tamaño de archivos (en bytes)
const FILE_SIZE_LIMITS = {
  GLB: 100 * 1024 * 1024,      // 100 MB
  UNITY: 200 * 1024 * 1024,    // 200 MB
  ZIP: 200 * 1024 * 1024,      // 200 MB
  THUMBNAIL: 10 * 1024 * 1024  // 10 MB
};

// Configurar multer con límites de tamaño
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: Math.max(FILE_SIZE_LIMITS.GLB, FILE_SIZE_LIMITS.UNITY, FILE_SIZE_LIMITS.ZIP, FILE_SIZE_LIMITS.THUMBNAIL), // 200 MB (el máximo)
    files: 4 // Máximo 4 archivos: glb, thumbnail, unity, zip
  },
  fileFilter: (req, file, cb) => {
    // Validar tamaño específico según el tipo de archivo
    // Multer ya valida el tamaño total, pero aquí podemos agregar validaciones adicionales
    cb(null, true);
  }
});

// Database Helper Functions
function readDB() {
  if (!fs.existsSync(DB_FILE)) {
    return { assets: [] };
  }
  const data = fs.readFileSync(DB_FILE, 'utf-8');
  try {
    return JSON.parse(data);
  } catch (e) {
    return { assets: [] };
  }
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

/**
 * Elimina archivos físicos asociados con un asset del disco
 * @param {Object} asset - El asset que contiene las rutas de los archivos
 */
/**
 * Valida que una ruta de archivo esté dentro del directorio permitido
 * Previene path traversal attacks
 */
function validateFilePath(filePath) {
  // Normalizar la ruta
  const normalized = path.normalize(filePath);
  // Resolver la ruta completa
  const fullPath = path.resolve(UPLOADS_DIR, normalized);
  const uploadsDirResolved = path.resolve(UPLOADS_DIR);
  
  // Verificar que la ruta normalizada esté dentro del directorio de uploads
  if (!fullPath.startsWith(uploadsDirResolved)) {
    throw new Error('Invalid file path: path traversal detected');
  }
  
  return fullPath;
}

function deleteAssetFiles(asset) {
  if (!asset) return;

  // Lista de propiedades que contienen rutas de archivos
  const fileProperties = ['url', 'thumbnail', 'unityPackageUrl', 'fbxZipUrl'];
  
  fileProperties.forEach(prop => {
    if (asset[prop]) {
      try {
        // Extraer el nombre del archivo de la ruta (ej: /uploads/file.jpg -> file.jpg)
        const filePath = asset[prop].replace(/^\/uploads\//, '');
        // Validar y obtener la ruta segura
        const fullPath = validateFilePath(filePath);
        
        // Verificar que el archivo existe antes de intentar eliminarlo
        if (fs.existsSync(fullPath)) {
          try {
            fs.unlinkSync(fullPath);
            console.log(`Archivo eliminado: ${fullPath}`);
          } catch (error) {
            // Log del error pero no fallar la operación si un archivo no se puede eliminar
            console.error(`Error eliminando archivo ${fullPath}:`, error.message);
          }
        }
      } catch (error) {
        // Si la validación de path falla, solo loguear el error
        console.error(`Error validando ruta de archivo para ${prop}:`, error.message);
      }
    }
  });
}

// --- Routes ---

// GET /api/assets
app.get('/api/assets', uploadLimiter, (req, res) => {
  const db = readDB();
  // Transform local paths to full URLs if needed, or frontend handles it via base URL
  // Here we just send the data as is.
  res.json(db.assets);
});

// GET /api/assets/:id
app.get('/api/assets/:id', uploadLimiter, (req, res) => {
  try {
    // Validar ID
    validateAssetId(req.params.id);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
  
  const db = readDB();
  const asset = db.assets.find(a => a.id === req.params.id);
  if (asset) {
    res.json(asset);
  } else {
    res.status(404).json({ error: 'Asset not found' });
  }
});

// POST /api/assets (Create)
// Accepts multipart/form-data with fields: 'data' (JSON string of asset metadata) and files
const cpUpload = upload.fields([
  { name: 'glb', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 },
  { name: 'unity', maxCount: 1 },
  { name: 'zip', maxCount: 1 }
]);

app.post('/api/assets', strictUploadLimiter, (req, res, next) => {
  cpUpload(req, res, (err) => {
    // Manejar errores de Multer (archivo demasiado grande, etc.)
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ 
          error: 'El archivo es demasiado grande',
          details: `El límite máximo es ${Math.round(Math.max(FILE_SIZE_LIMITS.GLB, FILE_SIZE_LIMITS.UNITY, FILE_SIZE_LIMITS.ZIP, FILE_SIZE_LIMITS.THUMBNAIL) / 1024 / 1024)} MB`
        });
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ error: 'Demasiados archivos. Máximo 4 archivos permitidos.' });
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ error: 'Tipo de archivo no permitido.' });
      }
      return res.status(500).json({ error: 'Error al procesar archivos', details: err.message });
    }
    next();
  });
}, (req, res) => {
  try {
    const db = readDB();
    
    // Parsear y validar datos del asset con Zod
    let assetData;
    try {
      assetData = JSON.parse(req.body.data);
      assetData = validateAsset(assetData);
    } catch (error) {
      return res.status(400).json({ 
        error: 'Datos de asset inválidos',
        details: error.message 
      });
    }
    
    // Validar archivos usando magic numbers
    if (req.files['glb']) {
      const glbPath = path.join(UPLOADS_DIR, req.files['glb'][0].filename);
      if (!validateFileType(glbPath, 'glb')) {
        // Eliminar archivo inválido
        fs.unlinkSync(glbPath);
        return res.status(400).json({ 
          error: 'El archivo GLB no es válido. Verifica que sea un archivo GLB/GLTF real y no esté corrupto.' 
        });
      }
    }
    
    if (req.files['thumbnail']) {
      const thumbPath = path.join(UPLOADS_DIR, req.files['thumbnail'][0].filename);
      if (!validateFileType(thumbPath, 'image')) {
        fs.unlinkSync(thumbPath);
        return res.status(400).json({ 
          error: 'El archivo de thumbnail no es una imagen válida (JPEG o PNG).' 
        });
      }
    }
    
    if (req.files['unity']) {
      const unityPath = path.join(UPLOADS_DIR, req.files['unity'][0].filename);
      if (!validateFileType(unityPath, 'unity')) {
        fs.unlinkSync(unityPath);
        return res.status(400).json({ 
          error: 'El archivo Unity package no es válido.' 
        });
      }
    }
    
    if (req.files['zip']) {
      const zipPath = path.join(UPLOADS_DIR, req.files['zip'][0].filename);
      if (!validateFileType(zipPath, 'zip')) {
        fs.unlinkSync(zipPath);
        return res.status(400).json({ 
          error: 'El archivo ZIP no es válido.' 
        });
      }
    }
    
    // Construct new asset object
    const newAsset = { ...assetData };
    
    // Assign file paths if uploaded
    if (req.files['glb']) {
      newAsset.url = '/uploads/' + req.files['glb'][0].filename;
    }
    if (req.files['thumbnail']) {
      newAsset.thumbnail = '/uploads/' + req.files['thumbnail'][0].filename;
    }
    if (req.files['unity']) {
      newAsset.unityPackageUrl = '/uploads/' + req.files['unity'][0].filename;
    }
    if (req.files['zip']) {
      newAsset.fbxZipUrl = '/uploads/' + req.files['zip'][0].filename;
    }

    db.assets.push(newAsset);
    writeDB(db);

    res.status(201).json(newAsset);
  } catch (error) {
    console.error('Error creating asset:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/assets/:id (Update metadata only)
app.put('/api/assets/:id', uploadLimiter, (req, res) => {
  try {
    // Validar ID
    validateAssetId(req.params.id);
    
    // Validar datos de actualización
    const updates = validateAssetUpdate({ ...req.body, id: req.params.id });
  } catch (error) {
    return res.status(400).json({ 
      error: 'Datos de actualización inválidos',
      details: error.message 
    });
  }
  
  const db = readDB();
  const index = db.assets.findIndex(a => a.id === req.params.id);
  
  if (index !== -1) {
    // Merge existing with validated updates
    db.assets[index] = { ...db.assets[index], ...req.body };
    writeDB(db);
    res.json(db.assets[index]);
  } else {
    res.status(404).json({ error: 'Asset not found' });
  }
});

// PUT /api/assets/:id/files (Update files and optionally metadata)
app.put('/api/assets/:id/files', strictUploadLimiter, (req, res, next) => {
  cpUpload(req, res, (err) => {
    // Manejar errores de Multer (archivo demasiado grande, etc.)
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ 
          error: 'El archivo es demasiado grande',
          details: `El límite máximo es ${Math.round(Math.max(FILE_SIZE_LIMITS.GLB, FILE_SIZE_LIMITS.UNITY, FILE_SIZE_LIMITS.ZIP, FILE_SIZE_LIMITS.THUMBNAIL) / 1024 / 1024)} MB`
        });
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ error: 'Demasiados archivos. Máximo 4 archivos permitidos.' });
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ error: 'Tipo de archivo no permitido.' });
      }
      return res.status(500).json({ error: 'Error al procesar archivos', details: err.message });
    }
    next();
  });
}, (req, res) => {
  try {
    // Validar ID
    validateAssetId(req.params.id);
    
    const db = readDB();
    const index = db.assets.findIndex(a => a.id === req.params.id);
    
    if (index === -1) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    const currentAsset = db.assets[index];
    let updates = {};
    if (req.body.data) {
      try {
        updates = JSON.parse(req.body.data);
        // Validar actualización con Zod
        updates = validateAssetUpdate({ ...updates, id: req.params.id });
      } catch (error) {
        return res.status(400).json({ 
          error: 'Datos de actualización inválidos',
          details: error.message 
        });
      }
    }

    // Validar archivos nuevos usando magic numbers
    if (req.files['glb']) {
      const glbPath = path.join(UPLOADS_DIR, req.files['glb'][0].filename);
      if (!validateFileType(glbPath, 'glb')) {
        fs.unlinkSync(glbPath);
        return res.status(400).json({ 
          error: 'El archivo GLB no es válido. Verifica que sea un archivo GLB/GLTF real y no esté corrupto.' 
        });
      }
    }
    
    if (req.files['thumbnail']) {
      const thumbPath = path.join(UPLOADS_DIR, req.files['thumbnail'][0].filename);
      if (!validateFileType(thumbPath, 'image')) {
        fs.unlinkSync(thumbPath);
        return res.status(400).json({ 
          error: 'El archivo de thumbnail no es una imagen válida (JPEG o PNG).' 
        });
      }
    }
    
    if (req.files['unity']) {
      const unityPath = path.join(UPLOADS_DIR, req.files['unity'][0].filename);
      if (!validateFileType(unityPath, 'unity')) {
        fs.unlinkSync(unityPath);
        return res.status(400).json({ 
          error: 'El archivo Unity package no es válido.' 
        });
      }
    }
    
    if (req.files['zip']) {
      const zipPath = path.join(UPLOADS_DIR, req.files['zip'][0].filename);
      if (!validateFileType(zipPath, 'zip')) {
        fs.unlinkSync(zipPath);
        return res.status(400).json({ 
          error: 'El archivo ZIP no es válido.' 
        });
      }
    }

    const updatedAsset = { ...currentAsset, ...updates };

    // Eliminar archivos antiguos antes de reemplazarlos (para ahorrar espacio)
    const filesToDelete = {};
    if (req.files['glb'] && currentAsset.url) {
      filesToDelete.url = currentAsset.url;
    }
    if (req.files['thumbnail'] && currentAsset.thumbnail) {
      filesToDelete.thumbnail = currentAsset.thumbnail;
    }
    if (req.files['unity'] && currentAsset.unityPackageUrl) {
      filesToDelete.unityPackageUrl = currentAsset.unityPackageUrl;
    }
    if (req.files['zip'] && currentAsset.fbxZipUrl) {
      filesToDelete.fbxZipUrl = currentAsset.fbxZipUrl;
    }

    // Eliminar archivos antiguos
    if (Object.keys(filesToDelete).length > 0) {
      deleteAssetFiles(filesToDelete);
    }

    // Update file paths if new files are uploaded
    if (req.files['glb']) {
      updatedAsset.url = '/uploads/' + req.files['glb'][0].filename;
    }
    if (req.files['thumbnail']) {
      updatedAsset.thumbnail = '/uploads/' + req.files['thumbnail'][0].filename;
    }
    if (req.files['unity']) {
      updatedAsset.unityPackageUrl = '/uploads/' + req.files['unity'][0].filename;
    }
    if (req.files['zip']) {
      updatedAsset.fbxZipUrl = '/uploads/' + req.files['zip'][0].filename;
    }

    db.assets[index] = updatedAsset;
    writeDB(db);
    
    res.json(updatedAsset);
  } catch (error) {
    console.error('Error updating asset files:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/assets/:id
// Endpoint para obtener información de almacenamiento
app.get('/api/storage/info', uploadLimiter, (req, res) => {
  try {
    const uploadsPath = UPLOADS_DIR;
    
    // Calcular tamaño total de archivos en uploads
    let totalSize = 0;
    let fileCount = 0;
    
    if (fs.existsSync(uploadsPath)) {
      const files = fs.readdirSync(uploadsPath);
      
      files.forEach(file => {
        const filePath = path.join(uploadsPath, file);
        try {
          const stats = fs.statSync(filePath);
          if (stats.isFile()) {
            totalSize += stats.size;
            fileCount++;
          }
        } catch (err) {
          // Ignorar errores al leer archivos individuales
        }
      });
    }
    
    // Estimación de almacenamiento disponible (plan gratuito Railway: ~500 MB - 1 GB)
    // Usamos 500 MB como referencia conservadora
    const estimatedTotal = 500 * 1024 * 1024; // 500 MB
    const usedPercentage = Math.min(100, (totalSize / estimatedTotal) * 100);
    
    res.json({
      used: totalSize,
      usedFormatted: formatBytes(totalSize),
      fileCount: fileCount,
      estimatedTotal: estimatedTotal,
      estimatedTotalFormatted: formatBytes(estimatedTotal),
      available: Math.max(0, estimatedTotal - totalSize),
      availableFormatted: formatBytes(Math.max(0, estimatedTotal - totalSize)),
      usedPercentage: Math.round(usedPercentage * 10) / 10 // Redondear a 1 decimal
    });
  } catch (error) {
    console.error('Error calculating storage info:', error);
    res.status(500).json({ error: 'Error calculating storage information' });
  }
});

// Helper function para formatear bytes
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

app.delete('/api/assets/:id', uploadLimiter, (req, res) => {
  try {
    // Validar ID
    validateAssetId(req.params.id);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
  
  const db = readDB();
  const initialLength = db.assets.length;
  const assetToDelete = db.assets.find(a => a.id === req.params.id);
  
  db.assets = db.assets.filter(a => a.id !== req.params.id);
  
  if (db.assets.length < initialLength) {
    writeDB(db);
    
    // Eliminar archivos físicos asociados con el asset del disco
    if (assetToDelete) {
      deleteAssetFiles(assetToDelete);
    }

    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Asset not found' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});






