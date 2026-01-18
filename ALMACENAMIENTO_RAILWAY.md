# 💾 Almacenamiento en Railway

## 📊 Límites del Plan Gratuito

### **Plan Hobby (Gratuito):**
- **$5 USD de crédito mensual** (se renueva cada mes)
- **Almacenamiento:** ~500 MB - 1 GB (depende del uso)
- **Sin límite de ancho de banda** (pero consume créditos)
- **Sin límite de tiempo de ejecución**

### **Costos Aproximados:**
- **Almacenamiento:** ~$0.00025 por GB/hora
- **CPU/RAM:** Depende del uso
- **Tráfico:** Incluido en el crédito

---

## 🔍 Cómo Ver tu Uso de Almacenamiento

### **1. En el Dashboard de Railway:**

1. Ve a: https://railway.app
2. Inicia sesión con tu cuenta
3. Selecciona tu proyecto **"dam-production"** (o el nombre que le diste)
4. Click en el servicio (el que tiene el servidor)
5. Ve a la pestaña **"Metrics"** o **"Settings"**

### **2. Ver Uso de Créditos:**

1. En el dashboard principal
2. Click en tu **perfil** (arriba a la derecha)
3. Selecciona **"Usage"** o **"Billing"**
4. Verás:
   - Créditos usados este mes
   - Créditos restantes
   - Proyección de uso

### **3. Ver Tamaño de Archivos Subidos:**

**Opción A: Desde Railway CLI:**
```bash
# Instalar Railway CLI (si no lo tienes)
npm i -g @railway/cli

# Iniciar sesión
railway login

# Ver el tamaño del directorio uploads
railway run "du -sh uploads"
```

**Opción B: Desde el código del servidor:**
Puedes agregar un endpoint para ver el tamaño:
```javascript
// En server/index.js
app.get('/api/storage/info', (req, res) => {
  const uploadsPath = path.join(__dirname, 'uploads');
  // Calcular tamaño total
  // Retornar información
});
```

---

## 📏 Límites de Tamaño de Archivo

### **Límites Configurados en tu App:**

Según `src/config/constants.ts`:

- **GLB/GLTF:** 100 MB máximo
- **Unity Package:** 200 MB máximo
- **ZIP (FBX + texturas):** 200 MB máximo
- **Thumbnail/Imagen:** 10 MB máximo

### **Límites de Railway:**

- **Sin límite específico** de tamaño de archivo individual
- **Límite práctico:** Depende de tu crédito disponible
- **Recomendación:** Mantén modelos bajo 50-100 MB cada uno

---

## 💡 Cómo Calcular Cuánto Puedes Subir

### **Ejemplo de Cálculo:**

Si tienes **$5 de crédito mensual**:

1. **Almacenamiento:** 
   - 500 MB = ~$0.36/mes
   - 1 GB = ~$0.72/mes

2. **CPU/RAM:**
   - Depende del uso del servidor
   - ~$2-3/mes para un servidor básico

3. **Tráfico:**
   - Incluido en el crédito

**Total estimado:** Con $5/mes puedes tener:
- **~500 MB - 1 GB de almacenamiento**
- **Varios modelos pequeños-medianos**
- **~10-20 modelos de 50 MB cada uno**

---

## 🎯 Recomendaciones

### **Para Maximizar el Almacenamiento:**

1. **Comprime los modelos:**
   - Usa GLB comprimido (Draco)
   - Optimiza texturas
   - Reduce calidad si es necesario

2. **Elimina modelos antiguos:**
   - Borra modelos que ya no uses
   - Limpia archivos temporales

3. **Monitorea el uso:**
   - Revisa el dashboard semanalmente
   - Ajusta según el uso

4. **Considera actualizar el plan:**
   - Si necesitas más espacio
   - Plan Developer: $20/mes con más recursos

---

## 🔧 Verificar Uso Actual

### **Desde el Código (Agregar Endpoint):**

Puedo agregar un endpoint en el servidor para ver:
- Tamaño total de archivos subidos
- Número de modelos
- Espacio disponible estimado

¿Quieres que agregue este endpoint?

---

## 📊 Resumen

| Concepto | Valor |
|----------|-------|
| **Crédito mensual** | $5 USD |
| **Almacenamiento estimado** | 500 MB - 1 GB |
| **Límite por archivo (GLB)** | 100 MB |
| **Límite por archivo (Unity)** | 200 MB |
| **Límite por archivo (ZIP)** | 200 MB |
| **Modelos estimados** | 10-20 modelos medianos |

---

**¿Quieres que agregue un endpoint en el servidor para ver el uso de almacenamiento en tiempo real?**

