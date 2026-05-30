# AGENTS.md — Date Tracker

## Commands

| Command | Description |
|---|---|
| `npm run build` | Build to `dist/main.js` via esbuild |
| `npm run dev` | Watch mode build |
| `npm run test` | Jest tests (`jest --passWithNoTests`) |
| `npm run test:coverage` | Jest with coverage |
| `npm run typecheck` | `tsc --noEmit` (strict mode) |
| `npm run lint` | ESLint (flat config v9) |
| `npm run lint:fix` | ESLint auto-fix |
| `npm run format` | Prettier format |
| `npm run format:check` | Prettier check |
| `npm run verify` | Full: typecheck → lint → test → build |

## Code Style

- **Language:** TypeScript (strict mode, ES2022 target)
- **Naming:** camelCase for methods/variables, PascalCase for classes/interfaces
- **Interfaces:** PascalCase with `I` prefix (e.g., `IPluginSettings`, `IVaultReader`)
- **Visibility:** Explicit `public`/`private`/`override` on all class members
- **Types:** Explicit return types on all functions/methods
- **Readonly:** `readonly` on interface properties and class fields where applicable
- **No console.log:** Use `console.warn`/`console.error` only
- **Imports:** `type` keyword for type-only imports (`import type { ... }`)
- **Formatting:** Prettier (semi: true, singleQuote: false, printWidth: 100, tabWidth: 2)

## Architecture

- **Entry:** `src/main.ts` → exports `DateTrackerPlugin` (default)
- **Plugin class:** `src/plugin.ts` — wires up services, registers events, exposes API
- **Services (in `src/services/`):**
  - `FrontmatterEditor` — pure YAML frontmatter manipulation (no Obsidian deps)
  - `VisitTracker` — writes `date_last_visit` on file-open
  - `ForgottenNotePicker` — selects random forgotten note using filters
- **API:** `window.__dateTracker` — global access point for `getForgottenNote()`
- **Dependency injection:** Services receive adapters (`IMetadataReader`, `IVaultReader`, `IDataPersistence`) to enable unit testing without Obsidian runtime

## Testing

- Framework: Jest + ts-jest
- Tests use fake interfaces/mocks — no Obsidian runtime needed
- Test naming: `tests/services/*.test.ts` (mirrors `src/services/`)
- Run: `npm run test` or `npm run test:coverage`

## Workflow

После каждой доработки запускай полную проверку (`npm run verify`), которая включает typecheck → lint → test → build. Если verify падает — исправь ошибки до продолжения.

- **Линтеры и статанализ:** `npm run lint`, `npm run typecheck`
- **Тесты:** актуализируй существующие или напиши новые под изменившееся поведение
- **README.md:** синхронизируй документацию с новыми настройками и поведением

## Mobile

- Плагин совместим с Obsidian Mobile. Блок ` ```forgotten-notes ` использует `flex-wrap` + `min-width`, чтобы карточки корректно переносились на узких экранах.
- Размер текста масштабируется через `scale` при показе нескольких заметок, чтобы не было переполнения на мобильных устройствах.
- Событие `file-open` для отслеживания визитов поддерживается на всех платформах.

## Key Conventions

- `date_last_visit` is the frontmatter field name (defined as `DATE_LAST_VISIT_FIELD` in `constants.ts`)
- Default forgotten threshold: 15 days
- Default excluded paths: `.obsidian/`, `шаблоны/`
- Pick cache duration: 10 minutes (`PICK_INTERVAL_MS`)
- Build output goes to `dist/` (copy of `manifest.json` + bundled `main.js`)
- `obsidian` is marked external in esbuild — provided at runtime by Obsidian app
- ESLint config enforces strict type-checked rules in `src/` but relaxed in `tests/`
