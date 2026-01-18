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
    try {
      const dracoLoader = new DRACOLoader();
      dracoLoader.setDecoderPath('/draco/gltf/');
      // No preload para evitar errores 404 que bloqueen la carga
      // dracoLoader.preload();
      this.setDRACOLoader(dracoLoader);
      logger.model3d.debug("GLTFLoaderWithDraco creado con path local:", '/draco/gltf/');
    } catch (error) {
      // Si Draco falla, continuar sin él - los modelos sin Draco seguirán funcionando
      logger.model3d.warn("No se pudo configurar DRACOLoader, continuando sin compresión Draco:", error);
    }
  }
}

// Componente interno que usa useLoader - solo se renderiza si la URL está validada
const ModelLoader = ({ url }: { url: string }) => {
  const gltf = useLoader(GLTFLoaderWithDraco, url);
  if (!gltf?.scene) return null;
  return <Clone object={gltf.scene} />;
};

const UploadedModel = ({ url, autoRotate, doubleSide }: { url: string; autoRotate: boolean; doubleSide?: boolean }) => {
  const ref = useRef<THREE.Group>(null);
  const wireframeGroupRef = useRef<THREE.Group | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [urlValidated, setUrlValidated] = useState(false);
  const viewerWireframe = useAppStore((state) => state.viewerWireframe);
  
  // Validar URL antes de cargar (sin revocar - el cache en db.ts gestiona las blob URLs)
  useEffect(() => {
    if (!url || url.trim() === '') {
      logger.uploadedModel.error("URL vacía o no definida");
      setIsLoading(false);
      setLoadError("URL vacía o no definida");
      setUrlValidated(false);
      return;
    }
    
    logger.uploadedModel.debug("Validando URL antes de cargar:", url);
    setIsLoading(true);
    setLoadError(null);
    setUrlValidated(false);

    // Validar tanto blob URLs como URLs HTTP del servidor
    const validateUrl = async () => {
      try {
        // Para blob URLs, validar directamente
        if (url.startsWith('blob:')) {
          const blobResponse = await fetch(url);
          if (!blobResponse.ok) {
            const errorMsg = `Error al acceder al blob: ${blobResponse.status}`;
            logger.uploadedModel.error(errorMsg);
            setLoadError(errorMsg);
            setIsLoading(false);
            setUrlValidated(false);
            return;
          }
          const blob = await blobResponse.blob();
          if (blob.size === 0) {
            const errorMsg = "El archivo blob está vacío";
            logger.uploadedModel.error(errorMsg);
            setLoadError(errorMsg);
            setIsLoading(false);
            setUrlValidated(false);
            return;
          }
          logger.uploadedModel.debug("Blob válido, tamaño:", blob.size, "bytes");
          setUrlValidated(true);
          return;
        }
        
        // Para URLs HTTP, intentar HEAD primero, luego GET si falla
        // Algunos servidores no soportan HEAD, así que usamos GET con range para solo leer los primeros bytes
        let response: Response;
        try {
          // Intentar HEAD primero (más eficiente)
          response = await fetch(url, { 
            method: 'HEAD',
            signal: AbortSignal.timeout(5000) // Timeout de 5 segundos
          });
        } catch (headError: any) {
          // Si HEAD falla (algunos servidores no lo soportan), intentar GET con Range
          logger.uploadedModel.debug("HEAD no disponible, usando GET con Range para validar");
          response = await fetch(url, { 
            method: 'GET',
            headers: { 'Range': 'bytes=0-0' }, // Solo leer el primer byte
            signal: AbortSignal.timeout(5000)
          });
        }
        
        if (!response.ok && response.status !== 206) { // 206 es Partial Content (normal para Range requests)
          const errorMsg = `Error al acceder a la URL: ${response.status} ${response.statusText}`;
          logger.uploadedModel.error(errorMsg);
          setLoadError(errorMsg);
          setIsLoading(false);
          setUrlValidated(false);
          return;
        }
        
        // Verificar content-type si está disponible
        const contentType = response.headers.get('content-type');
        if (contentType && !contentType.includes('model/gltf') && !contentType.includes('model/gltf-binary') && !contentType.includes('application/octet-stream')) {
          logger.uploadedModel.warn("Content-Type inesperado:", contentType, "- continuando de todas formas");
        }
        
        logger.uploadedModel.debug("URL validada correctamente");
        setUrlValidated(true);
      } catch (err: any) {
        // Si el error es de CORS o red, dar más tiempo - puede que solo sea lento
        if (err.name === 'TypeError' && err.message.includes('fetch')) {
          logger.uploadedModel.warn("Posible problema de CORS o red, intentando cargar de todas formas:", err.message);
          // Permitir continuar si es un problema de CORS (algunos servidores lo permiten solo en carga real)
          setUrlValidated(true);
          return;
        }
        
        const errorMsg = err.name === 'AbortError' 
          ? `Timeout al validar la URL (el servidor no respondió a tiempo)`
          : `Error validando URL: ${err.message}`;
        logger.uploadedModel.error(errorMsg, err);
        setLoadError(errorMsg);
        setIsLoading(false);
        setUrlValidated(false);
      }
    };
    
    validateUrl();
    // NOTA: NO revocamos blob URLs aquí porque están gestionadas por el cache en db.ts
    // El cache se encarga de revocarlas cuando sea necesario (LRU, eliminación de assets, etc.)
  }, [url]);

  // No usar useLoader aquí - en su lugar, renderizar ModelLoader condicionalmente cuando la URL esté validada
  // Esto evita que useLoader se ejecute antes de que la URL sea accesible
  
  // Marcar como validada cuando la URL está lista para cargar
  useEffect(() => {
    if (urlValidated && !loadError) {
      // La URL está validada, el ModelLoader se encargará de cargar el modelo
      logger.uploadedModel.debug("URL validada, listo para cargar modelo");
    }
  }, [urlValidated, loadError]);
  
  React.useEffect(() => {
    // Configurar materiales cuando el modelo esté cargado
    // Esperamos un frame para que el modelo se haya cargado desde ModelLoader
    if (!ref.current) return;
    
    const timeoutId = setTimeout(() => {
      if (!ref.current) return;
      
      // Asegurar que doubleSide tenga un valor por defecto
      const effectiveDoubleSide = doubleSide ?? false;
      const side = effectiveDoubleSide ? THREE.DoubleSide : THREE.FrontSide;
      
      ref.current.traverse((child) => {
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
      setIsLoading(false);
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [urlValidated, doubleSide, viewerWireframe]);

  // Aplicar o remover wireframe según el estado
  React.useEffect(() => {
    if (!ref.current || !urlValidated) return;

    // Esperar un frame para asegurar que el modelo esté cargado
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
    }, 200);

    return () => clearTimeout(timeoutId);
  }, [urlValidated, viewerWireframe]);


  // AutoRotate (los wireframes se sincronizan automáticamente al ser hijos de los meshes)
  useFrame(() => {
    if (ref.current && autoRotate) {
      ref.current.rotation.y += 0.02;
    }
    // No necesitamos syncWireframeTransformations porque los wireframes son hijos de los meshes
  });

  // No renderizar nada hasta que la URL esté validada
  // Si hay un error, el ErrorBoundary lo capturará y mostrará el fallback
  if (!urlValidated) {
    // Si hay un error de validación, lanzar error para el ErrorBoundary
    if (loadError) {
      logger.uploadedModel.error("No se puede renderizar modelo debido a error:", loadError);
      // Lanzar error para que el ErrorBoundary lo capture
      throw new Error(loadError);
    }
    return null;
  }

  // Renderizar ModelLoader que carga el modelo usando useLoader
  // El Suspense en el componente padre maneja el estado de carga
  return (
    <group ref={ref}>
      <Suspense fallback={null}>
        <ModelLoader url={url} />
      </Suspense>
    </group>
  );
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
