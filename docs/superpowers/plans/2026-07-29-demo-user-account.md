# Demo User Account Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a documented ordinary demo account that is automatically available in development and explicitly enabled demo deployments.

**Architecture:** Keep public test credentials in a shared auth constants module and keep environment checks and persistence in a server-only seed helper. The login API seeds only an attempted `demo` login, while a read-only status endpoint lets the client decide whether to display the credentials.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Vitest, Testing Library, Playwright.

## Global Constraints

- Username is exactly `demo` and password is exactly `OpenMAIC123!`.
- The account has `role: 'user'`, `planType: 'free'`, and `learningOnboarding: null`.
- Enable outside production; in production require `ENABLE_DEMO_ACCOUNT=true`.
- Never reset or update an existing `demo` account.
- Do not add a database migration, authentication role, or generic seed framework.
- Do not stage runtime files under `data/student-profiles/`.

---

### Task 1: Shared Credentials And Idempotent Server Seed

**Files:**
- Create: `lib/auth/demo-account.ts`
- Create: `lib/server/demo-user.ts`
- Create: `tests/server/auth/demo-user.test.ts`

**Interfaces:**
- Produces: `DEMO_USERNAME`, `DEMO_PASSWORD`.
- Produces: `isDemoAccountEnabled(env?)` and `ensureDemoUser()`.
- Consumes: existing `createUserDAO()` and `hashPassword()`.

- [ ] **Step 1: Write failing environment and seed tests**

Mock `createUserDAO` and `hashPassword`, then assert:

```ts
expect(isDemoAccountEnabled({ NODE_ENV: 'development' })).toBe(true);
expect(isDemoAccountEnabled({ NODE_ENV: 'production' })).toBe(false);
expect(
  isDemoAccountEnabled({ NODE_ENV: 'production', ENABLE_DEMO_ACCOUNT: 'true' }),
).toBe(true);

await ensureDemoUser();
expect(create).toHaveBeenCalledWith(
  expect.objectContaining({
    id: 'demo-default',
    username: 'demo',
    role: 'user',
    planType: 'free',
    learningOnboarding: null,
  }),
);
```

Add a second test where `getByUsername` returns an existing account and assert `hashPassword`,
`create`, and `update` are not called.

- [ ] **Step 2: Run the seed test and verify RED**

Run: `pnpm vitest run tests/server/auth/demo-user.test.ts`

Expected: FAIL because `@/lib/server/demo-user` and `@/lib/auth/demo-account` do not exist.

- [ ] **Step 3: Add the shared constants and minimal server helper**

`lib/auth/demo-account.ts`:

```ts
export const DEMO_USERNAME = 'demo';
export const DEMO_PASSWORD = 'OpenMAIC123!';
```

`lib/server/demo-user.ts`:

```ts
export function isDemoAccountEnabled(
  env: Readonly<{ NODE_ENV?: string; ENABLE_DEMO_ACCOUNT?: string }> = process.env,
): boolean {
  return env.NODE_ENV !== 'production' || env.ENABLE_DEMO_ACCOUNT === 'true';
}

export async function ensureDemoUser(): Promise<void> {
  if (!isDemoAccountEnabled()) return;
  try {
    const dao = await createUserDAO();
    if (await dao.getByUsername(DEMO_USERNAME)) return;
    const passwordHash = await hashPassword(DEMO_PASSWORD);
    await dao.create({
      id: 'demo-default',
      email: null,
      username: DEMO_USERNAME,
      passwordHash,
      role: 'user',
      status: 'active',
      guestId: null,
      planType: 'free',
      avatar: null,
      nickname: '演示用户',
      bio: null,
      educationLevel: null,
      grade: null,
      favoriteSubjects: null,
      learningOnboarding: null,
      learningStyle: null,
      detailLevel: null,
      preferredLanguage: null,
      aiPersonality: null,
      aiName: null,
      customInstructions: null,
      autoGenerateQuiz: null,
      showStepByStep: null,
      enableMemory: null,
      enableRAG: null,
      emailVerified: true,
      emailVerifyToken: null,
      resetToken: null,
      resetTokenExpiry: null,
    });
  } catch (error) {
    log.error('ensureDemoUser failed:', error instanceof Error ? error.message : error);
  }
}
```

- [ ] **Step 4: Run the seed test and verify GREEN**

Run: `pnpm vitest run tests/server/auth/demo-user.test.ts`

Expected: PASS.

### Task 2: Status And Login API Integration

**Files:**
- Create: `app/api/auth/demo-account/route.ts`
- Modify: `app/api/auth/login/route.ts`
- Create: `tests/server/auth/demo-account-api.test.ts`

**Interfaces:**
- Consumes: `isDemoAccountEnabled()` and `ensureDemoUser()` from Task 1.
- Produces: `GET /api/auth/demo-account -> { enabled: boolean }`.
- Preserves: all current login response and cookie behavior.

