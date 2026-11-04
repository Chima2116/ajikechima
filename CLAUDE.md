# Portfolio project notes

- `site/` is the live portfolio (plain HTML, CSS, JS). Do not rebuild it in React.
- All NEW UI (client login, AI demos, interactive tools) uses Halaska UI: `src/halaska-kit.jsx`.
  - Entry: `ui.html` + `src/main.jsx`. Run `npm run ui` (port 5174). Build with `npm run ui:build`.
  - Use named imports from the kit, ThemeProvider/usePal/tokens for colour. No hardcoded colours.
  - Docs: https://ui.halaska.com/install.md
