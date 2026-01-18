@echo off
echo Iniciando Servidor Backend...
start "Servidor DAM" cmd /k "cd server && npm start"

echo Iniciando Aplicacion Web...
start "Web DAM" cmd /k "npm run dev"

echo Esperando a que arranquen los servicios...
timeout /t 3

echo Abriendo navegador...
start http://localhost:5173

echo Todo listo! Puedes minimizar las ventanas negras, pero no las cierres.
echo Nota: El servidor sincroniza datos entre Chrome, Cursor y otras ventanas.
