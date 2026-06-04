@echo off
setlocal

set CONTAINER_NAME=pm-app
set IMAGE_NAME=pm-app

cd /d "%~dp0.."

echo Building Docker image...
docker build -t %IMAGE_NAME% .

docker stop %CONTAINER_NAME% 2>nul
docker rm %CONTAINER_NAME% 2>nul

set ENV_FLAG=
if exist .env set ENV_FLAG=--env-file .env

echo Starting container...
docker run -d --name %CONTAINER_NAME% -p 8000:8000 %ENV_FLAG% %IMAGE_NAME%

echo App running at http://localhost:8000
