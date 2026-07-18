@echo off
REM launch-obs.bat
REM Lanza OBS Studio con los flags necesarios para que WebRTC funcione en Browser Source.
REM
REM Flags:
REM   --disable-web-security              Permite conexiones a IPs locales (necesario para WebRTC P2P)
REM   --allow-running-insecure-content    Permite contenido HTTP en paginas HTTPS
REM   --ignore-certificate-errors         Ignora certificados autofirmados
REM   --use-fake-ui-for-media-stream      Permite autoplay de video sin interaccion del usuario

set OBS_DIR=C:\Program Files\obs-studio\bin\64bit
set OBS_EXE=obs64.exe

if not exist "%OBS_DIR%\%OBS_EXE%" (
    echo.
    echo  No se encontro OBS Studio en la ruta por defecto.
    echo  Busca obs64.exe y edita este script con la ruta correcta.
    echo.
    pause
    exit /b 1
)

echo.
echo  Iniciando OBS Studio con flags para WebRTC...
echo.

cd /d "%OBS_DIR%"
start "" "%OBS_EXE%" --disable-web-security --allow-running-insecure-content --ignore-certificate-errors --use-fake-ui-for-media-stream
