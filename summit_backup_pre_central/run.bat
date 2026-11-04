@echo off
echo Abrindo Summit em http://localhost:8080
start http://localhost:8080
python -m http.server 8080
