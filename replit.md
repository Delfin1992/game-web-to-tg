# CyberProtocol: Tech Empire Game

## Overview

CyberProtocol is a cyberpunk-themed tech career simulation game built as a web application. Players register as operatives in one of four global tech hubs (San Francisco, Singapore, Saint Petersburg, Seoul), develop technical skills, work jobs, complete education courses, manage companies, and build their tech empire. The game features a rich progression system with levels, reputation, skills, banking, inventory management, and company ownership mechanics.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite with custom plugins for Replit integration
- **Styling**: Tailwind CSS v4 with custom cyberpunk theme (neon cyan/pink color scheme, Orbitron/Rajdhani fonts)
- **UI Components**: shadcn/ui component library (New York style) with Radix UI primitives
- **State Management**: React useState hooks with prop drilling; TanStack Query for server state
- **Animations**: Framer Motion for page transitions and UI effects
- **Routing**: Single-page app with component-based screen switching (no router library)

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ESM modules
- **API Pattern**: RESTful API with `/api` prefix (routes currently minimal/scaffolded)
- **Development**: tsx for TypeScript execution, Vite dev server with HMR
- **Build**: Custom esbuild script bundling server with selective dependency bundling

### Data Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema**: Defined in `shared/schema.ts` with Zod validation via drizzle-zod
- **Migrations**: Drizzle Kit with `db:push` command
- **Current Storage**: MemStorage class (in-memory) as placeholder until database provisioned

### Project Structure
```
├── client/           # React frontend
│   ├── src/
│   │   ├── components/ui/  # shadcn/ui components
│   │   ├── pages/          # Screen components (Game, Jobs, Shop, Bank, etc.)
│   │   ├── hooks/          # Custom React hooks
│   │   └── lib/            # Utilities and query client
├── server/           # Express backend
│   ├── routes.ts     # API route definitions
│   ├── storage.ts    # Data storage interface
│   └── vite.ts       # Vite dev server integration
├── shared/           # Shared types and schema
│   └── schema.ts     # Drizzle database schema
└── attached_assets/  # Reference Python code for game mechanics
```

### Key Design Decisions

1. **Monorepo Structure**: Client and server in single repo with shared types for type safety across the stack.

2. **Cyberpunk Theme System**: Custom Tailwind theme with CSS variables for consistent neon aesthetic throughout the application.

3. **Component-Based Navigation**: Game uses component state to switch between screens (Jobs, Shop, Bank, Education, Company, Inventory) rather than URL routing.

4. **Reference Implementation**: Python files in `attached_assets/` contain game logic from a Telegram bot version that serves as specification for web implementation (jobs, items, companies, banking, hackathons).

5. **Multi-City Economy**: Each city has its own currency, jobs, and cultural flavor (USD/SGD/RUB/KRW).

## External Dependencies

### Database
- **PostgreSQL**: Primary database (requires DATABASE_URL environment variable)
- **Drizzle ORM**: Database operations and schema management
- **connect-pg-simple**: PostgreSQL session storage (available but not yet implemented)

### Frontend Libraries
- **@tanstack/react-query**: Server state management and caching
- **framer-motion**: Animation library for UI transitions
- **lucide-react**: Icon library
- **date-fns**: Date formatting utilities

### Development Tools
- **Vite**: Frontend build tool with React plugin
- **@tailwindcss/vite**: Tailwind CSS integration
- **@replit/vite-plugin-***: Replit-specific dev plugins (error overlay, cartographer, dev banner)

### Build Dependencies
- **esbuild**: Server bundling for production
- **tsx**: TypeScript execution for development

## Telegram Bot / Mini App Run Guide

1. Создай бота через **@BotFather** и получи `TELEGRAM_BOT_TOKEN`.
2. Подними проект локально:
   - `npm install`
   - `cp .env.example .env`
   - заполни `TELEGRAM_BOT_TOKEN`
3. Для Telegram WebApp нужен **публичный HTTPS URL** (например, через ngrok/cloudflared) и выставленный `TELEGRAM_WEBAPP_URL`.
4. Запусти сервер:
   - `npm run dev`
5. Открой чат с ботом и отправь `/start`.
   - Бот вернёт кнопку **"🚀 Открыть игру"** (web_app), которая открывает Mini App.

### Важные переменные окружения
- `TELEGRAM_BOT_TOKEN` — обязателен для запуска polling-бота.
- `TELEGRAM_WEBAPP_URL` — URL, который бот отправляет в `web_app` кнопке.
- `APP_URL` — fallback, если `TELEGRAM_WEBAPP_URL` не задан.

### Почему бот "не запускается"
- Если `TELEGRAM_BOT_TOKEN` не указан, сервер логирует: `TELEGRAM_BOT_TOKEN не задан — Telegram бот не запущен`.
- Если URL не публичный/не HTTPS, Telegram Mini App из кнопки не откроется корректно.
