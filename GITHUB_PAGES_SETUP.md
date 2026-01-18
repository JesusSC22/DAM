# 🚀 Configuración de GitHub Pages

## ✅ Cambios Realizados

Se han configurado automáticamente los siguientes archivos:

1. **`.github/workflows/deploy.yml`** - Workflow de GitHub Actions para deploy automático
2. **`vite.config.ts`** - Configurado con base path `/DAM/` para producción
3. **`src/App.tsx`** - Cambiado a `HashRouter` para compatibilidad con GitHub Pages
4. **`public/.nojekyll`** - Archivo para deshabilitar Jekyll en GitHub Pages
5. **`README.md`** - Actualizado con instrucciones de GitHub Pages

## 📋 Pasos Finales (Hacer en GitHub)

### 1. Habilitar GitHub Pages

1. Ve a tu repositorio: https://github.com/JesusSC22/DAM
2. Click en **Settings** (Configuración)
3. En el menú lateral, busca y click en **Pages**
4. En la sección **Source**, selecciona:
   - **Source**: `GitHub Actions`
5. Guarda los cambios

### 2. Verificar el Deploy

1. Ve a la pestaña **Actions** en tu repositorio
2. Verás un workflow llamado "Deploy to GitHub Pages" ejecutándose
3. Espera a que termine (puede tomar 2-5 minutos la primera vez)
4. Una vez completado, verás un check verde ✅

### 3. Acceder a tu Aplicación

Una vez que el workflow termine exitosamente, tu aplicación estará disponible en:

**https://jesussc22.github.io/DAM/**

> ⚠️ **Nota**: La URL puede tardar unos minutos en estar disponible después del primer deploy.

## 🔄 Deploy Automático

A partir de ahora, cada vez que hagas `git push` a la rama `main`, GitHub Actions:
1. Construirá automáticamente tu proyecto
2. Desplegará los archivos en GitHub Pages
3. Tu aplicación se actualizará automáticamente

## ⚠️ Limitaciones

### Backend no incluido
GitHub Pages solo puede servir archivos estáticos (HTML, CSS, JS). El servidor Express **NO** se desplegará en GitHub Pages.

**Opciones para el backend:**
- **Vercel**: https://vercel.com (gratis, fácil de usar)
- **Railway**: https://railway.app (gratis con límites)
- **Render**: https://render.com (gratis con límites)
- **Heroku**: https://www.heroku.com (puede requerir pago)

### Funcionalidad Limitada
Sin el backend, el frontend funcionará en modo "solo lectura":
- ✅ Puedes ver modelos 3D precargados
- ✅ Puedes navegar la interfaz
- ❌ No puedes subir nuevos modelos
- ❌ No puedes sincronizar con servidor

## 🛠️ Solución de Problemas

### El workflow falla
- Verifica que `package.json` tenga el script `build`
- Revisa los logs en la pestaña **Actions** para ver el error específico

### La página no carga
- Espera 2-5 minutos después del deploy
- Verifica que el workflow haya terminado exitosamente
- Limpia la caché del navegador (Ctrl+Shift+R)

### Rutas no funcionan
- El proyecto usa `HashRouter`, las rutas deberían funcionar automáticamente
- Si usas `BrowserRouter`, necesitarías un archivo `404.html` adicional

## 📝 Próximos Pasos

1. ✅ Habilitar GitHub Pages en Settings
2. ✅ Esperar el primer deploy
3. ✅ Verificar que la aplicación carga correctamente
4. (Opcional) Configurar un dominio personalizado en Settings → Pages

---

**¿Necesitas ayuda?** Revisa los logs en la pestaña **Actions** de tu repositorio.

