import { logger } from '../utils/logger';

export interface ModelAnalysis {
  vertices: number;
  polygons: number;
  materialCount: number;
}

export class ThumbnailGenerator {
  private worker: Worker;
  private pendingRequests: Map<string, { resolve: (val: any) => void, reject: (err: any) => void }>;

  constructor() {
    this.worker = new Worker(new URL('../workers/thumbnail.worker.ts', import.meta.url), { type: 'module' });
    this.pendingRequests = new Map();

    this.worker.onmessage = (e) => {
      const { id, result, error } = e.data;
      const request = this.pendingRequests.get(id);
      
      if (request) {
        if (error) {
          logger.thumbnailWorker.error('Worker returned error:', error);
          request.reject(new Error(error));
        } else {
          request.resolve(result);
        }
        this.pendingRequests.delete(id);
      }
    };

    this.worker.onerror = (error) => {
      logger.thumbnailWorker.error('Worker error:', error);
    };
  }

  private request<T>(type: 'generate' | 'analyze', payload: any): Promise<T> {
    const id = Math.random().toString(36).substr(2, 9);
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.worker.postMessage({ type, id, ...payload });
    });
  }

  async generateFromBlob(blob: Blob, options?: { doubleSide?: boolean }): Promise<Blob | null> {
    return this.request<Blob | null>('generate', { blob, options });
  }

  async analyzeModel(blob: Blob): Promise<ModelAnalysis | null> {
    return this.request<ModelAnalysis | null>('analyze', { blob });
  }

  dispose() {
    this.worker.terminate();
    this.pendingRequests.forEach((req) => req.reject(new Error('ThumbnailGenerator disposed')));
    this.pendingRequests.clear();
  }
}

export const thumbnailGenerator = new ThumbnailGenerator();
