# CAD Area Extractor

Upload an AutoCAD .dwg and get every room's length, breadth and area, grouped by floor.

## First-time setup (Windows, VS Code terminal)

Open this folder in VS Code, then open two terminals.

Terminal 1 (backend):
    cd backend
    npm install
    npm run dev

Terminal 2 (frontend):
    cd frontend
    npm install
    npm run dev

Open http://localhost:3000 and upload your .dwg file.

Requires Node 22 or newer.
Settings: backend/.env (PORT, CLIENT_URL, MAX_UPLOAD_MB), frontend/.env.local (NEXT_PUBLIC_API_BASE_URL).
# Room-area-extraction-cad
