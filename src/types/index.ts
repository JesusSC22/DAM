export interface AssetMetadata {
  vertices: number;
  polygons: number;
  materialCount: number;
  createdDate: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string;
}

export interface Asset {
  id: string;
  name: string;
  description: string;
  categoryId: string; // Nuevo campo para vincular con categoría
  type: 'model' | 'texture' | 'scene';
  url: string;
  thumbnail: string;
  metadata: AssetMetadata;
  shape?: 'cube' | 'sphere' | 'torus'; 
  color?: string;
  unityPackageUrl?: string;
  fbxZipUrl?: string;
  doubleSide?: boolean;
  fileSize?: string;
  thumbnailBlob?: Blob;
  tags?: string[];
}
