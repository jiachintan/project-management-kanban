@echo off

set CONTAINER_NAME=pm-app

docker stop %CONTAINER_NAME% 2>nul
docker rm %CONTAINER_NAME% 2>nul

echo Container stopped.
