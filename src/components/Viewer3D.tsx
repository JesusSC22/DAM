import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Center, PerspectiveCamera, Environment, ContactShadows } from '@react-three/drei';
import { Asset } from '../types';
import { Model3D } from './Model3D';
import { MaterialsPanel } from './MaterialsPanel';
import { useAppStore } from '../store/useAppStore';
import * as THREE from 'three';
import { Settings, X, Palette, Layers, Image as ImageIcon, Package, FlipHorizontal, Grid3x3 } from 'lucide-react';


interface Viewer3DProps {
  asset: Asset | null;
  doubleSide?: boolean;
}

type BackgroundType = 'solid' | 'gradient' | 'hdri';

export const Viewer3D: React.FC<Viewer3DProps> = ({ asset }) => {
  const [floorY, setFloorY] = useState(-0.5);
  const modelRef = useRef<THREE.Group>(null);
  const controlsRef = useRef<any>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const [isBackgroundPanelOpen, setIsBackgroundPanelOpen] = useState(false);
  const [isMaterialsPanelOpen, setIsMaterialsPanelOpen] = useState(false);
  const [canvasKey, setCanvasKey] = useState(0); // Key para forzar remontaje del Canvas cuando se pierde el contexto
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isContextLost, setIsContextLost] = useState(false);
  
  // Cerrar el panel de materiales cuando cambia el asset para forzar recarga
  useEffect(() => {
    setIsMaterialsPanelOpen(false);
  }, [asset?.id]);
  
  // Resetear floorY cuando cambia el asset para evitar sombras fantasma
  useEffect(() => {
    setFloorY(-0.5);
    // No limpiar manualmente el modelRef - React maneja el desmontaje/montaje automáticamente
    // Limpiar manualmente puede interferir con el cálculo de Center y causar posicionamiento incorrecto
  }, [asset?.id]);

  // Calcular floorY cuando el modelo esté listo como respaldo del cálculo en onCentered
  useEffect(() => {
    if (!asset) return;

    // Esperar un poco para que el modelo esté completamente cargado y centrado
    const timeoutId = setTimeout(() => {
      if (modelRef.current) {
        // Calcular el bounding box del modelo en coordenadas del mundo
        const box = new THREE.Box3().setFromObject(modelRef.current);
        
        if (!box.isEmpty()) {
          // min.y es el punto más bajo del modelo después del centrado
          const newY = box.min.y;
          
          // Solo actualizar si el valor es válido y es negativo (por debajo del origen)
          // El modelo centrado debería tener min.y negativo
          if (!isNaN(newY) && isFinite(newY) && newY < 0) {
            setFloorY((prevFloorY) => {
              // Solo actualizar si el cambio es significativo
              if (Math.abs(newY - prevFloorY) > 0.01) {
                return newY;
              }
              return prevFloorY;
            });
          }
        }
      }
    }, 200);

    return () => clearTimeout(timeoutId);
  }, [asset?.id, asset?.url]);
  
  // Usar el store para la configuración del viewport
  const {
    viewerBackgroundType,
    viewerSolidColor,
    viewerGradientColor1,
    viewerGradientColor2,
    viewerHdriPreset,
    viewerHdriBlur,
    viewerDoubleSide,
    viewerWireframe,
    setViewerBackgroundType,
    setViewerSolidColor,
    setViewerGradientColor1,
    setViewerGradientColor2,
    setViewerHdriPreset,
    setViewerHdriBlur,
    setViewerDoubleSide,
    setViewerWireframe,
  } = useAppStore();

  // Desactivar wireframe cuando cambia el asset o se sale del visor
  // Debe estar después de useAppStore() para tener acceso a setViewerWireframe
  useEffect(() => {
    setViewerWireframe(false);
  }, [asset?.id, setViewerWireframe]);

  if (!asset) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-50 dark:bg-gray-900 text-gray-400 dark:text-gray-500 transition-colors duration-200">
        <p>Selecciona un modelo para visualizar</p>
      </div>
    );
  }

  // Verificar si floorY está correctamente calculado (no es el valor por defecto)
  const hasValidFloorY = !isNaN(floorY) && floorY !== -0.5;

  // Calcular el estilo del fondo según el tipo
  const getBackgroundStyle = () => {
    switch (viewerBackgroundType) {
      case 'solid':
        return { background: viewerSolidColor };
      case 'gradient':
        return { 
          background: `linear-gradient(to bottom, ${viewerGradientColor1}, ${viewerGradientColor2})` 
        };
      case 'hdri':
        return { background: 'transparent' };
      default:
        return { background: `linear-gradient(to bottom, ${viewerGradientColor1}, ${viewerGradientColor2})` };
    }
  };

  const hdriPresets = [
    { value: 'city', label: 'Ciudad' },
    { value: 'sunset', label: 'Atardecer' },
    { value: 'dawn', label: 'Amanecer' },
    { value: 'night', label: 'Noche' },
    { value: 'warehouse', label: 'Almacén' },
    { value: 'forest', label: 'Bosque' },
    { value: 'apartment', label: 'Apartamento' },
    { value: 'studio', label: 'Estudio' },
    { value: 'lobby', label: 'Lobby' },
  ];

  // Función para enfocar la cámara en un material específico
  const focusOnMaterial = useCallback((materialName: string | null) => {
    if (!modelRef.current || !cameraRef.current || !controlsRef.current || !materialName) return;

    const box = new THREE.Box3();
    let hasMeshes = false;

    // Si está en modo wireframe, necesitamos buscar por los materiales originales guardados
    let originalMaterialsMap: Map<THREE.Mesh, THREE.Material | THREE.Material[]> | undefined;
    if (viewerWireframe) {
      // Buscar el wireframeGroup para acceder a los materiales originales
      modelRef.current.traverse((child) => {
        if ((child as THREE.LineSegments).isLineSegments && (child as THREE.LineSegments).userData.wireframeGroup) {
          const wireframeGroup = (child as THREE.LineSegments).userData.wireframeGroup;
          if (wireframeGroup?.userData?.originalMaterialsMap) {
            originalMaterialsMap = wireframeGroup.userData.originalMaterialsMap;
          }
        }
      });
      // También buscar en los wireframes hijos de los meshes
      modelRef.current.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.children.forEach((wireframe) => {
            if ((wireframe as THREE.LineSegments).isLineSegments && wireframe.userData.wireframeGroup) {
              const wg = wireframe.userData.wireframeGroup;
              if (wg?.userData?.originalMaterialsMap) {
                originalMaterialsMap = wg.userData.originalMaterialsMap;
              }
            }
          });
        }
      });
    }

    // Calcular el bounding box de todos los meshes que usan este material
    modelRef.current.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        let hasMatchingMaterial = false;
        
        if (viewerWireframe && originalMaterialsMap) {
          // En modo wireframe: buscar en materiales originales guardados
          const originalMaterial = originalMaterialsMap.get(mesh);
          if (originalMaterial) {
            const materials = Array.isArray(originalMaterial) ? originalMaterial : [originalMaterial];
            hasMatchingMaterial = materials.some(mat => mat.name === materialName);
          }
          // También verificar en userData como fallback
          if (!hasMatchingMaterial && mesh.userData.originalMaterialBeforeWhite) {
            const origMat = mesh.userData.originalMaterialBeforeWhite;
            const materials = Array.isArray(origMat) ? origMat : [origMat];
            hasMatchingMaterial = materials.some(mat => mat && mat.name === materialName);
          }
        } else {
          // Modo normal: buscar en materiales actuales
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          hasMatchingMaterial = materials.some(mat => mat.name === materialName);
        }
        
        if (hasMatchingMaterial && mesh.geometry) {
          // Expandir el bounding box con este mesh
          const meshBox = new THREE.Box3().setFromObject(mesh);
          if (hasMeshes) {
            box.union(meshBox);
          } else {
            box.copy(meshBox);
            hasMeshes = true;
          }
        }
      }
    });

    if (!hasMeshes) return;

    // Calcular el centro y el tamaño del bounding box
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const distance = maxDim * 2.5; // Distancia desde el objeto

    // Calcular posición de la cámara
    const direction = new THREE.Vector3(0, 0, 1);
    const cameraPosition = center.clone().add(direction.multiplyScalar(distance));
    cameraPosition.y += size.y * 0.5; // Elevar un poco la cámara

    // Animar la cámara y los controles suavemente
    const startCameraPosition = cameraRef.current.position.clone();
    const startTarget = controlsRef.current.target.clone();
    const duration = 800; // Duración de la animación en ms
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function (easeInOutCubic)
      const eased = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      // Interpolar posición de la cámara
      cameraRef.current!.position.lerpVectors(startCameraPosition, cameraPosition, eased);
      
      // Interpolar target
      controlsRef.current!.target.lerpVectors(startTarget, center, eased);
      controlsRef.current!.update();

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  }, [viewerWireframe]);

  // Función para iluminar materiales al hacer hover
  // Funciona también en modo wireframe cambiando el color del material blanco
  const handleMaterialHover = useCallback((materialName: string | null) => {
    if (!modelRef.current) return;

    // Si está en modo wireframe, necesitamos acceder a los materiales originales guardados
    let originalMaterialsMap: Map<THREE.Mesh, THREE.Material | THREE.Material[]> | undefined;
    if (viewerWireframe && modelRef.current) {
      // Acceder directamente al originalMaterialsMap guardado en el modelo
      if (modelRef.current.userData.originalMaterialsMap) {
        originalMaterialsMap = modelRef.current.userData.originalMaterialsMap;
      } else {
        // Fallback: buscar en wireframes hijos
        modelRef.current.traverse((child) => {
          if ((child as THREE.LineSegments).isLineSegments && (child as THREE.LineSegments).userData.wireframeGroup) {
            const wg = (child as THREE.LineSegments).userData.wireframeGroup;
            if (wg?.userData?.originalMaterialsMap) {
              originalMaterialsMap = wg.userData.originalMaterialsMap;
            }
          }
        });
      }
    }

    // Primero, restaurar todos los materiales a su estado original
    modelRef.current.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        
        materials.forEach((mat: THREE.Material) => {
          // En modo wireframe, restaurar color blanco del MeshBasicMaterial
          if (viewerWireframe && mat instanceof THREE.MeshBasicMaterial) {
            mat.color.setHex(0xffffff);
            mat.needsUpdate = true;
          } else if ('emissive' in mat && mat.emissive instanceof THREE.Color) {
            // Modo normal: restaurar emissive
            mat.emissive.setHex(0x000000);
            if ('emissiveIntensity' in mat) {
              (mat as any).emissiveIntensity = 0;
            }
            mat.needsUpdate = true;
          }
        });
      }
    });

    // Si hay un material específico, destacarlo
    if (materialName) {
      modelRef.current.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          
          let hasMatchingMaterial = false;
          
          if (viewerWireframe && originalMaterialsMap) {
            // En modo wireframe: buscar en materiales originales guardados
            const originalMaterial = originalMaterialsMap.get(mesh);
            if (originalMaterial) {
              const origMats = Array.isArray(originalMaterial) ? originalMaterial : [originalMaterial];
              hasMatchingMaterial = origMats.some(mat => mat && mat.name === materialName);
            }
            // También verificar en userData como fallback
            if (!hasMatchingMaterial && mesh.userData.originalMaterialBeforeWhite) {
              const origMat = mesh.userData.originalMaterialBeforeWhite;
              const origMats = Array.isArray(origMat) ? origMat : [origMat];
              hasMatchingMaterial = origMats.some(mat => mat && mat.name === materialName);
            }
          } else {
            // Modo normal: buscar en materiales actuales
            hasMatchingMaterial = materials.some(mat => mat.name === materialName);
          }
          
          if (hasMatchingMaterial) {
            materials.forEach((mat: THREE.Material) => {
              if (viewerWireframe && mat instanceof THREE.MeshBasicMaterial) {
                // En modo wireframe: cambiar color del material blanco a cyan para destacar
                mat.color.setHex(0x00ffff); // Cyan
                mat.needsUpdate = true;
              } else if ('emissive' in mat && mat.emissive instanceof THREE.Color) {
                // Modo normal: usar emissive
                // Guardar el color original del material para calcular el contraste
                const originalColor = ('color' in mat && mat.color instanceof THREE.Color) 
                  ? mat.color.clone() 
                  : new THREE.Color(0xffffff);
                
                const luminance = originalColor.r * 0.299 + originalColor.g * 0.587 + originalColor.b * 0.114;
                
                if (luminance < 0.3 || originalColor.r > originalColor.g * 1.5) {
                  mat.emissive.setHex(0x00ffff); // Cyan para contraste con rojo/oscuro
                } else {
                  mat.emissive.setHex(0xffff00); // Amarillo para contraste con colores claros
                }
                if ('emissiveIntensity' in mat) {
                  (mat as any).emissiveIntensity = 0.15;
                }
                mat.needsUpdate = true;
              }
            });
          }
        }
      });
    }
  }, [viewerWireframe]);

  // Mostrar mensaje si el contexto está perdido
  if (isContextLost) {
    return (
      <div className="h-full w-full relative group transition-colors duration-200 flex items-center justify-center" style={getBackgroundStyle()}>
        <div className="text-center p-8 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl shadow-lg">
          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Contexto WebGL perdido
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Recuperando contexto... Por favor espera.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full relative group transition-colors duration-200" style={getBackgroundStyle()}>
      <Canvas 
        key={canvasKey}
        dpr={[1, 2]} 
        gl={{ 
          preserveDrawingBuffer: false, // Cambiar a false para evitar problemas de memoria
          powerPreference: "high-performance",
          antialias: true,
          alpha: false, // Cambiar a false para evitar plano negro
          stencil: false,
          depth: true,
          premultipliedAlpha: false
        }}
        onCreated={({ gl, scene, camera }) => {
          // Guardar referencia al canvas para manejar eventos de contexto
          const canvas = gl.domElement;
          canvasRef.current = canvas;
          
          // Configurar el color de fondo del renderer para evitar plano negro
          // El fondo se maneja con CSS, así que usamos transparente
          gl.setClearColor(0x000000, 0);
          
          // Configurar manejo de pérdida de contexto
          const handleContextLost = (event: Event) => {
            event.preventDefault();
            console.warn('WebGL Context Lost - Limpiando recursos...');
            setIsContextLost(true);
            // No limpiar manualmente - React Three Fiber lo maneja mejor al remontar
          };
          
          const handleContextRestored = () => {
            console.log('WebGL Context Restored - Reiniciando canvas...');
            setIsContextLost(false);
            // Forzar remontaje cuando se recupera el contexto con un delay
            // para asegurar que el contexto esté completamente restaurado
            // React Three Fiber limpiará automáticamente al remontar
            setTimeout(() => {
              setCanvasKey(prev => prev + 1);
              setFloorY(-0.5);
            }, 150);
          };
          
          canvas.addEventListener('webglcontextlost', handleContextLost);
          canvas.addEventListener('webglcontextrestored', handleContextRestored);
          
          // Cleanup
          return () => {
            canvas.removeEventListener('webglcontextlost', handleContextLost);
            canvas.removeEventListener('webglcontextrestored', handleContextRestored);
          };
        }}
      >
        <PerspectiveCamera 
          makeDefault 
          position={[0, 1.2, 2.2]} 
          fov={40}
          ref={(cam) => {
            if (cam) cameraRef.current = cam;
          }}
        />
        
        {viewerBackgroundType === 'hdri' ? (
          <Environment preset={viewerHdriPreset as any} background backgroundBlurriness={viewerHdriBlur} />
        ) : (
          <Environment preset="city" />
        )}
        <ambientLight intensity={0.7} />

        <Center 
          key={`center-${asset.id}-${asset.url}`}
          onCentered={() => {
            // Calcular floorY después de que Center haya centrado el modelo
            // Usamos setTimeout para asegurar que el modelo esté completamente posicionado
            setTimeout(() => {
              if (modelRef.current) {
                // Calcular el bounding box del modelo centrado en coordenadas del mundo
                const box = new THREE.Box3().setFromObject(modelRef.current);
                
                if (!box.isEmpty()) {
                  // min.y es el punto más bajo del modelo después del centrado
                  // Como el modelo está centrado, min.y debería ser negativo
                  const newY = box.min.y;
                  
                  // Solo actualizar si el valor es válido, es negativo y es diferente
                  if (!isNaN(newY) && isFinite(newY) && newY < 0) {
                    setFloorY((prevFloorY) => {
                      // Solo actualizar si el cambio es significativo
                      if (Math.abs(newY - prevFloorY) > 0.01) {
                        return newY;
                      }
                      return prevFloorY;
                    });
                  }
                }
              }
            }, 100);
          }}
        >
           <group ref={modelRef}>
             <Model3D 
               asset={asset} 
               doubleSide={viewerDoubleSide} 
             />
           </group>
        </Center>
        
        {/* Renderizar sombras solo si floorY está calculado correctamente Y wireframe está desactivado */}
        {/* Cuando wireframe está activo, NO mostrar sombras */}
        {hasValidFloorY && !viewerWireframe && (
          <ContactShadows
            key={`shadows-${asset.id}-${floorY.toFixed(3)}`}
            position={[0, floorY - 0.001, 0]}
            opacity={1.0}
            scale={20}
            blur={0.2}
            far={10}
            resolution={1024}
            frames={1}
          />
        )}
        
        <OrbitControls 
          makeDefault 
          minPolarAngle={0} 
          maxPolarAngle={Math.PI / 1.75} 
          enablePan={false}
          target={[0, 0, 0]}
          ref={(controls) => {
            if (controls) controlsRef.current = controls;
          }}
        />
      </Canvas>

      {/* Botones de control */}
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        {/* Botón para ver materiales */}
        {asset.url && (
          <button
            onClick={() => setIsMaterialsPanelOpen(!isMaterialsPanelOpen)}
            className={`px-4 py-3.5 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl shadow-lg hover:bg-white dark:hover:bg-gray-800 transition-all duration-200 border border-gray-200 dark:border-gray-700 min-h-[44px] flex items-center justify-center ${
              isMaterialsPanelOpen ? 'ring-2 ring-blue-500' : ''
            }`}
            title="Ver materiales y texturas"
          >
            <Package size={20} className="text-gray-700 dark:text-gray-300" />
          </button>
        )}
        
        {/* Botón para toggle double side */}
        <button
          onClick={() => setViewerDoubleSide(!viewerDoubleSide)}
          className={`px-4 py-3.5 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl shadow-lg hover:bg-white dark:hover:bg-gray-800 transition-all duration-200 border border-gray-200 dark:border-gray-700 min-h-[44px] flex items-center justify-center ${
            viewerDoubleSide ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/30' : ''
          }`}
          title="Activar/desactivar doble cara"
        >
          <FlipHorizontal size={20} className={`${viewerDoubleSide ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`} />
        </button>
        
        {/* Botón para toggle wireframe */}
        {asset.url && (
          <button
            onClick={() => setViewerWireframe(!viewerWireframe)}
            className={`px-4 py-3.5 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl shadow-lg hover:bg-white dark:hover:bg-gray-800 transition-all duration-200 border border-gray-200 dark:border-gray-700 min-h-[44px] flex items-center justify-center ${
              viewerWireframe ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/30' : ''
            }`}
            title="Activar/desactivar wireframe"
          >
            <Grid3x3 size={20} className={`${viewerWireframe ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`} />
          </button>
        )}
        
        {/* Botón para abrir panel de configuración */}
        <button
          onClick={() => setIsBackgroundPanelOpen(!isBackgroundPanelOpen)}
          className="px-4 py-3.5 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl shadow-lg hover:bg-white dark:hover:bg-gray-800 transition-all duration-200 border border-gray-200 dark:border-gray-700 min-h-[44px] flex items-center justify-center"
          title="Configurar fondo"
        >
          <Settings size={20} className="text-gray-700 dark:text-gray-300" />
        </button>
      </div>

      {/* Panel de materiales y texturas */}
      <MaterialsPanel
        modelUrl={asset.url || null}
        assetId={asset.id}
        isOpen={isMaterialsPanelOpen}
        onClose={() => setIsMaterialsPanelOpen(false)}
        onMaterialHover={handleMaterialHover}
        onMaterialClick={focusOnMaterial}
      />

      {/* Panel de configuración de fondo */}
      {isBackgroundPanelOpen && (
        <div className="absolute top-16 right-4 z-20 w-80 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Configuración de Fondo
            </h3>
            <button
              onClick={() => setIsBackgroundPanelOpen(false)}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
            >
              <X size={18} className="text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Selector de tipo de fondo */}
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                Tipo de Fondo
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setViewerBackgroundType('solid')}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    viewerBackgroundType === 'solid'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <Palette size={20} className={`mx-auto mb-1 ${
                    viewerBackgroundType === 'solid' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'
                  }`} />
                  <span className={`text-xs block ${
                    viewerBackgroundType === 'solid' ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-600 dark:text-gray-400'
                  }`}>Color</span>
                </button>
                <button
                  onClick={() => setViewerBackgroundType('gradient')}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    viewerBackgroundType === 'gradient'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <Layers size={20} className={`mx-auto mb-1 ${
                    viewerBackgroundType === 'gradient' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'
                  }`} />
                  <span className={`text-xs block ${
                    viewerBackgroundType === 'gradient' ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-600 dark:text-gray-400'
                  }`}>Degradado</span>
                </button>
                <button
                  onClick={() => setViewerBackgroundType('hdri')}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    viewerBackgroundType === 'hdri'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <ImageIcon size={20} className={`mx-auto mb-1 ${
                    viewerBackgroundType === 'hdri' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'
                  }`} />
                  <span className={`text-xs block ${
                    viewerBackgroundType === 'hdri' ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-600 dark:text-gray-400'
                  }`}>HDRI</span>
                </button>
              </div>
            </div>

            {/* Opciones según el tipo de fondo */}
            {viewerBackgroundType === 'solid' && (
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                  Color
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={viewerSolidColor}
                    onChange={(e) => setViewerSolidColor(e.target.value)}
                    className="h-10 w-20 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={viewerSolidColor}
                    onChange={(e) => setViewerSolidColor(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                    placeholder="#ffffff"
                  />
                </div>
              </div>
            )}

            {viewerBackgroundType === 'gradient' && (
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                    Color Superior
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={viewerGradientColor1}
                      onChange={(e) => setViewerGradientColor1(e.target.value)}
                      className="h-10 w-20 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={viewerGradientColor1}
                      onChange={(e) => setViewerGradientColor1(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                      placeholder="#303745"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                    Color Inferior
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={viewerGradientColor2}
                      onChange={(e) => setViewerGradientColor2(e.target.value)}
                      className="h-10 w-20 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={viewerGradientColor2}
                      onChange={(e) => setViewerGradientColor2(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                      placeholder="#ffffff"
                    />
                  </div>
                </div>
              </div>
            )}

            {viewerBackgroundType === 'hdri' && (
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                    Preset HDRI
                  </label>
                  <select
                    value={viewerHdriPreset}
                    onChange={(e) => setViewerHdriPreset(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                  >
                    {hdriPresets.map((preset) => (
                      <option key={preset.value} value={preset.value}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                    Blur: {viewerHdriBlur.toFixed(1)}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={viewerHdriBlur}
                    onChange={(e) => setViewerHdriBlur(parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                    <span>Nítido</span>
                    <span>Borroso</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
