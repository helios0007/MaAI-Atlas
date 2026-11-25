@echo off
rem Double-click this file to present. It starts a local server and opens the deck,
rem so slides 8 and 10 show the live Atlas (the 2D to 3D change runs for real).
rem Keep this window open while you present. Close it when you finish.
cd /d "%~dp0.."
start "" "http://localhost:8000/PRESENTATIONS/story.html"
python -m http.server 8000 --bind 127.0.0.1
