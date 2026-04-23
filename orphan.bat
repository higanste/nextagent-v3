@echo off
del /f "Vercel" 2>nul
del /f "Vercel)" 2>nul
git checkout --orphan clean_main
git add -A
git commit -m "NextAgent v3 - clean build"
git branch -D main 2>nul
git branch -D fresh_main 2>nul
git branch -m main
echo ALL_DONE
