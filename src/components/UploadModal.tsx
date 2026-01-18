import React, { useState, useRef } from 'react';
import { X, Upload, FileBox, FileArchive, Image as ImageIcon, Box, Loader, Hash } from 'lucide-react';
import toast from 'react-hot-toast';
import { Asset, Category, AssetMetadata } from '../types';
import { thumbnailGenerator } from '../services/thumbnailGenerator';
import { FILE_SIZE_LIMITS, formatFileSize } from '../config/constants';
import { validateFileType } from '../utils/fileValidation';

interface UploadModalProps {
  categories: Category[];
  onClose: () => void;
  onUpload: (asset: Asset, files: { glb: File, thumbnail: File | null, unity: File | null, zip: File | null }) => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({ categories, onClose, onUpload }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  // Filtrar categorías válidas (excluir 'all') y usar la primera como default
  const validCategories = categories.filter(c => c.id !== 'all');
  const [categoryId, setCategoryId] = useState(validCategories[0]?.id || 'prop');
  
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  const [glbFile, setGlbFile] = useState<File | null>(null);
  const [unityFile, setUnityFile] = useState<File | null>(null);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [generatedThumbnailBlob, setGeneratedThumbnailBlob] = useState<Blob | null>(null);
  const [analyzedMetadata, setAnalyzedMetadata] = useState<Partial<AssetMetadata>>({});

  const [isDragging, setIsDragging] = useState(false);

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      if (!tags.includes(tagInput.trim())) {
        setTags([...tags, tagInput.trim()]);
      }
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, setFile: (f: File | null) => void, fileType: 'glb' | 'unity' | 'zip' | 'thumbnail' = 'glb') => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Validar tamaño del archivo
      let maxSize: number;
      let fileTypeName: string;
      let validationType: 'glb' | 'zip' | 'image' | 'unity';
      
      switch (fileType) {
        case 'glb':
          maxSize = FILE_SIZE_LIMITS.GLB;
          fileTypeName = 'GLB/GLTF';
          validationType = 'glb';
          break;
        case 'unity':
          maxSize = FILE_SIZE_LIMITS.UNITY;
          fileTypeName = 'Unity Package';
          validationType = 'unity';
          break;
        case 'zip':
          maxSize = FILE_SIZE_LIMITS.ZIP;
          fileTypeName = 'ZIP';
          validationType = 'zip';
          break;
        case 'thumbnail':
          maxSize = FILE_SIZE_LIMITS.THUMBNAIL;
          fileTypeName = 'Thumbnail';
          validationType = 'image';
          break;
        default:
          maxSize = FILE_SIZE_LIMITS.GLB;
          fileTypeName = 'archivo';
          validationType = 'glb';
      }
      
      // Validar tamaño
      if (file.size > maxSize) {
        toast.error(
          `El archivo ${fileTypeName} es demasiado grande.\n` +
          `Tamaño: ${formatFileSize(file.size)}\n` +
          `Límite máximo: ${formatFileSize(maxSize)}`,
          { duration: 5000 }
        );
        e.target.value = '';
        return;
      }
      
      // Validar tipo de archivo usando magic numbers
      const validation = await validateFileType(file, validationType);
      if (!validation.valid) {
        toast.error(
          `Archivo ${fileTypeName} inválido.\n${validation.error}`,
          { duration: 6000 }
        );
        e.target.value = '';
        return;
      }
      
      setFile(file);

