import * as THREE from 'three';

/**
 * Wireframe profesional estilo Sketchfab
 * - Modelo blanco sólido sin iluminación cuando wireframe está activo
 * - Wireframe negro sobre modelo blanco
 * - Estable y sin interferir con sombras
 */

// Cache de EdgesGeometry por geometría original
const edgesGeometryCache = new WeakMap<THREE.BufferGeometry, THREE.EdgesGeometry>();

// Umbral de ángulo estilo Sketchfab
const SKETCHFAB_EDGE_THRESHOLD = 0.7; // Aproximadamente 40 grados

// Configuración por defecto
const DEFAULT_WIREFRAME_CONFIG = {
  color: 0x000000, // Negro para wireframe
  opacity: 1.0,
  threshold: SKETCHFAB_EDGE_THRESHOLD,
} as const;

/**
 * Obtiene o crea EdgesGeometry para una geometría dada
 */
function getOrCreateEdgesGeometry(
  geometry: THREE.BufferGeometry,
  threshold: number = SKETCHFAB_EDGE_THRESHOLD
): THREE.EdgesGeometry {
  let edgesGeometry = edgesGeometryCache.get(geometry);
  
  if (!edgesGeometry) {
    edgesGeometry = new THREE.EdgesGeometry(geometry, threshold);
    edgesGeometryCache.set(geometry, edgesGeometry);
  }
  
  return edgesGeometry;
}

/**
 * Crea el material del wireframe
 */
function createWireframeMaterial(
  color: number = DEFAULT_WIREFRAME_CONFIG.color,
  opacity: number = DEFAULT_WIREFRAME_CONFIG.opacity
): THREE.LineBasicMaterial {
  return new THREE.LineBasicMaterial({
    color,
    opacity,
    transparent: opacity < 1.0,
    depthTest: true,
    depthWrite: false, // No escribir en depth buffer
  });
}

/**
 * Crea material blanco sólido para modelo
 */
function createSolidWhiteMaterial(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
  });
}

/**
 * Añade wireframe como hijo del mesh (sincronización automática)
 */
export function addWireframe(
  mesh: THREE.Mesh,
  config?: {
    color?: number;
    opacity?: number;
    threshold?: number;
  }
): THREE.LineSegments | null {
  if (!mesh || !mesh.isMesh || !mesh.geometry) {
    return null;
  }

  const finalConfig = {
    color: config?.color ?? DEFAULT_WIREFRAME_CONFIG.color,
    opacity: config?.opacity ?? DEFAULT_WIREFRAME_CONFIG.opacity,
    threshold: config?.threshold ?? SKETCHFAB_EDGE_THRESHOLD,
  };

  try {
    // Obtener o crear EdgesGeometry
    const edgesGeometry = getOrCreateEdgesGeometry(
      mesh.geometry,
      finalConfig.threshold
    );

    // Crear material del wireframe
    const wireframeMaterial = createWireframeMaterial(
      finalConfig.color,
      finalConfig.opacity
    );

    // Crear LineSegments
    const wireframe = new THREE.LineSegments(edgesGeometry, wireframeMaterial);
    wireframe.name = `${mesh.name || 'mesh'}_wireframe`;
    
    // Configuración
    wireframe.userData.isWireframe = true;
    wireframe.frustumCulled = false;
    wireframe.castShadow = false;
    wireframe.receiveShadow = false;
    wireframe.renderOrder = 1000; // Renderizar después
    
    // Excluir de shadow maps
    const originalOnBeforeRender = wireframe.onBeforeRender;
    wireframe.onBeforeRender = function(renderer, scene, camera, geometry, material, group) {
      if (camera && (camera as any).isShadowCamera) {
        return;
      }
      if (originalOnBeforeRender) {
        originalOnBeforeRender.call(this, renderer, scene, camera, geometry, material, group);
      }
    };
    
    // AÑADIR COMO HIJO DEL MESH para sincronización automática
    mesh.add(wireframe);
    
    return wireframe;
  } catch (error) {
    console.error('Error adding wireframe to mesh:', error);
    return null;
  }
}

/**
 * Aplica wireframe a todos los meshes de un modelo
 * Guarda materiales originales y aplica blanco sólido cuando wireframe está activo
 */
export function applyWireframeToModel(
  model: THREE.Object3D,
  config?: {
    color?: number;
    opacity?: number;
    threshold?: number;
    visible?: boolean;
    applySolidWhite?: boolean;
  }
): { wireframeGroup: THREE.Group; materialsMap?: Map<THREE.Mesh, THREE.Material | THREE.Material[]> } {
  const wireframeGroup = new THREE.Group();
  wireframeGroup.name = 'wireframes';
  wireframeGroup.visible = config?.visible ?? true;
  
  let materialsMap: Map<THREE.Mesh, THREE.Material | THREE.Material[]> | undefined;
  
  if (!model) return { wireframeGroup };

  // Guardar materiales originales si aplicamos blanco sólido
  if (config?.applySolidWhite) {
    materialsMap = saveOriginalMaterials(model);
    applySolidWhiteMaterials(model);
  }

  // Añadir wireframes como hijos de cada mesh
  model.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      
      // Crear wireframe (se añade como hijo del mesh automáticamente)
      const wireframe = addWireframe(mesh, {
        ...config,
        color: config?.color ?? 0x000000,
      });
      
      if (wireframe) {
        // Registrar en el grupo para tracking (pero NO añadir al grupo)
        // El wireframe ya está como hijo del mesh
        wireframe.userData.wireframeGroup = wireframeGroup;
      }
    }
  });

  wireframeGroup.userData.originalMaterialsMap = materialsMap;
  wireframeGroup.userData.model = model; // Guardar referencia al modelo
  
  // También guardar el originalMaterialsMap directamente en el modelo para acceso fácil
  if (materialsMap) {
    model.userData.originalMaterialsMap = materialsMap;
    model.userData.wireframeGroup = wireframeGroup;
  }

  return { wireframeGroup, materialsMap };
}

