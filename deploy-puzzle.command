#!/bin/bash
cd /Users/andythomason/Desktop/doppel
echo "Deploying puzzle changes..."
git add puzzle.json
git commit -m "Update puzzle schedule"
git push origin main
echo ""
echo "✓ Done! Vercel will deploy in about 30 seconds."
echo "Press Enter to close."
read