      // Auto-generate thumbnail and analyze if it's the GLB file
      if (setFile === setGlbFile) {
         processGlbFile(file);
      }
    }
  };

  const processGlbFile = async (file: File) => {
    setIsGeneratingThumbnail(true);
    setIsAnalyzing(true);
    // Add small delay to allow UI to update
    await new Promise(r => setTimeout(r, 100));
    
    try {
      const [blob, analysis] = await Promise.all([
        thumbnailGenerator.generateFromBlob(file),
        thumbnailGenerator.analyzeModel(file)
      ]);

      if (blob) {
        setGeneratedThumbnailBlob(blob);
      }
      
      if (analysis) {
        setAnalyzedMetadata({
          vertices: analysis.vertices,
          polygons: analysis.polygons,
          materialCount: analysis.materialCount
        });
      }
    } catch (error) {
      // Los errores de procesamiento se manejan silenciosamente
      // El usuario verá que el thumbnail no se generó pero puede continuar
      if (import.meta.env.DEV) {
        console.error("[UploadModal] Error processing GLB file:", error);
      }
    } finally {
      setIsGeneratingThumbnail(false);
      setIsAnalyzing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!glbFile || !name) return;

    // Create object URLs for the files to simulate upload
    const glbUrl = URL.createObjectURL(glbFile);
    const unityUrl = unityFile ? URL.createObjectURL(unityFile) : undefined;
    const zipUrl = zipFile ? URL.createObjectURL(zipFile) : undefined;
    
    // Determine which thumbnail to use (uploaded > generated > default)
    let finalThumbnailBlob: Blob | File | null = thumbnailFile;
    if (!finalThumbnailBlob && generatedThumbnailBlob) {
        finalThumbnailBlob = generatedThumbnailBlob;
    }

    const thumbnailUrl = finalThumbnailBlob
      ? URL.createObjectURL(finalThumbnailBlob) 
      : 'https://images.unsplash.com/photo-1614728263952-84ea256f9679?q=80&w=300&auto=format&fit=crop';

    const newAsset: Asset = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      description,
      categoryId,
      type: 'model',
      url: glbUrl,
      thumbnail: thumbnailUrl,
      unityPackageUrl: unityUrl,
      fbxZipUrl: zipUrl,
      tags,
      fileSize: formatFileSize(glbFile.size), // Guardar tamaño del archivo GLB
      metadata: {
        vertices: analyzedMetadata.vertices || Math.floor(Math.random() * 50000) + 1000,
        polygons: analyzedMetadata.polygons || Math.floor(Math.random() * 50000) + 1000,
        materialCount: analyzedMetadata.materialCount || Math.floor(Math.random() * 10) + 1,
        createdDate: new Date().toISOString().split('T')[0]
      }
    };

    onUpload(newAsset, {
      glb: glbFile,
      thumbnail: finalThumbnailBlob as File | null, // Cast blob to file for storage interface compatibility
      unity: unityFile,
      zip: zipFile
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col transition-colors duration-200">
        
        {/* Header */}
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between transition-colors duration-200">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Subir Nuevo Modelo</h2>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-500 dark:text-gray-400 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5">
          <div className="grid grid-cols-2 gap-5">
            
            {/* Left Column - Basic Info */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre del Modelo</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder-gray-400 dark:placeholder-gray-500"
                  placeholder="Ej. Silla de Oficina Moderna"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Categoría</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                >
                  {categories.filter(c => c.id !== 'all').map(category => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </div>

              {/* Tags Input */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Etiquetas</label>
                <div className="flex items-center gap-1.5 mb-1.5">
                   <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleAddTag}
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder-gray-400 dark:placeholder-gray-500"
                    placeholder="Presiona Enter para agregar"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5 min-h-[20px]">
                  {tags.map(tag => (
                    <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded-md">
                      {tag}
                      <button type="button" onClick={() => removeTag(tag)} className="hover:text-blue-900 dark:hover:text-blue-100"><X size={10} /></button>
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Descripción</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder-gray-400 dark:placeholder-gray-500 resize-none"
                  placeholder="Describe el modelo..."
                />
              </div>
            </div>

            {/* Right Column - File Uploads */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-gray-900 dark:text-gray-100 mb-1">Archivos del Modelo</h3>
              
              {/* GLB Upload (Primary) */}
              <div className={`border-2 border-dashed rounded-lg p-4 transition-colors ${glbFile ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500'}`}>
                <label className="flex flex-col items-center cursor-pointer">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full mb-2">
                    <Box size={20} />
                  </div>
                  <span className="font-medium text-sm text-gray-900 dark:text-gray-100 mb-0.5 text-center">
                    {glbFile ? glbFile.name : 'Modelo GLB / GLTF'}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 text-center">
                    {glbFile ? `${(glbFile.size / 1024 / 1024).toFixed(2)} MB` : 'Arrastra o selecciona (.glb)'}
                  </span>
                  <input 
                    type="file" 
                    accept=".glb,.gltf" 
                    className="hidden" 
                    onChange={(e) => handleFileChange(e, setGlbFile, 'glb')} 
                    required
                  />
                </label>
              </div>

              {/* Secondary Files Grid */}
              <div className="grid grid-cols-2 gap-2">
                
                {/* Unity Package */}
                <div className={`border border-gray-200 dark:border-gray-700 rounded-lg p-3 flex flex-col items-center justify-center text-center cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition-all ${unityFile ? 'bg-gray-50 dark:bg-gray-700 border-blue-400 dark:border-blue-500' : ''}`}>
                  <label className="w-full h-full cursor-pointer flex flex-col items-center">
                    <FileBox className={`mb-1 ${unityFile ? 'text-blue-500' : 'text-gray-400'}`} size={18} />
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate w-full px-1">
                      {unityFile ? unityFile.name : 'Unity Package'}
                    </span>
                    <input type="file" accept=".unitypackage" className="hidden" onChange={(e) => handleFileChange(e, setUnityFile, 'unity')} />
                  </label>
                </div>

                {/* FBX Zip */}
                <div className={`border border-gray-200 dark:border-gray-700 rounded-lg p-3 flex flex-col items-center justify-center text-center cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition-all ${zipFile ? 'bg-gray-50 dark:bg-gray-700 border-blue-400 dark:border-blue-500' : ''}`}>
                  <label className="w-full h-full cursor-pointer flex flex-col items-center">
                    <FileArchive className={`mb-1 ${zipFile ? 'text-yellow-500' : 'text-gray-400'}`} size={18} />
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate w-full px-1">
                      {zipFile ? zipFile.name : 'FBX + Texturas (.zip)'}
                    </span>
                    <input type="file" accept=".zip,.rar,.7z" className="hidden" onChange={(e) => handleFileChange(e, setZipFile, 'zip')} />
                  </label>
                </div>

              </div>
            </div>

          </div>

          {/* Actions */}
          <div className="pt-4 mt-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 font-medium hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!glbFile || !name || isGeneratingThumbnail || isAnalyzing}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-lg shadow-blue-200 dark:shadow-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              {(isGeneratingThumbnail || isAnalyzing) ? (
                <Loader className="animate-spin" size={16} />
              ) : (
                <Upload size={16} />
              )}
              <span>Subir Modelo</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
