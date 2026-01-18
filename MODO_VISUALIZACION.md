# 📱 Modo Visualización en GitHub Pages

## 🔍 ¿Qué significa "Modo Visualización"?

Cuando el frontend se despliega en **GitHub Pages**, funciona en **modo visualización** porque:

### ❌ Limitaciones de GitHub Pages

1. **Solo archivos estáticos**: GitHub Pages solo puede servir HTML, CSS y JavaScript. No puede ejecutar servidores Node.js/Express.

2. **Sin backend**: Tu servidor Express (que maneja subida de archivos, base de datos, etc.) **NO** se despliega en GitHub Pages.

3. **Sin almacenamiento persistente**: No hay base de datos del servidor disponible.

## ✅ ¿Qué SÍ funciona?

### 1. **Visualización de Assets Existentes**
- Si ya tienes modelos 3D guardados en **IndexedDB** (almacenamiento local del navegador), podrás verlos
- El visor 3D funciona completamente
- Puedes rotar, hacer zoom, cambiar fondos, materiales, etc.

### 2. **Interfaz Completa**
- Navegación entre páginas
- Filtros y búsqueda (sobre datos locales)
- Modo oscuro/claro
- Todas las funciones de visualización

### 3. **IndexedDB Local**
- La app usa IndexedDB como cache local
- Los datos persisten en el navegador del usuario
- Si alguien visitó tu app antes y tiene datos, los verá

## ❌ ¿Qué NO funciona?

### 1. **Subir Nuevos Archivos**
```
❌ No puedes subir nuevos modelos GLB/GLTF
❌ No puedes subir thumbnails
❌ No puedes subir paquetes Unity o ZIP
```

**Razón**: Requiere el servidor Express para recibir y almacenar archivos.

### 2. **Sincronización con Servidor**
```
❌ No se sincroniza con el servidor
❌ No se descargan assets desde el servidor
❌ No se comparten cambios entre usuarios
```

**Razón**: `SERVER_URL` está vacío o apunta a localhost (que no existe en GitHub Pages).

### 3. **Editar/Eliminar Assets**
```
❌ No puedes eliminar assets
❌ No puedes editar metadatos (nombre, descripción, tags)
❌ No puedes cambiar categorías
```

**Razón**: Todas estas operaciones requieren el servidor Express.

## 🎯 Escenarios de Uso

### Escenario 1: Primera Visita (IndexedDB Vacío)
```
Usuario visita: https://jesussc22.github.io/DAM/
Resultado: 
  - La app carga correctamente
  - Intenta sincronizar con servidor → Falla silenciosamente
  - Muestra: "No assets found"
  - No puede subir archivos (botón deshabilitado o error)
```

### Escenario 2: Usuario con Datos Previos
```
Usuario que ya usó la app localmente:
  - Tiene assets en su IndexedDB
  - Puede ver todos sus modelos
  - Puede visualizarlos en 3D
  - NO puede agregar/editar/eliminar
```

### Escenario 3: Demo con Assets Precargados
```
Si incluyes assets de ejemplo en el build:
  - Los usuarios verán modelos de demostración
  - Podrán explorar la interfaz
  - Verán cómo funciona el visor 3D
```

## 🔧 Cómo Mejorar la Experiencia

### Opción 1: Assets de Ejemplo Precargados
Incluir algunos modelos 3D de ejemplo en el build para que los visitantes vean algo:

```typescript
// En el build, incluir assets de ejemplo
const exampleAssets = [
  {
    id: 'example-1',
    name: 'Modelo de Ejemplo',
    url: '/examples/modelo.glb',
    // ...
  }
];
```

### Opción 2: Mensaje Informativo
Mostrar un mensaje cuando el servidor no está disponible:

```typescript
if (!SERVER_URL || SERVER_URL === 'http://localhost:3001') {
  // Mostrar banner: "Modo Demo - Funcionalidad limitada"
}
```

### Opción 3: Desplegar Backend Separado
Desplegar el servidor Express en otro servicio:
- **Vercel** (Serverless Functions)
- **Railway** (Node.js apps)
- **Render** (Web Services)
- **Heroku** (Platform as a Service)

Luego configurar `VITE_SERVER_URL` en el build para apuntar a ese backend.

## 📊 Resumen Visual

```
┌─────────────────────────────────────────┐
│     GitHub Pages (Frontend)             │
│  ✅ Interfaz React                     │
│  ✅ Visor 3D (Three.js)                 │
│  ✅ IndexedDB (Cache Local)             │
│  ❌ Servidor Express                    │
│  ❌ Base de Datos                       │
│  ❌ Almacenamiento de Archivos          │
└─────────────────────────────────────────┘
         │
         │ (Intenta conectar)
         ▼
┌─────────────────────────────────────────┐
│     Servidor Express                    │
│  ❌ NO DISPONIBLE                       │
│  (No se puede desplegar en GitHub Pages)│
└─────────────────────────────────────────┘
```

## 🚀 Solución Completa

Para tener funcionalidad completa, necesitas:

1. **Frontend en GitHub Pages** ✅ (Ya configurado)
2. **Backend en otro servicio** (Vercel, Railway, etc.)
3. **Configurar `VITE_SERVER_URL`** en el build para apuntar al backend

¿Quieres que te ayude a configurar el backend en otro servicio?

