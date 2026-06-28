# LendTech Platform MVP

Focused MVP for the LendTech commercial finance operating system.

This build includes:

- Base44-shaped entity schemas in `base44/entities`
- Broker login, dashboard and case creation
- BankManager.ai brain-dump workflow with editable extraction review
- Source log and audit trail
- Applicants, people, security and compliance panels
- Bridging and development finance calculators
- Document checklist and placeholder upload metadata
- Client missing-information request drafting
- Appetite-based lender search
- Email-only lender submission workflow with token response pages
- Lender credit-paper dashboard
- Quote comparison, pros/cons and client comparison draft
- Commission ledger
- The UK Lender Group white-label application route at `/apply/uk-lender-group`

Placeholder boundaries are used for AI, email, documents and external integrations. The app is dependency-free and stores MVP data in browser local storage.

## Run Locally

Use the bundled Node runtime if your shell does not have Node on the path:

```bash
/Users/maximcohen/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/serve.mjs
```

Then open the printed localhost URL.

## Base44 Notes

The local shell could not run `npx base44 whoami` because `npx` was not available on this machine PATH. No Base44 CLI registration, type generation or deploy was attempted. Once Node/npm/npx are available, link or create the app through the Base44 CLI and replace the local placeholder client boundary in `src/api/base44Client.js` with the live SDK.
