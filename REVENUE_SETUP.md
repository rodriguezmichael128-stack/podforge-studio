# PodForge Revenue Collection Setup

PodForge should treat revenue tracking and money movement as two related systems.

## How the 10% Collection Works

1. The creator accepts PodForge's revenue-share terms at account creation.
2. The creator connects platform accounts or imports platform revenue statements.
3. PodForge stores a ledger row for each pay period:
   - creator ID
   - platform
   - platform asset ID
   - gross revenue
   - PodForge 10% fee
   - creator 90% share
   - estimated or final status
   - collection status
4. The creator activates a Stripe billing mandate.
5. After each pay period closes, PodForge creates an automatic Stripe invoice for the 10% fee, even if the platform has not yet paid the creator.
6. When PodForge controls the transaction directly, use Stripe Connect application fees and deduct the fee at source.

## Environment

Create a local `.env` file from `.env.example`.

Required for real Stripe test mode:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `PUBLIC_BASE_URL`

Keep this disabled until production review is complete:

- `PODFORGE_ENABLE_LIVE_CHARGES=false`

## Current API Routes

- `GET /api/revenue/config`
- `POST /api/revenue/setup-mandate`
- `POST /api/revenue/collect-fee`
- `POST /api/revenue/platform-sync`
- `POST /api/revenue/webhook`

When Stripe keys are absent, these routes return simulated success responses. This keeps tester demos safe.

## Production Checklist

- Create PodForge Stripe account.
- Complete Stripe business verification.
- Use test-mode keys first.
- Create Stripe webhook endpoint for `/api/revenue/webhook`.
- Add lawyer-reviewed terms for revenue share, fee timing, refunds, chargebacks, taxes, and failed collections.
- Store Stripe customer IDs and default payment methods per creator in a real database.
- Store every platform statement row and never overwrite historical ledger rows.
- Run a reconciliation job after each platform pay period closes.
- Only enable live charges after legal approval and Stripe test coverage.
