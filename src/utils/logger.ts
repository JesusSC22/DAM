/**
 * Sistema de logging condicional
 * Solo muestra logs en desarrollo (NODE_ENV !== 'production')
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const isDevelopment = import.meta.env.DEV;
const isProduction = import.meta.env.PROD;

class Logger {
  private prefix: string;
  private enabled: boolean;

  constructor(prefix: string = '', enabled: boolean = true) {
    this.prefix = prefix ? `[${prefix}]` : '';
    this.enabled = enabled && (isDevelopment || !isProduction);
  }

  private formatMessage(level: LogLevel, message: string, ...args: any[]): string {
    const timestamp = new Date().toISOString();
    return `${this.prefix} [${level.toUpperCase()}] ${message}`;
  }

  debug(message: string, ...args: any[]): void {
    if (this.enabled) {
      console.debug(this.formatMessage('debug', message), ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.enabled) {
      console.info(this.formatMessage('info', message), ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    // Warnings siempre se muestran, incluso en producción
    console.warn(this.formatMessage('warn', message), ...args);
  }

  error(message: string, ...args: any[]): void {
    // Errors siempre se muestran, incluso en producción
    console.error(this.formatMessage('error', message), ...args);
  }
}

// Factory para crear loggers con prefijos
export const createLogger = (prefix: string) => new Logger(prefix);

// Loggers predefinidos
export const logger = {
  db: createLogger('db'),
  model3d: createLogger('Model3D'),
  uploadedModel: createLogger('UploadedModel'),
  assetDetail: createLogger('AssetDetail'),
  thumbnailWorker: createLogger('ThumbnailWorker'),
  assetContext: createLogger('AssetContext'),
  default: new Logger(),
};

export default logger;




