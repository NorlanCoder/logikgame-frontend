# LOGIK GAME — Frontend

Interface web pour un jeu télévisé de quiz en temps réel (admin, joueurs, projection).

**Stack :** Next.js · TypeScript · Zustand · Laravel Echo / Reverb · Tailwind CSS · shadcn/ui

---

## Prérequis

- Node.js 18+
- Le backend Laravel doit être lancé (`php artisan serve`, `reverb:start`, `queue:work`)

---

## Installation

```bash
git clone https://github.com/NorlanCoder/logikgame-frontend.git
cd logikgame-frontend

npm install

cp .env.local.example .env.local
```

---

## Configuration (.env.local)

```env
# URL de l'API backend
NEXT_PUBLIC_API_URL=http://localhost:8000/api

# Laravel Reverb (WebSocket)
NEXT_PUBLIC_REVERB_APP_KEY=votre_app_key
NEXT_PUBLIC_REVERB_HOST=localhost
NEXT_PUBLIC_REVERB_PORT=8080
NEXT_PUBLIC_REVERB_SCHEME=http
```

> La `REVERB_APP_KEY` doit correspondre à celle configurée dans le `.env` du backend.

---

## Lancer le projet

```bash
npm run dev
```

Le frontend est accessible sur [http://localhost:3000](http://localhost:3000).

---

## Interfaces disponibles

| URL | Rôle |
|-----|------|
| `/admin` | Panneau d'administration (connexion requise) |
| `/join?token=xxx` | Accès joueur via lien email |
| `/projection` | Vue projection pour diffusion |
| `/preselection` | Page de préselection publique |

---

## Build production

```bash
npm run build
npm start
```
