import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Obtener URL del servidor desde variables de entorno
// En Vite, las variables de entorno deben tener prefijo VITE_ para estar disponibles en el cliente
const SERVER_URL = process.env.VITE_SERVER_URL || 'http://localhost:3001';

/**
 * Genera CSP (Content Security Policy) para desarrollo
 * 
 * Vite en desarrollo necesita unsafe-inline/unsafe-eval para HMR (Hot Module Replacement)
 * La CSP de producción se configura en index.html para ser más estricta
 */
const getDevelopmentCSP = (): string => {
  // En desarrollo: Vite necesita unsafe-inline/unsafe-eval para HMR
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // HMR necesita unsafe-eval
    "worker-src 'self' blob:",
    "connect-src 'self' blob: http://localhost:* https: ws: wss:", // WebSockets para HMR
    "img-src 'self' blob: data:",
    "media-src 'self' blob:",
    "style-src 'self' 'unsafe-inline'", // Tailwind y HMR
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'"
  ].join('; ');
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Plugin para configurar CSP headers (diferente para dev/prod)
    {
      name: 'configure-csp',
      configureServer(server) {
        server.middlewares.use((_req, res, next) => {
          // En desarrollo, sobrescribir CSP del HTML con una más permisiva para HMR
          // Headers HTTP tienen prioridad sobre meta tags
          // Vite necesita unsafe-inline/unsafe-eval para Hot Module Replacement
          const csp = getDevelopmentCSP();
          res.setHeader('Content-Security-Policy', csp);
          next();
        });
      }
    }
  ],
  server: {
    // Proxy para el servidor Express (sincronización entre navegadores/ventanas)
    // Usa la misma URL que se configura en las variables de entorno
    proxy: {
      '/api': {
        target: SERVER_URL,
        changeOrigin: true,
      },
      '/uploads': {
        target: SERVER_URL,
        changeOrigin: true,
      }
    }
  }
})