/**
 * Guarda los materiales originales de un modelo
 */
export function saveOriginalMaterials(model: THREE.Object3D): Map<THREE.Mesh, THREE.Material | THREE.Material[]> {
  const materialsMap = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();

  model.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      materialsMap.set(mesh, mesh.material);
    }
  });

  return materialsMap;
}

/**
 * Cambia los materiales del modelo a blanco sólido sin sombras
 */
export function applySolidWhiteMaterials(model: THREE.Object3D): void {
  if (!model) return;

  model.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      
      // Guardar material original si no está guardado
      if (!mesh.userData.originalMaterialBeforeWhite) {
        mesh.userData.originalMaterialBeforeWhite = mesh.material;
      }
      
      // Desactivar sombras
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      
      // Cambiar a material blanco sólido
      const whiteMaterial = createSolidWhiteMaterial();
      mesh.userData.whiteMaterial = whiteMaterial;
      mesh.material = whiteMaterial;
    }
  });
}

/**
 * Restaura los materiales originales del modelo
 */
export function restoreOriginalMaterials(
  model: THREE.Object3D,
  materialsMap?: Map<THREE.Mesh, THREE.Material | THREE.Material[]>
): void {
  if (!model) return;

  model.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      
      // Limpiar material blanco
      if (mesh.userData.whiteMaterial) {
        (mesh.userData.whiteMaterial as THREE.Material).dispose();
        delete mesh.userData.whiteMaterial;
      }
      
      // Restaurar material original
      let originalMaterial = materialsMap?.get(mesh);
      if (!originalMaterial && mesh.userData.originalMaterialBeforeWhite) {
        originalMaterial = mesh.userData.originalMaterialBeforeWhite;
        delete mesh.userData.originalMaterialBeforeWhite;
      }
      
      if (originalMaterial) {
        mesh.material = originalMaterial;
      }
      
      // Restaurar sombras
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });
}

/**
 * Activa o desactiva wireframe
 */
export function toggleWireframe(
  model: THREE.Object3D,
  visible: boolean
): void {
  if (!model) return;

  model.traverse((child) => {
    if ((child as THREE.LineSegments).isLineSegments) {
      const wireframe = child as THREE.LineSegments;
      if (wireframe.name.includes('_wireframe') || wireframe.userData.isWireframe) {
        wireframe.visible = visible;
      }
    }
  });
}

/**
 * Remueve todos los wireframes del modelo
 */
export function removeWireframeFromModel(
  model: THREE.Object3D,
  restoreMaterials: boolean = true
): void {
  if (!model) return;

  const toRemove: THREE.LineSegments[] = [];

  // Buscar todos los wireframes recursivamente
  model.traverse((child) => {
    if ((child as THREE.LineSegments).isLineSegments) {
      const wireframe = child as THREE.LineSegments;
      // Verificar si es un wireframe nuestro (por nombre o userData)
      if (wireframe.name.includes('_wireframe') || wireframe.userData.isWireframe === true) {
        toRemove.push(wireframe);
      }
    }
  });

  // Remover wireframes y limpiar recursos
  toRemove.forEach((wireframe) => {
    // Remover del parent
    if (wireframe.parent) {
      wireframe.parent.remove(wireframe);
    }
    
    // Limpiar geometría
    if (wireframe.geometry) {
      wireframe.geometry.dispose();
    }
    
    // Limpiar material
    const material = wireframe.material;
    if (material instanceof THREE.Material) {
      material.dispose();
    } else if (Array.isArray(material)) {
      material.forEach((mat) => mat.dispose());
    }
    
    // Limpiar userData
    delete wireframe.userData.isWireframe;
    delete wireframe.userData.wireframeGroup;
  });
  
  // Debug: verificar que se removieron
  if (toRemove.length > 0) {
    console.debug(`Removed ${toRemove.length} wireframes from model`);
  }
}

/**
 * Carga un modelo GLTF y aplica wireframe automáticamente
 */
export async function loadGLTFAndApplyWireframe(
  url: string,
  loader: THREE.Loader,
  config?: {
    color?: number;
    opacity?: number;
    threshold?: number;
    visible?: boolean;
    applySolidWhite?: boolean;
  }
): Promise<{
  gltf: any; // GLTF result from loader
  wireframeGroup: THREE.Group;
  materialsMap?: Map<THREE.Mesh, THREE.Material | THREE.Material[]>;
}> {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf: any) => {
        const { wireframeGroup, materialsMap } = applyWireframeToModel(gltf.scene, config);
        resolve({ gltf, wireframeGroup, materialsMap });
      },
      undefined,
      (error) => {
        reject(error);
      }
    );
  });
}

// No necesitamos syncWireframeTransformations porque los wireframes son hijos de los meshes
export function syncWireframeTransformations(_wireframeGroup: THREE.Group): void {
  // No-op: los wireframes son hijos de los meshes, se sincronizan automáticamente
}
