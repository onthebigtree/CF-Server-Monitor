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

These changes preserve the existing deployment behavior. Unified account management
and node pull synchronization are planned separately and are not implemented here yet.

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

Extension implementation is planned; this baseline does not claim that these
hooks or the management Worker have already been implemented.

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
