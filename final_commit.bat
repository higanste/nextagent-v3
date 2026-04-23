@echo off
del /f orphan.bat 2>nul
git add package.json tsconfig.json package-lock.json
git add -A
git commit -m "Add missing config files"
echo COMMIT_DONE
