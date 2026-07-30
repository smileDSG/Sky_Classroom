# Demo User Account Design

## Goal

Provide teammates with a documented, working ordinary-user account for local development and
explicit demo deployments. The account must exercise the pending onboarding path without exposing a
fixed production credential by default.

## Credentials

- Username: `demo`
- Password: `OpenMAIC123!`
- Authorization role: `user`
- Plan: `free`
- Onboarding state: `pending` because `learningOnboarding` is `null`

These credentials are test data, not a secret. They are intentionally visible on the login page only
when demo-account seeding is enabled.

## Availability

The demo account is enabled when either condition is true:

1. `NODE_ENV` is not `production`.
2. The server-only environment variable `ENABLE_DEMO_ACCOUNT` is exactly `true`.

Production deployments therefore do not create or advertise the account unless an operator opts in.
The client receives only an availability flag; it does not decide whether the server may create the
account.

## Server Design

Add a focused `ensureDemoUser` server helper beside the existing administrator seed helper. It uses
the current user DAO and password hashing utilities, and creates the account only when enabled and
missing.

Seeding is idempotent. If a `demo` user already exists, the helper does not reset its password, role,
profile, or onboarding data. This prevents a public request from taking over or erasing an existing
account.

The login route invokes demo seeding only when the submitted username is exactly `demo`, before the
user lookup. A seed failure therefore affects only the demo login attempt. No new database table,
migration, or authentication role is added.

## Login Page

Replace the single administrator credential hint with a compact account list:

- Always show the existing administrator account according to current behavior.
- Show the ordinary `demo` account only when the server-provided availability flag is true.
- Label both accounts clearly so teammates understand which path they are testing.

The page remains a login form. Credential hints do not auto-fill fields and do not change form
submission behavior.

## Configuration Flow

Expose demo availability through `GET /api/auth/demo-account`. The response contains only
`{ enabled: boolean }`; it does not create the account. The login page fetches this status before
rendering the demo credential hint. The server independently enforces the same availability rule when
seeding, so the client flag is never an authorization decision.

Document `ENABLE_DEMO_ACCOUNT=true` in `.env.example` as an explicit opt-in for hosted demo
environments.

## Error Handling

Failure to create the demo account must not prevent normal users from logging in. The login route
continues with its existing authentication behavior and returns the existing invalid-credential error
when the requested account is unavailable.

## Tests

Add focused tests that verify:

- Development mode creates a `user` account with `learningOnboarding: null`.
- Production mode does not create the account by default.
- `ENABLE_DEMO_ACCOUNT=true` enables it in production.
- Repeated seeding does not update or reset an existing account.
- The login page shows the ordinary credential hint only when enabled.
- Logging in as the seeded account reports onboarding status `pending` and follows the ordinary-user
  onboarding gate.

Run only the focused auth, login-page, and onboarding-gate tests plus formatting and lint checks for
touched files. Existing repository-wide baseline failures remain out of scope.
