@echo off
REM Chrome with insecure origins flag for WebXR testing

"C:\Program Files\Google\Chrome\Application\chrome.exe" --unsafely-treat-insecure-origin-as-secure="http://172.31.51.96:3000" --user-data-dir=%TEMP%\chrome-unsafe-test

REM Alternative Chrome paths if above doesn't work:
REM "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --unsafely-treat-insecure-origin-as-secure="http://172.31.51.96:3000" --user-data-dir=%TEMP%\chrome-unsafe-test
