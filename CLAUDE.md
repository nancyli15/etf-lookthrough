# CLAUDE.md

Read `docs/PLAN.md` before doing anything. It has the project context, the current status, the decisions made so far and the next steps.

## Who you're working with

- A student applying for SnapTrade's Product Engineer role. This app *is* the application.
- New to OAuth, Next.js and finance beyond ETFs. Wants to **understand and be able to explain every line** in a technical deep-dive interview.

## How to work

- Go **one step at a time**. Before each step, explain in plain language what it does and why, then make the change, then say how to verify it.
- After each step, stop and let the user test it before continuing.
- Explain new terms the first time they appear.
- Prefer small, readable code over clever code. Comment the *why*, not the *what*.
- When we make a tradeoff, add one line to the "Decisions and tradeoffs" table in `README.md`.
- When SnapTrade's API or docs surprise us, add one line to the "API and docs feedback log" in `README.md`.

## Hard rules

- Never ask for, print, log or commit secrets: client secret, `SESSION_SECRET`, access or refresh tokens, or the contents of `.env.local`.
- Never log authorization codes or tokens, even in error messages.
- Before any `git add`, run `git status` and confirm `.env.local` is not listed.
- The app is read-only. Never add the `trade` scope or any order placement.
- Two files are both named `route.ts` (`app/login/` and `app/api/raw/`). Double-check the path before editing one. Mixing them up already broke the app once.

## Commands

- `npm run dev`: local app at http://localhost:3000
- `npm run build`: production build. Run it before pushing; Vercel builds the same way.
- Push to `main`, and Vercel deploys to https://etf-lookthrough.vercel.app
