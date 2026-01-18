# 🎨 DAM - Digital Asset Management para Modelos 3D

Sistema de gestión de activos digitales (DAM) especializado en modelos 3D, con visor integrado, sincronización servidor-cliente y almacenamiento local.

## ✨ Características

- 📦 **Gestión de Assets 3D**: Sube, organiza y gestiona modelos GLB/GLTF
- 🎯 **Visor 3D Avanzado**: Visualización interactiva con Three.js
- 🔄 **Sincronización Bidireccional**: Sincronización automática entre cliente y servidor
- 💾 **Almacenamiento Local**: Cache en IndexedDB para funcionamiento offline
- 🏷️ **Organización**: Categorías, tags y filtros avanzados
- 🎨 **Personalización**: Fondos HDRI, materiales editables
- 🌙 **Modo Oscuro**: Interfaz con soporte para tema oscuro
- 📱 **Responsive**: Diseño adaptable a diferentes tamaños de pantalla

## 🚀 Inicio Rápido

### Prerrequisitos

- Node.js 18+ y npm
- Navegador moderno con soporte WebGL

### Instalación

1. **Clonar el repositorio**
   ```bash
   git clone <url-del-repositorio>
   cd DAM
   ```

2. **Instalar dependencias**
   ```bash
   # Instalar dependencias del frontend
   npm install
   
   # Instalar dependencias del servidor
   cd server
   npm install
   cd ..
   ```

3. **Configurar variables de entorno**
   
   Crea un archivo `.env` en la raíz del proyecto:
   ```env
   VITE_SERVER_URL=http://localhost:3001
   PORT=3001
   ```
   
   Ver [VARIABLES_ENTORNO.md](./VARIABLES_ENTORNO.md) para más detalles.

4. **Iniciar el proyecto**
   
   **Opción 1: Scripts batch (Windows)**
   ```bash
   # Iniciar servidor y frontend
   iniciar_dam.bat
   
   # Detener servicios
   parar_dam.bat
   ```
   
   **Opción 2: Manual**
   ```bash
   # Terminal 1: Servidor backend
   cd server
   npm start
   
   # Terminal 2: Frontend
   npm run dev
   ```

