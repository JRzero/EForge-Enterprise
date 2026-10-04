# EForge Enterprise web shell

React 19 and TypeScript consume fixed EForge artifacts; no sibling source
checkout is needed. The app includes login/captcha, bootstrap, the dashboard,
permission-aware hierarchical navigation, 403/404, session restore and logout.

```powershell
cd web
npm ci
npm run dev
```

The development server forwards `/api`, `/captchaImage`, and `/logout` to
`http://127.0.0.1:8080`. Set `EFORGE_E2E_BACKEND_URL` to use a different local
backend. The development proxy preserves the browser-facing Host so POSTs remain
same-origin at the backend CORS boundary. Configure backend MySQL/Redis and initialize all migrations first;
see `server/README.md`. Production needs same-origin API reverse proxying and
SPA history fallback. No seeded passwords are displayed in the application.

## Verify

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run check:generated
npx playwright install chromium
npm run test:e2e
```

The browser suite verifies errors, captcha recovery, grouped navigation, token
restore/expiry, permission revocation, failed logout retry and mobile keyboard
submission. Tests use isolated route fixtures and do not configure a production
mock API. For real browser-to-server verification:

```powershell
cd ..
mvn -B -ntp -f server/pom.xml verify
./server/scripts/verify-auth-integration.ps1 -VerifyWeb -OpenApiOutputPath contracts/openapi/api-v1.json
```

This owns disposable MySQL/Redis containers, imports unchanged schemas and all
migrations, then exercises both seeded accounts through the browser. It confirms
server logout revokes the previous bearer token. It also verifies navigation seed
identities, URLs and permissions against `app/route-contract.json`. Those seed
accounts/passwords exist only in the unchanged upstream development schema.

## Generated API

`contracts/openapi/api-v1.json` comes from the real authenticated
`/v3/api-docs/api-v1` endpoint in the integration script. Canonicalization sorts
object keys and replaces only the environment-specific server URL. It does not
hand-write schemas. Regenerate with `npm run generate:api`; never edit
`generated/api.ts`. `npm run check:generated` regenerates and compares the file.
CI also exports the live schema and checks it against the committed snapshot.

Only `integration/legacy-auth.ts` reads RuoYi captcha/logout wrappers. The login
and bootstrap pages use generated canonical types/functions. Session, permission
and navigation composition are documented in ADR-0010.
