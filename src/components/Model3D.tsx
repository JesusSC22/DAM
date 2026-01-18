import React, { useRef, Suspense, Component, ReactNode, useState, useEffect } from 'react';
import { useFrame, extend, useLoader } from '@react-three/fiber';
import { useGLTF, Clone } from '@react-three/drei';
import { Asset } from '../types';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { logger } from '../utils/logger';
import { applyWireframeToModel, toggleWireframe, removeWireframeFromModel, syncWireframeTransformations, applySolidWhiteMaterials, restoreOriginalMaterials } from '../utils/wireframe';
import { useAppStore } from '../store/useAppStore';

interface Model3DProps {
  asset: Asset;
  autoRotate?: boolean;
  doubleSide?: boolean;
}

// Error Boundary para capturar fallos en la carga del modelo
class ModelErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode; resetKey?: string }, { hasError: boolean; error: any; resetKey?: string }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null, resetKey: props.resetKey };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  static getDerivedStateFromProps(props: any, state: any) {
    // Resetear el error si cambia la key (nuevo modelo)
    if (props.resetKey !== state.resetKey) {
      return { hasError: false, error: null, resetKey: props.resetKey };
    }
    return null;
  }

  componentDidCatch(error: any, errorInfo: any) {
    logger.model3d.error("Error loading model:", error, errorInfo);
    logger.model3d.error("Error stack:", error?.stack);
  }

  render() {
    if (this.state.hasError) {
      logger.model3d.error("Rendering error fallback");
      return this.props.fallback;
    }
    return this.props.children;
  }
}

// Crear un loader personalizado que extiende GLTFLoader con Draco preconfigurado
class GLTFLoaderWithDraco extends GLTFLoader {
  constructor() {
    super();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('/draco/gltf/');
    dracoLoader.preload();
    this.setDRACOLoader(dracoLoader);
    logger.model3d.debug("GLTFLoaderWithDraco creado con path local:", '/draco/gltf/');
  }
}

const UploadedModel = ({ url, autoRotate, doubleSide }: { url: string; autoRotate: boolean; doubleSide?: boolean }) => {
  const ref = useRef<THREE.Group>(null);
  const wireframeGroupRef = useRef<THREE.Group | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const viewerWireframe = useAppStore((state) => state.viewerWireframe);
  
  // Validar URL antes de cargar (sin revocar - el cache en db.ts gestiona las blob URLs)
  useEffect(() => {
    if (!url) {
      logger.uploadedModel.error("URL vacía o no definida");
      setIsLoading(false);
      return;
    }
    
    logger.uploadedModel.debug("Cargando modelo desde URL:", url);
    setIsLoading(true);

    // Verificar que la blob URL sea válida (solo validación, no revocación)
    if (url.startsWith('blob:')) {
      fetch(url)
        .then(response => {
          if (!response.ok) {
            logger.uploadedModel.error(`Error al acceder al blob: ${response.status}`);
            return;
          }
          return response.blob();
        })
        .then(blob => {
          if (blob) {
            if (blob.size === 0) {
              logger.uploadedModel.error("El archivo blob está vacío");
            } else {
              logger.uploadedModel.debug("Blob válido, tamaño:", blob.size, "bytes");
            }
          }
        })
        .catch(err => {
          logger.uploadedModel.error("Error validando blob URL:", err);
        });
    }
    // NOTA: NO revocamos blob URLs aquí porque están gestionadas por el cache en db.ts
    // El cache se encarga de revocarlas cuando sea necesario (LRU, eliminación de assets, etc.)
  }, [url]);

  // Usar useLoader con nuestro loader personalizado que tiene Draco preconfigurado
  const gltf = useLoader(GLTFLoaderWithDraco, url);
  const scene = gltf.scene;
  
  // Marcar como cargado cuando el modelo está listo
  useEffect(() => {
    if (scene) {
      setIsLoading(false);
      logger.uploadedModel.debug("Modelo cargado correctamente");
    }
  }, [scene]);
  
  React.useEffect(() => {
    if (scene) {
      // Asegurar que doubleSide tenga un valor por defecto
      const effectiveDoubleSide = doubleSide ?? false;
      const side = effectiveDoubleSide ? THREE.DoubleSide : THREE.FrontSide;
      
      scene.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          
          // Configurar sombras SOLO si el wireframe NO está activo
          // Si wireframe está activo, las sombras ya están desactivadas en applySolidWhiteMaterials
          if (!viewerWireframe) {
            mesh.castShadow = true;
            mesh.receiveShadow = true;
          }
          
          // Configurar materiales (sin wireframe, mantener sólido)
          const configureMaterial = (material: THREE.Material) => {
            material.side = side;
            // Asegurar que NO está en modo wireframe
            if ('wireframe' in material) {
              (material as any).wireframe = false;
            }
            material.needsUpdate = true;
          };
          
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach(m => configureMaterial(m));
          } else {
            configureMaterial(mesh.material);
          }
        }
      });
      
      logger.uploadedModel.debug("Materiales configurados con doubleSide:", effectiveDoubleSide);
    }
  }, [scene, doubleSide, viewerWireframe]);

  // Aplicar o remover wireframe según el estado
  React.useEffect(() => {
    if (!ref.current) return;

    // Esperar un frame para asegurar que Clone haya terminado de renderizar
    const timeoutId = setTimeout(() => {
      if (!ref.current) return;

      // Remover wireframes existentes primero (si hay)
      if (wireframeGroupRef.current && ref.current) {
        // Restaurar materiales antes de remover wireframes
        if (wireframeGroupRef.current.userData.originalMaterialsMap) {
          restoreOriginalMaterials(
            ref.current,
            wireframeGroupRef.current.userData.originalMaterialsMap
          );
        }
        removeWireframeFromModel(ref.current, false);
        wireframeGroupRef.current = null;
      }

      // También asegurar que no haya wireframes residuales cuando está desactivado
      if (!viewerWireframe && ref.current) {
        // Buscar y remover cualquier wireframe residual que pueda quedar
        removeWireframeFromModel(ref.current, false);
        // Asegurar que los materiales estén restaurados
        restoreOriginalMaterials(ref.current);
      }

      // Si wireframe está activo, aplicarlo
      if (viewerWireframe) {
        // Aplicar wireframe a todos los meshes del objeto clonado
        // Cuando wireframe está activo: modelo blanco sólido + wireframe negro
        // Los wireframes se añaden como hijos de cada mesh (sincronización automática)
        const { wireframeGroup } = applyWireframeToModel(ref.current, {
          visible: true,
          applySolidWhite: true, // Cambiar modelo a blanco sólido cuando wireframe está activo
          color: 0x000000, // Wireframe negro
        });

        wireframeGroupRef.current = wireframeGroup;
        
        // Contar wireframes realmente añadidos
        let wireframeCount = 0;
        ref.current.traverse((child) => {
          if ((child as THREE.LineSegments).isLineSegments && (child as THREE.LineSegments).userData.isWireframe) {
            wireframeCount++;
          }
        });
        logger.uploadedModel.debug("Wireframes aplicados:", wireframeCount);
      } else {
        // Wireframe desactivado - asegurar que se removieron y materiales restaurados
        logger.uploadedModel.debug("Wireframes removidos y materiales restaurados");
      }
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      if (wireframeGroupRef.current && ref.current) {
        // Restaurar materiales antes de remover wireframes
        if (wireframeGroupRef.current.userData.originalMaterialsMap) {
          restoreOriginalMaterials(
            ref.current,
            wireframeGroupRef.current.userData.originalMaterialsMap
          );
        }
        removeWireframeFromModel(ref.current, false); // No restaurar dos veces
        wireframeGroupRef.current = null;
      }
    };
  }, [scene, viewerWireframe]);


  // AutoRotate (los wireframes se sincronizan automáticamente al ser hijos de los meshes)
  useFrame(() => {
    if (ref.current && autoRotate) {
      ref.current.rotation.y += 0.02;
    }
    // No necesitamos syncWireframeTransformations porque los wireframes son hijos de los meshes
  });

  // No renderizar nada hasta que el modelo esté completamente cargado
  // Esto evita que el fallback del Suspense se quede visible
  if (isLoading || !scene) {
    return null;
  }

  // Usamos el componente Clone de drei que maneja mejor la clonación de escenas GLTF
  // Importante: El Clone se añade al grupo padre, y Center calculará el bounding box correctamente
  return <Clone ref={ref} object={scene} />;
}

