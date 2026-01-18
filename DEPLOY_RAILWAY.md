# 🚂 Desplegar en Railway (GRATIS)

## 📋 Pasos para Desplegar tu Backend en Railway

### **Paso 1: Crear Cuenta en Railway**

1. Ve a https://railway.app
2. Click en **"Start a New Project"**
3. Selecciona **"Login with GitHub"**
4. Autoriza Railway a acceder a tu GitHub

### **Paso 2: Crear un Nuevo Proyecto**

1. En Railway, click en **"New Project"**
2. Selecciona **"Deploy from GitHub repo"**
3. Elige tu repositorio: **JesusSC22/DAM**

### **Paso 3: Configurar el Servicio**

Railway detectará automáticamente que es un proyecto Node.js, pero necesitas configurarlo:

1. **Selecciona el servicio** que Railway creó
2. Ve a la pestaña **"Settings"**
3. En **"Root Directory"**, escribe: `server`
4. En **"Start Command"**, escribe: `npm start`

### **Paso 4: Configurar Variables de Entorno**

1. En la pestaña **"Variables"**, Railway ya habrá configurado `PORT` automáticamente
2. No necesitas configurar nada más (el servidor usa valores por defecto)

### **Paso 5: Obtener la URL del Servidor**

1. Ve a la pestaña **"Settings"**
2. En **"Domains"**, Railway te dará una URL como: `https://tu-proyecto.up.railway.app`
3. **Copia esta URL** - la necesitarás para el frontend

### **Paso 6: Actualizar el Frontend**

Una vez que tengas la URL de Railway, necesitas actualizar el build del frontend:

1. Ve a tu repositorio en GitHub
2. Ve a **Settings** → **Secrets and variables** → **Actions**
3. Agrega un nuevo secreto:
   - **Name:** `VITE_SERVER_URL`
   - **Value:** `https://tu-proyecto.up.railway.app` (la URL que copiaste)

### **Paso 7: Actualizar el Workflow de GitHub Actions**

Actualiza `.github/workflows/deploy.yml` para usar la variable de entorno:

```yaml
- name: Build
  run: npm run build:ci
  env:
    NODE_ENV: production
    VITE_SERVER_URL: ${{ secrets.VITE_SERVER_URL }}
```

### **Paso 8: Verificar que Funciona**

1. Railway desplegará automáticamente tu servidor
2. Ve a la URL de Railway y prueba: `https://tu-proyecto.up.railway.app/api/assets`
3. Deberías ver `[]` (array vacío) o los assets si hay alguno

---

## ✅ **Ventajas de Railway**

- ✅ **$5 gratis al mes** - Suficiente para proyectos pequeños/medianos
- ✅ **Almacenamiento persistente** - Los archivos se guardan permanentemente
- ✅ **No se duerme** - Siempre disponible
- ✅ **Auto-deploy** - Se actualiza automáticamente cuando haces push a GitHub
- ✅ **SSL automático** - HTTPS incluido
- ✅ **Fácil de usar** - Interfaz simple

---

## 🔧 **Configuración Adicional (Opcional)**

### **Agregar Dominio Personalizado**

1. En Railway, ve a **Settings** → **Domains**
2. Click en **"Custom Domain"**
3. Sigue las instrucciones para configurar tu dominio

### **Ver Logs**

1. En Railway, ve a la pestaña **"Deployments"**
2. Click en cualquier deployment para ver los logs
3. Útil para debuggear problemas

### **Monitoreo de Uso**

1. En Railway, ve a **Settings** → **Usage**
2. Verás cuánto crédito has usado
3. Te avisará cuando te acerques al límite

---

## 🎯 **Resultado Final**

Una vez configurado:

- ✅ **Backend:** `https://tu-proyecto.up.railway.app`
- ✅ **Frontend:** `https://jesussc22.github.io/DAM/`
- ✅ **Funcionalidad completa:** Subir, editar, eliminar modelos
- ✅ **Todo gratis** 🎉

---

## 🆘 **Solución de Problemas**

### **El servidor no inicia**
- Verifica que `Root Directory` esté configurado como `server`
- Verifica que `Start Command` sea `npm start`
- Revisa los logs en Railway

### **Los archivos no se guardan**
- Railway tiene almacenamiento persistente, pero verifica que la carpeta `uploads` exista
- El código ya crea la carpeta automáticamente si no existe

### **CORS errors**
- El servidor ya tiene CORS configurado
- Verifica que la URL en `VITE_SERVER_URL` sea correcta

---

¿Necesitas ayuda con algún paso? ¡Dime y te ayudo! 🚀

