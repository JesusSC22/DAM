import React, { useEffect, useState } from 'react';
import { X, ChevronDown, ChevronRight, Eye } from 'lucide-react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

interface TextureInfo {
  type: string;
  name: string;
  imageUrl: string;
}

interface MaterialInfo {
  name: string;
  type: string;
  color?: string;
  textures: TextureInfo[];
}

interface MaterialsPanelProps {
  modelUrl: string | null;
  assetId?: string | null; // ID del asset para poder regenerar la blob URL si es necesario
  isOpen: boolean;
  onClose: () => void;
  onMaterialHover?: (materialName: string | null) => void;
  onMaterialClick?: (materialName: string | null) => void;
}

// Función helper mejorada para convertir textura de Three.js a URL de imagen
const textureToImageUrl = (texture: THREE.Texture): string => {
  if (!texture || !texture.image) return '';
  
  const image = texture.image;
  
  // Si es un HTMLImageElement, usar su src o crear data URL desde canvas
  if (image instanceof HTMLImageElement) {
    if (image.src && image.src.startsWith('data:')) {
      return image.src;
    }
    // Intentar crear canvas desde la imagen
    try {
      const canvas = document.createElement('canvas');
      canvas.width = image.width || image.naturalWidth || 256;
      canvas.height = image.height || image.naturalHeight || 256;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(image, 0, 0);
        return canvas.toDataURL();
      }
    } catch (e) {
      console.warn('Error creating canvas from image:', e);
    }
  }
  
  // Si es un HTMLCanvasElement, usar toDataURL directamente
  if (image instanceof HTMLCanvasElement) {
    try {
      return image.toDataURL();
    } catch (e) {
      console.warn('Error getting data URL from canvas:', e);
    }
  }
  
  // Si es un ImageData, convertir a canvas
  if (image instanceof ImageData) {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.putImageData(image, 0, 0);
        return canvas.toDataURL();
      }
    } catch (e) {
      console.warn('Error converting ImageData to canvas:', e);
    }
  }
  
  // Si es un ImageBitmap, convertir a canvas
  if (image instanceof ImageBitmap) {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(image, 0, 0);
        return canvas.toDataURL();
      }
    } catch (e) {
      console.warn('Error converting ImageBitmap to canvas:', e);
    }
  }
  
  return '';
};

// Extraer materiales con sus texturas del modelo
const extractMaterials = async (gltf: any): Promise<{ materials: MaterialInfo[]; materialMap: Map<string, THREE.Material> }> => {
  const materialsInfo: MaterialInfo[] = [];
  const materialMap = new Map<string, THREE.Material>();
  const processedMaterials = new Set<THREE.Material>();

  if (!gltf.scene) {
    return { materials: materialsInfo, materialMap };
  }

  // Mapeo de propiedades a nombres
  const textureNames: Record<string, string> = {
    map: 'Diffuse',
    normalMap: 'Normal',
    roughnessMap: 'Roughness',
    metalnessMap: 'Metalness',
    aoMap: 'AO',
    emissiveMap: 'Emissive',
    alphaMap: 'Alpha',
  };

  // Recorrer la escena para encontrar todos los materiales
  gltf.scene.traverse((child: THREE.Object3D) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      
      materials.forEach((material: THREE.Material) => {
        if (!material || processedMaterials.has(material)) return;
        processedMaterials.add(material);

        const info: MaterialInfo = {
          name: material.name || `Material_${materialsInfo.length}`,
          type: material.type || 'Unknown',
          textures: [],
        };

        // Extraer color del material
        if ('color' in material && material.color instanceof THREE.Color) {
          info.color = `#${material.color.getHexString()}`;
        }

        // Extraer todas las texturas del material
        Object.keys(textureNames).forEach((prop) => {
          const texture = (material as any)[prop] as THREE.Texture | undefined;
          if (texture && texture.image) {
            try {
              const imageUrl = textureToImageUrl(texture);
              if (imageUrl) {
                info.textures.push({
                  type: prop,
                  name: textureNames[prop],
                  imageUrl,
                });
              }
            } catch (error) {
              console.warn(`Error procesando textura ${prop}:`, error);
            }
          }
        });

        const materialKey = material.name || `Material_${materialsInfo.length}`;
        materialMap.set(materialKey, material);
        materialsInfo.push(info);
      });
    }
  });

  return { materials: materialsInfo, materialMap };
};