export const Model3D: React.FC<Model3DProps> = ({ asset, autoRotate = false, doubleSide }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Use prop if provided, else fallback to asset default
  const effectiveDoubleSide = doubleSide !== undefined ? doubleSide : asset.doubleSide;

  // Animación para formas básicas
  useFrame((state) => {
    if (meshRef.current) {
      if (autoRotate) {
        meshRef.current.rotation.y += 0.02;
        meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.5) * 0.1;
      }
    }
  });

  const material = new THREE.MeshStandardMaterial({ 
    color: asset.color || '#6366f1',
    roughness: 0.3,
    metalness: 0.8,
    side: effectiveDoubleSide ? THREE.DoubleSide : THREE.FrontSide
  });

  // Si es un archivo subido (blob URL) o una URL real externa
  const isRealModel = asset.url && (asset.url.startsWith('blob:') || asset.url.startsWith('http') || asset.url.startsWith('/') || asset.url.startsWith('./'));

  if (isRealModel) {
    // Validar que la URL no esté vacía
    if (!asset.url || asset.url.trim() === '') {
      logger.model3d.error("URL del modelo está vacía:", asset);
      // No renderizar nada si la URL no está lista (evitar cubo fantasma)
      return null;
    }

    logger.model3d.debug("Renderizando modelo real desde URL:", asset.url);
    
    // Usar una key única basada en la URL y el ID del asset para forzar remontaje cuando cambia
    // Esto asegura que useLoader recargue el modelo cuando la URL cambia (ej: blob URL regenerada)
    const modelKey = `${asset.id}-${asset.url}`;
    
    return (
      <ModelErrorBoundary resetKey={modelKey} fallback={
        <mesh castShadow={false} receiveShadow={false}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="red" />
        </mesh>
      }>
        <Suspense fallback={null}>
          <UploadedModel 
            key={modelKey} 
            url={asset.url} 
            autoRotate={autoRotate} 
            doubleSide={effectiveDoubleSide} 
          />
        </Suspense>
      </ModelErrorBoundary>
    );
  }

  // Fallback a primitivas para los datos de demo locales que no tienen archivos reales
  switch (asset.shape) {
    case 'sphere':
      return (
        <mesh ref={meshRef} castShadow receiveShadow>
          <sphereGeometry args={[1, 32, 32]} />
          <primitive object={material} attach="material" />
        </mesh>
      );
    case 'torus':
      return (
        <mesh ref={meshRef} castShadow receiveShadow>
          <torusGeometry args={[0.8, 0.3, 16, 100]} />
          <primitive object={material} attach="material" />
        </mesh>
      );
    case 'cube':
    default:
      return (
        <mesh ref={meshRef} castShadow receiveShadow>
          <boxGeometry args={[1.5, 1.5, 1.5]} />
          <primitive object={material} attach="material" />
        </mesh>
      );
  }
};
