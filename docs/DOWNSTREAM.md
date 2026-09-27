# Downstream maintenance

This fork keeps the upstream project and a small set of generic deployment defaults.
The initial downstream branch starts at upstream commit
`19af7d1d32f4495e276cc81dd8b1617a9df8fb6a`.

## Branches and remotes

- `upstream`: `https://github.com/huilang-me/CF-Server-Monitor.git`.
- `origin`: this fork.
- `main`: upstream tracking branch; no deployment-specific customizations.
- `codex/managed-console`: reviewed downstream changes.
- New upstream updates are merged on a temporary `codex/upstream-*` branch,
  tested and reviewed before reaching the downstream release branch.

Do not force-push a shared release branch. Preserve upstream history and license notices.
Do not deploy directly from a floating upstream branch; pin the reviewed commit.

## Current downstream changes

- Private dashboard defaults, HTTP agent reporting, bounded frontend live sessions.
- Decimal GB for quota fields and consistent unknown-quota labels.
- Local HTTP test mode so frontend testing does not install a local root certificate.

The optional management extension adds native-authenticated user creation, editing,
enabling/disabling and host-grant editing through a separate service binding.
Node execution, subscriptions and historical usage migration are not implemented
by this fork. The feature is off unless explicitly configured.

## Extension boundary

Reuse CFSM's native administrator login, password settings and `checkAuth`.
There is no second administrator account store, login page or session database.
A separate private management Worker owns proxy users, grants, subscriptions and
usage accounting. CFSM authenticates the browser before invoking its dedicated
AdminAPI Service Binding; probe credentials must never grant management access.

Add UI pages under `src/frontend/extensions/management/` and the authenticated
backend adapter under `src/extensions/management/`. Keep upstream edits limited
to route registration, optional navigation and a quota summary hook. Avoid copying
native authentication code or adding management tables to the monitoring database.
Management browser requests stay on the current origin, even when monitoring uses
multiple API bases. New mutation endpoints must enforce same-origin/CSRF checks.

An explicit feature flag hides the extension and disables its API when off. When
on, missing bindings fail closed. Test upstream functionality with the extension
disabled and extension contracts with it enabled. If native authentication needs
a security correction, keep it in an isolated commit with regression tests rather
than replacing the auth system. Review JWT logout and password-change semantics
before granting management access.

### Extension contract

- Set `MANAGEMENT_ENABLED=true` and bind `MANAGEMENT_ADMIN` to the private
  backend's named `AdminAPI` entrypoint. Default is disabled.
- Native login must be initialized with a password and independent JWT secret.
  Existing tokens without a credential-version claim must sign in again.
- Public adapter uses `/api/management/` for status, users, user subscriptions,
  usage history and machine settings. Internal routes use `/v1/`.
  `src/extensions/management/index.js` contains the explicit route allowlist.
- Allowed methods are route-specific GET, POST and PUT. Writes require
  same-origin requests, JSON and `X-CFSM-Management: 1`; arbitrary routes and
  unrecognized query parameters are rejected. Browser tokens never reach the service binding.
- Edits carry a revision; HTTP 409 means refresh before retrying. Desired grants
  and node-applied grants are separate. The UI must not claim pending work ran.
- Authentication uses the native administrator only. Changing the username or
  password invalidates new credential-bound tokens. Logout clears this browser;
  it does not centrally revoke a previously copied token.
- Unavailable authentication/bindings fail closed. Machine polling runs only while
  its page is visible and does not overwrite dirty forms. No probe credentials,
  proxy UUIDs or node management credentials are added here.
- An optional private `MANAGEMENT_HOST_MAP` maps native server IDs to stable
  management host IDs. `traffic.js` attaches authenticated quota summaries using
  a bounded 30-second isolate cache. Dashboard/detail handlers and ServerBarCard
  are the small upstream integration points; resource counters remain native.
- Mapped servers edit quota/calibration only in the management extension. The
  native edit handler preserves native quota fields; its form links to management.
  Unmapped servers retain upstream behavior. No mapping values belong in Git.

The management backend is separately versioned and deployed. This extension can
be tested locally with synthetic data without granting production node control.

## Verification

```sh
npm ci --ignore-scripts --no-audit --no-fund
CFSM_LOCAL_HTTP=1 npm run test:all
CFSM_LOCAL_HTTP=1 npm run build:frontend
```

Production Wrangler configuration, account/database identifiers, host inventories,
user records, tokens, passwords and generated subscriptions must never be committed
here. This is a public fork. Keep environment configuration in the private deployment
repository or protected files; CI uses synthetic fixtures only.