- [ ] **Step 1: Write failing route tests**

Mock the demo helper and assert:

```ts
mockIsDemoAccountEnabled.mockReturnValue(true);
expect(await (await GET()).json()).toEqual({ enabled: true });

await POST(loginRequest({ emailOrUsername: 'demo', password: 'OpenMAIC123!' }));
expect(mockEnsureDemoUser).toHaveBeenCalledTimes(1);

await POST(loginRequest({ emailOrUsername: 'alice', password: 'password123' }));
expect(mockEnsureDemoUser).not.toHaveBeenCalled();
```

Mock the existing DAO, password verification, and token helpers so both login requests use the real
route control flow without writing storage.

- [ ] **Step 2: Run the API test and verify RED**

Run: `pnpm vitest run tests/server/auth/demo-account-api.test.ts`

Expected: FAIL because the status route is missing and login does not call `ensureDemoUser`.

- [ ] **Step 3: Implement the read-only route and conditional seed call**

Status route:

```ts
export async function GET() {
  return NextResponse.json({ enabled: isDemoAccountEnabled() });
}
```

In the login route, parse the request first and add:

```ts
if (emailOrUsername === DEMO_USERNAME) {
  await ensureDemoUser();
}
```

Keep `ensureAdminUser()` and the remaining lookup, verification, update, token, and cookie logic
unchanged.

- [ ] **Step 4: Run API tests and verify GREEN**

Run: `pnpm vitest run tests/server/auth/demo-account-api.test.ts`

Expected: PASS.

### Task 3: Login Hint, Documentation, And Browser Verification

**Files:**
- Modify: `app/auth/login/page.tsx`
- Modify: `.env.example`
- Create: `tests/auth/login-page.test.tsx`

**Interfaces:**
- Consumes: `GET /api/auth/demo-account`, `DEMO_USERNAME`, and `DEMO_PASSWORD`.
- Produces: a labeled ordinary-user credential hint when `{ enabled: true }`.

- [ ] **Step 1: Write failing login-page tests**

Mock `useAuth`, render the real page, and control `fetch`:

```ts
mockFetch.mockResolvedValue(
  new Response(JSON.stringify({ enabled: true }), { status: 200 }),
);
render(<LoginPage />);
expect(await screen.findByText('普通测试用户')).toBeVisible();
expect(screen.getByText('demo')).toBeVisible();
expect(screen.getByText('OpenMAIC123!')).toBeVisible();
```

Add a disabled response test and assert the ordinary-user hint is absent while the administrator hint
remains.

- [ ] **Step 2: Run the UI test and verify RED**

Run: `pnpm vitest run tests/auth/login-page.test.tsx`

Expected: FAIL because the login page does not fetch availability or display the demo credentials.

- [ ] **Step 3: Implement the availability fetch and compact account list**

Add `demoAccountEnabled` state. Fetch `/api/auth/demo-account` once on mount, ignore failed requests,
and guard against setting state after unmount. Keep the existing login form and admin hint. Render the
ordinary hint only when enabled, with the visible label `普通测试用户` and the shared credentials.

Add to `.env.example`:

```dotenv
# Enable the fixed demo / OpenMAIC123! account in production demo deployments.
ENABLE_DEMO_ACCOUNT=false
```

- [ ] **Step 4: Run focused tests and checks**

Run:

```bash
pnpm vitest run tests/server/auth/demo-user.test.ts tests/server/auth/demo-account-api.test.ts tests/auth/login-page.test.tsx tests/onboarding/onboarding-gate.test.tsx
pnpm exec prettier --check lib/auth/demo-account.ts lib/server/demo-user.ts app/api/auth/demo-account/route.ts app/api/auth/login/route.ts app/auth/login/page.tsx tests/server/auth/demo-user.test.ts tests/server/auth/demo-account-api.test.ts tests/auth/login-page.test.tsx .env.example
pnpm exec eslint lib/auth/demo-account.ts lib/server/demo-user.ts app/api/auth/demo-account/route.ts app/api/auth/login/route.ts app/auth/login/page.tsx tests/server/auth/demo-user.test.ts tests/server/auth/demo-account-api.test.ts tests/auth/login-page.test.tsx
git diff --check
```

Expected: all focused commands PASS.

- [ ] **Step 5: Verify with Edge**

Open `http://localhost:3004/auth/login` in a fresh Edge context. Assert the ordinary account hint is
visible, submit `demo / OpenMAIC123!`, and verify the final URL is
`/sky/onboarding?redirect=%2Fsky`. Capture a desktop screenshot and check browser console errors.

- [ ] **Step 6: Commit the implementation**

Stage only the files listed in this plan. Do not stage `data/student-profiles/admin-default.json` or
generated demo profile JSON files.

```bash
git commit -m "feat: add development demo user account"
```
