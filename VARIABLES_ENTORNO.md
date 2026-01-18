# Variables de Entorno - DAM 3D

Este proyecto usa variables de entorno para configurar URLs y puertos. Esto permite cambiar la configuración sin modificar el código.

## 📋 Configuración

### Crear archivo `.env`

Crea un archivo `.env` en la raíz del proyecto con el siguiente contenido:

```env
# URL del servidor Express (backend)
# En desarrollo: http://localhost:3001
# En producción: cambiar a la URL del servidor desplegado
VITE_SERVER_URL=http://localhost:3001

# Puerto del servidor Express
# Si cambias esto, también debes cambiar VITE_SERVER_URL
PORT=3001
```

### Variables Disponibles

#### `VITE_SERVER_URL` (Frontend)
- **Descripción**: URL del servidor Express para sincronización
- **Valor por defecto**: `http://localhost:3001`
- **Usado en**: `src/config/constants.ts`, `vite.config.ts`
- **Nota**: Vite requiere el prefijo `VITE_` para exponer variables al cliente

#### `PORT` (Backend)
- **Descripción**: Puerto en el que escucha el servidor Express
- **Valor por defecto**: `3001`
- **Usado en**: `server/index.js`

## 🔧 Uso

### Desarrollo Local

1. Crea el archivo `.env` en la raíz del proyecto
2. Agrega las variables (puedes usar los valores por defecto)
3. Reinicia el servidor de desarrollo si está corriendo

```bash
# El archivo .env ya está configurado para desarrollo local
# No necesitas cambiar nada a menos que uses puertos diferentes
```

### Producción

1. Crea el archivo `.env` en el servidor
2. Configura las variables con los valores de producción:

```env
VITE_SERVER_URL=https://tu-servidor.com
PORT=3001
```

3. Reconstruye la aplicación:

```bash
npm run build
```

## 📝 Notas Importantes

### Prefijo `VITE_`

- Solo las variables que empiezan con `VITE_` están disponibles en el código del cliente
- Esto es una medida de seguridad de Vite
- Las variables sin `VITE_` solo están disponibles en `vite.config.ts` y en el servidor

### Archivo `.env.example`

El archivo `.gitignore` ya excluye `.env` para evitar subir información sensible al repositorio.

**IMPORTANTE**: Nunca subas el archivo `.env` con valores reales al repositorio.

### Orden de Prioridad

1. Variables de entorno (`.env`)
2. Valores por defecto en el código

Si una variable no está definida, se usa el valor por defecto.

## 🚀 Ejemplos

### Cambiar el Puerto del Servidor

```env
PORT=8080
VITE_SERVER_URL=http://localhost:8080
```

### Configurar para Producción

```env
VITE_SERVER_URL=https://api.tu-dominio.com
PORT=3001
```

### Configurar con Subdirectorio

```env
VITE_SERVER_URL=https://tu-dominio.com/api
PORT=3001
```

## ✅ Verificación

Para verificar que las variables se están usando correctamente:

1. Revisa los logs del servidor al iniciar:
   ```
   Server running on http://localhost:3001
   ```

2. Revisa la consola del navegador (solo en desarrollo):
   ```javascript
   console.log(import.meta.env.VITE_SERVER_URL);
   ```

## 📚 Referencias

- [Vite - Variables de Entorno](https://vitejs.dev/guide/env-and-mode.html)
- [Node.js - process.env](https://nodejs.org/api/process.html#process_process_env)




