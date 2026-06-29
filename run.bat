@echo off
echo =================================================================
echo             GARUDA NDPS MONITORING SYSTEM STACK STARTUP
echo =================================================================
echo.

echo [+] Launching FastAPI Microservice (Port 8082)...
start "Garuda - FastAPI Microservice" cmd /k "cd microservices\intelligence_service && .venv\Scripts\python main.py"

echo [+] Launching Express Backend (Port 8081)...
start "Garuda - Express Backend" cmd /k "cd backend && npm run dev"

echo [+] Launching React Frontend (Port 3000)...
start "Garuda - React Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo =================================================================
echo All components started in separate command windows.
echo - Microservice: http://127.0.0.1:8082
echo - Express Backend: http://localhost:8081
echo - React Frontend: http://localhost:3000
echo =================================================================
pause