export const MaterialsPanel: React.FC<MaterialsPanelProps> = ({ modelUrl, assetId, isOpen, onClose, onMaterialHover, onMaterialClick }) => {
  const [materials, setMaterials] = useState<MaterialInfo[]>([]);
  const [expandedMaterials, setExpandedMaterials] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [lastLoadedUrl, setLastLoadedUrl] = useState<string | null>(null);

  // Limpiar cuando se cierra el panel
  useEffect(() => {
    if (!isOpen) {
      setMaterials([]);
      setExpandedMaterials(new Set());
      setLoading(false);
      setLastLoadedUrl(null); // Limpiar para forzar recarga cuando se vuelva a abrir
    }
  }, [isOpen]);

  // Cargar materiales cuando el panel se abre y hay una URL
  useEffect(() => {
    // Si el panel está cerrado o no hay URL, no hacer nada
    if (!isOpen || !modelUrl) {
      return;
    }

    // Si la URL no ha cambiado y ya tenemos materiales, no recargar (evitar loops)
    // Esto previene recargas innecesarias cuando el panel ya está abierto y la URL no cambia
    if (lastLoadedUrl === modelUrl && materials.length > 0) {
      return;
    }

    // Si el panel está abierto pero no hay materiales cargados, o cambió la URL, cargar
    const loadMaterials = async () => {
      setLoading(true);
      // Limpiar materiales anteriores mientras se cargan los nuevos
      setMaterials([]);
      setExpandedMaterials(new Set());
      
      try {
        const loader = new GLTFLoader();
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('/draco/gltf/');
        loader.setDRACOLoader(dracoLoader);

        // Intentar cargar el modelo directamente
        const gltf = await loader.loadAsync(modelUrl);
        const { materials: extractedMaterials } = await extractMaterials(gltf);
        setMaterials(extractedMaterials);
        setLastLoadedUrl(modelUrl); // Guardar la URL que acabamos de cargar
        // Expandir el primer material por defecto
        if (extractedMaterials.length > 0) {
          setExpandedMaterials(new Set([0]));
        }
      } catch (err: any) {
        // Si falla y es una blob URL inválida, intentar regenerarla desde el cache
        if (modelUrl.startsWith('blob:') && assetId && (err?.message?.includes('Failed to fetch') || err?.message?.includes('ERR_FILE_NOT_FOUND'))) {
          console.warn('Blob URL inválida, intentando regenerar desde cache...', err);
          try {
            const { getAssetWithBlobs } = await import('../services/db');
            // Forzar regeneración de la blob URL
            const updatedAsset = await getAssetWithBlobs(assetId, true);
            if (updatedAsset?.url) {
              // Si se regeneró la URL, intentar cargar con la nueva URL
              const loader = new GLTFLoader();
              const dracoLoader = new DRACOLoader();
              dracoLoader.setDecoderPath('/draco/gltf/');
              loader.setDRACOLoader(dracoLoader);
              
              try {
                const gltf = await loader.loadAsync(updatedAsset.url);
                const { materials: extractedMaterials } = await extractMaterials(gltf);
                setMaterials(extractedMaterials);
                setLastLoadedUrl(updatedAsset.url);
                if (extractedMaterials.length > 0) {
                  setExpandedMaterials(new Set([0]));
                }
                setLoading(false);
                return;
              } catch (reloadError) {
                console.error('Error cargando materiales con URL regenerada:', reloadError);
              }
            }
          } catch (regenError) {
            console.error('Error regenerando blob URL:', regenError);
          }
        }
        
        console.error('Error cargando materiales:', err);
        setMaterials([]);
        setLastLoadedUrl(null);
      } finally {
        setLoading(false);
      }
    };

    // Cargar materiales cuando el panel se abre O cuando cambia la URL del modelo
    loadMaterials();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelUrl, isOpen]);

  const toggleMaterial = (index: number) => {
    const newExpanded = new Set(expandedMaterials);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedMaterials(newExpanded);
  };

  if (!isOpen) return null;

  return (
    <div className="absolute top-0 right-0 z-20 w-80 h-full bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col shadow-xl">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Materiales
        </h3>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors flex-shrink-0"
          aria-label="Cerrar panel de materiales"
        >
          <X size={18} className="text-gray-500 dark:text-gray-400" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            Cargando...
          </div>
        )}

        {!loading && materials.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No se encontraron materiales
          </div>
        )}

        {!loading && materials.length > 0 && (
          <div className="p-2">
            {materials.map((material, index) => {
              const isExpanded = expandedMaterials.has(index);
              const hasTextures = material.textures.length > 0;
              
              return (
                <div key={index} className="mb-2 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  {/* Material Header */}
                  <div className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between transition-colors">
                    <button
                      onClick={() => toggleMaterial(index)}
                      onMouseEnter={() => onMaterialHover?.(material.name)}
                      onMouseLeave={() => onMaterialHover?.(null)}
                      className="flex-1 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {material.name}
                        </div>
                        {material.color && (
                          <div
                            className="w-4 h-4 rounded border border-gray-300 dark:border-gray-600 flex-shrink-0"
                            style={{ backgroundColor: material.color }}
                            title={material.color}
                          />
                        )}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {material.type}
                        {material.color && ` • ${material.color}`}
                      </div>
                    </button>
                    <div className="flex items-center gap-2 ml-2">
                      {/* Icono de ojo para enfocar la cámara */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onMaterialClick?.(material.name);
                        }}
                        onMouseEnter={() => onMaterialHover?.(material.name)}
                        onMouseLeave={() => onMaterialHover?.(null)}
                        className="w-8 h-8 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                        title="Enfocar cámara en este material"
                      >
                        <Eye size={16} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200" />
                      </button>
                      {/* Chevron para expandir/colapsar */}
                      <button
                        onClick={() => toggleMaterial(index)}
                        className="p-1"
                      >
                        {isExpanded ? (
                          <ChevronDown size={16} className="text-gray-500 dark:text-gray-400" />
                        ) : (
                          <ChevronRight size={16} className="text-gray-500 dark:text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Texturas del material */}
                  {isExpanded && hasTextures && (
                    <div className="p-3 border-t border-gray-200 dark:border-gray-700">
                      <div className="grid grid-cols-2 gap-2">
                        {material.textures.map((texture, texIndex) => (
                          <div key={texIndex} className="flex flex-col">
                            <div className="aspect-square bg-gray-100 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 overflow-hidden">
                              <img
                                src={texture.imageUrl}
                                alt={texture.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  const parent = target.parentElement;
                                  if (parent) {
                                    parent.classList.add('bg-red-100', 'dark:bg-red-900/20');
                                  }
                                }}
                              />
                            </div>
                            <div className="mt-1 text-xs text-center text-gray-600 dark:text-gray-400 truncate">
                              {texture.name}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {isExpanded && !hasTextures && (
                    <div className="p-3 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 text-center">
                      Sin texturas
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
