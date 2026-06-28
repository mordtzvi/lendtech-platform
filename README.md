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
- Demo login / switch-user mode with seeded admin, broker, lender, client, introducer and professional-party roles

Placeholder boundaries are used for AI, email, documents and external integrations. The app is dependency-free and stores MVP data in browser local storage.

## Demo Auth Boundary

The MVP uses a structured demo login at `/login`. It seeds realistic organisations and users so the journeys can be tested as LendTech admin, The UK Adviser brokers, clients, The UK Lender Group, an email-only lender, an introducer and a professional party.

This is not production authentication. Future production auth should include secure login, MFA, user invitations, role approvals, password reset, organisation approval, lender approval, secure client links, session management and full audit logging.

## Run Locally

Use the bundled Node runtime if your shell does not have Node on the path:

```bash
/Users/maximcohen/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/serve.mjs
```

Then open the printed localhost URL.

## Base44 Notes

Base44 app ID: `6a40beec80768256592e94ee`.

Editor URL: `https://app.base44.com/apps/6a40beec80768256592e94ee/editor/workspace/overview`

Preview URL: `https://lend-tech-platform-592e94ee.base44.app`

GitHub should remain the source of truth. Preferred workflow: edit locally, test, commit and push to GitHub, then deploy/update Base44 from that committed source.
