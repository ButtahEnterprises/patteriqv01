# Documentation Index

- E2E/CI Troubleshooting and Artifacts: see `./dev-notes.md`
- Promotions API and UI: see `./promotions.md`

Quick links:
- Local E2E against external server (typically 3007):
  ```bash
  PORT=3007 npm run dev
  PLAYWRIGHT_BASE_URL=http://localhost:3007 PLAYWRIGHT_NO_SERVER=1 npx playwright test
  ```
- CI artifact access and trace viewing steps are documented in `./dev-notes.md`.
