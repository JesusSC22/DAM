import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

export interface ModelAnalysis {
  vertices: number;
  polygons: number;
  materialCount: number;
}

class ThumbnailGeneratorWorker {
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private loader: GLTFLoader;

  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = null;

    // Initial camera setup (will be updated per request if needed, but ratio matters)
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000); // Ratio 1 initially
    
    // Configurar GLTFLoader con DRACOLoader local (CSP compatible)
    this.loader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('/draco/gltf/');
    dracoLoader.preload();
    this.loader.setDRACOLoader(dracoLoader);
    
    // Logger simple para workers (no puede importar el logger común)
    if (import.meta.env.DEV) {
      console.debug('[ThumbnailWorker] DRACOLoader configurado con path local:', '/draco/gltf/');
    }

    this.setupLighting();
  }

  private initRenderer(width: number, height: number) {
    if (this.renderer && this.renderer.domElement.width === width && this.renderer.domElement.height === height) {
        return;
    }

    if (this.renderer) {
        this.renderer.dispose();
    }

    // @ts-ignore - OffscreenCanvas is available in worker scope
    const canvas = new OffscreenCanvas(width, height);
    
    this.renderer = new THREE.WebGLRenderer({ 
        canvas: canvas, 
        alpha: true, 
        antialias: true 
    });
    this.renderer.setSize(width, height, false);
    this.renderer.setPixelRatio(1);
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private setupLighting() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(5, 5, 5);
    this.scene.add(dirLight);
  }

  async generateFromBlob(blob: Blob, width: number, height: number, options?: { doubleSide?: boolean }): Promise<Blob | null> {
    this.initRenderer(width, height);
    if (!this.renderer) return null;

    const url = URL.createObjectURL(blob);
    
    try {
      const gltf = await this.loader.loadAsync(url);
      const model = gltf.scene;

      if (options?.doubleSide) {
        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            if (Array.isArray(mesh.material)) {
              mesh.material.forEach(m => { m.side = THREE.DoubleSide; });
            } else {
              mesh.material.side = THREE.DoubleSide;
            }
          }
        });
      }
      
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());

      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 1.2 / maxDim;
      
      model.scale.setScalar(scale);
      model.position.sub(center.multiplyScalar(scale));

      this.scene.add(model);
      
      this.camera.position.set(0.5, 0.5, 2.5);
      this.camera.lookAt(0, 0, 0);

      this.renderer.render(this.scene, this.camera);

      this.scene.remove(model);
      URL.revokeObjectURL(url);

      const offscreen = this.renderer.domElement as unknown as OffscreenCanvas;
      return await offscreen.convertToBlob({
        type: 'image/png'
      });

    } catch (error) {
      // Errors siempre se muestran, incluso en producción
      console.error('[ThumbnailWorker] Error generating thumbnail:', error);
      URL.revokeObjectURL(url);
      return null;
    }
  }

  async analyzeModel(blob: Blob): Promise<ModelAnalysis | null> {
    const url = URL.createObjectURL(blob);
    try {
      const gltf = await this.loader.loadAsync(url);
      const model = gltf.scene;
      
      let vertices = 0;
      let polygons = 0;
      const materials = new Set();

      model.traverse((object) => {
        if ((object as THREE.Mesh).isMesh) {
          const mesh = object as THREE.Mesh;
          const geometry = mesh.geometry;
          
          if (geometry) {
            vertices += geometry.attributes.position.count;
            if (geometry.index) {
              polygons += geometry.index.count / 3;
            } else {
              polygons += geometry.attributes.position.count / 3;
            }
          }

          if (mesh.material) {
            if (Array.isArray(mesh.material)) {
              mesh.material.forEach(m => materials.add(m.uuid));
            } else {
              materials.add((mesh.material as THREE.Material).uuid);
            }
          }
        }
      });

      URL.revokeObjectURL(url);
      return {
        vertices: Math.round(vertices),
        polygons: Math.round(polygons),
        materialCount: materials.size
      };

    } catch (error) {
      // Errors siempre se muestran, incluso en producción
      console.error('[ThumbnailWorker] Error analyzing model:', error);
      URL.revokeObjectURL(url);
      return null;
    }
  }
}

const generator = new ThumbnailGeneratorWorker();

self.onmessage = async (e: MessageEvent) => {
  const { type, id, blob, width, height, options } = e.data;

  try {
    if (type === 'generate') {
      const result = await generator.generateFromBlob(blob, width || 256, height || 256, options);
      self.postMessage({ type: 'generate', id, result });
    } else if (type === 'analyze') {
      const result = await generator.analyzeModel(blob);
      self.postMessage({ type: 'analyze', id, result });
    }
  } catch (error) {
    self.postMessage({ type: 'error', id, error: error instanceof Error ? error.message : String(error) });
  }
};

