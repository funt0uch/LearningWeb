# LearningWeb Frontend

Next.js App Router frontend for LearningWeb.

## Development

```powershell
cd E:\LearningWeb\learning-web
$env:NEXT_PUBLIC_API_BASE="http://127.0.0.1:8000"
npm.cmd run dev:local
```

Open http://127.0.0.1:3000/login.

## Scripts

- `npm.cmd run dev:local`：start local dev server on `127.0.0.1:3000`.
- `npm.cmd run lint`：lint source files and `next.config.ts`.
- `npm.cmd run build`：production build.

## Environment

Create `.env.local` when needed:

```env
NEXT_PUBLIC_API_BASE=http://127.0.0.1:8000
```

Do not put backend API keys in frontend env files. LLM keys belong to the FastAPI process.