5. **Abrir en el navegador**

   Abre [http://localhost:5173](http://localhost:5173) (o el puerto que Vite asigne)

## 🌐 GitHub Pages (Demo Online)

El proyecto está configurado para desplegarse automáticamente en GitHub Pages.

### Ver el Demo

Una vez configurado GitHub Pages, puedes ver la aplicación en:
**https://jesussc22.github.io/DAM/**

### Configuración Automática

El proyecto incluye un workflow de GitHub Actions que:
- ✅ Construye automáticamente el proyecto cuando haces push a `main`
- ✅ Despliega el frontend en GitHub Pages
- ✅ Se ejecuta en cada commit a la rama principal

### Habilitar GitHub Pages

1. Ve a **Settings** → **Pages** en tu repositorio de GitHub
2. En **Source**, selecciona **GitHub Actions**
3. El workflow se ejecutará automáticamente en cada push a `main`

### Nota Importante

⚠️ **El backend (servidor Express) no está incluido en GitHub Pages**. GitHub Pages solo puede servir archivos estáticos. Para una demo completa con funcionalidad de subida de archivos, necesitarías desplegar el servidor en otro servicio como:
- [Vercel](https://vercel.com)
- [Railway](https://railway.app)
- [Render](https://render.com)
- [Heroku](https://www.heroku.com)

El frontend en GitHub Pages funcionará en modo visualización (puedes ver modelos si están precargados en IndexedDB).

## 📁 Estructura del Proyecto

```
DAM/
├── src/                    # Código fuente del frontend
│   ├── components/         # Componentes React
│   ├── pages/             # Páginas/rutas
│   ├── services/          # Servicios (DB, sincronización)
│   ├── store/             # Estado global (Zustand)
│   ├── context/           # Contextos React
│   ├── types/             # Tipos TypeScript
│   ├── utils/             # Utilidades
│   └── workers/           # Web Workers
├── server/                # Servidor Express
│   ├── index.js           # Servidor principal
│   ├── db.json            # Base de datos JSON
│   ├── uploads/           # Archivos subidos
│   └── fileValidation.js  # Validación de archivos
├── public/                # Archivos estáticos
│   └── draco/             # Decodificadores Draco
└── package.json           # Dependencias del frontend
```

## 🛠️ Tecnologías

### Frontend
- **React 18** - Framework UI
- **TypeScript** - Tipado estático
- **Three.js + React Three Fiber** - Renderizado 3D
- **Zustand** - Gestión de estado
- **Dexie** - IndexedDB wrapper
- **React Router** - Navegación
- **Tailwind CSS** - Estilos
- **Vite** - Build tool

### Backend
- **Express** - Servidor HTTP
- **Multer** - Manejo de archivos
- **JSON** - Base de datos (archivo)

## 📖 Uso

### Subir un Modelo

1. Click en "Subir Modelo" en el header
2. Selecciona un archivo GLB/GLTF
3. Completa la información (nombre, descripción, categoría, tags)
4. Opcionalmente sube thumbnail, Unity package o ZIP
5. Click en "Subir"

### Visualizar un Modelo

1. Click en cualquier card de la galería
2. Usa los controles del visor:
   - **Rotar**: Click y arrastrar
   - **Zoom**: Rueda del mouse
   - **Pan**: Click derecho + arrastrar (si está habilitado)

### Configurar el Visor

- **Fondo**: Click en el icono de configuración → Selecciona tipo (sólido, degradado, HDRI)
- **Materiales**: Click en el icono de paquete → Ver y editar materiales
- **Doble cara**: Click en el icono de flip → Activa/desactiva renderizado doble cara

### Filtrar Assets

- **Búsqueda**: Escribe en el campo de búsqueda del header
- **Categoría**: Selecciona en el sidebar
- **Tags**: Selecciona múltiples tags en el sidebar
- **Polígonos**: Usa el slider de rango en el sidebar
- **Fecha**: Selecciona rango de fechas en el sidebar

## 🔧 Configuración

### Variables de Entorno

Ver [VARIABLES_ENTORNO.md](./VARIABLES_ENTORNO.md) para configuración detallada.

### Límites de Archivos

Los límites por defecto son:
- GLB: 100 MB
- Unity Package: 200 MB
- ZIP: 200 MB
- Thumbnail: 10 MB

Puedes modificarlos en `src/config/constants.ts` y `server/index.js`.

## 🏗️ Desarrollo

### Scripts Disponibles

```bash
# Desarrollo
npm run dev          # Inicia servidor de desarrollo

# Producción
npm run build        # Construye para producción
npm run preview      # Preview de build de producción

# Linting
npm run lint         # Ejecuta ESLint
```

### Estructura de Datos

#### Asset
```typescript
interface Asset {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  type: 'model' | 'texture' | 'scene';
  url: string;              // Ruta al archivo GLB
  thumbnail: string;         // Ruta al thumbnail
  metadata: {
    vertices: number;
    polygons: number;
    materialCount: number;
    createdDate: string;
  };
  tags?: string[];
  unityPackageUrl?: string;
  fbxZipUrl?: string;
}
```

## 🔄 Sincronización

El sistema usa una arquitectura de sincronización donde:

- **Servidor Express** es la fuente única de verdad
- **IndexedDB** es un cache local para performance y funcionamiento offline
- La sincronización ocurre:
  - Al iniciar la aplicación
  - Cada 30 segundos automáticamente
  - Cuando la ventana recupera el foco
  - Después de crear/actualizar/eliminar assets

## 🐛 Solución de Problemas

### El modelo no carga

1. Verifica que el archivo GLB sea válido
2. Revisa la consola del navegador para errores
3. Verifica que los decodificadores Draco estén en `/public/draco/`

### Error de sincronización

1. Verifica que el servidor esté corriendo
2. Verifica `VITE_SERVER_URL` en `.env`
3. Revisa los logs del servidor

### Problemas de memoria

1. Limpia el cache de IndexedDB desde la página de gestión de base de datos
2. Reduce el número de assets cargados simultáneamente

## 📝 Notas

- Los archivos se almacenan en `server/uploads/`
- La base de datos del servidor está en `server/db.json`
- Los thumbnails se generan automáticamente si no se proporciona uno
- Los modelos se comprimen con Draco si está disponible

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo [LICENSE](LICENSE) para más detalles.

## 🙏 Agradecimientos

- [Three.js](https://threejs.org/) - Librería 3D
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber/) - React renderer para Three.js
- [Draco](https://google.github.io/draco/) - Compresión de geometría

## 📚 Recursos

- [Documentación de Three.js](https://threejs.org/docs/)
- [React Three Fiber Docs](https://docs.pmnd.rs/react-three-fiber/)
- [Vite Documentation](https://vitejs.dev/)
- [Zustand Documentation](https://github.com/pmndrs/zustand)

---

**Versión**: 0.0.0  
**Última actualización**: 2024

