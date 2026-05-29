# pnpm Security Policy

This repo applies a subset of the [bodadotsh npm security best practices](https://github.com/bodadotsh/npm-security-best-practices) that fit a two-service app (a React/Vite editor and a Hocuspocus/Prisma backend) shipped as Docker images. It mirrors the policy used in [teammapper](https://github.com/b310-digital/teammapper).

`frontend/` and `backend/` are independent pnpm projects, each with its own `pnpm-lock.yaml`, `pnpm-workspace.yaml`, and `.npmrc`. The frontend additionally hosts the local workspace packages under `frontend/packages/*`.

## What's enforced

| Practice | Where | Why |
|----------|-------|-----|
| Exact-version saves | `.npmrc` (`save-exact=true`) in each project | New `pnpm add` calls write exact versions, keeping the manifest aligned with what the lockfile already pins. |
| Lifecycle scripts gated by allowlist | `pnpm-workspace.yaml` (`allowBuilds:`) | pnpm 10 disables install scripts by default for transitive deps. `allowBuilds` records the explicit decision for each package that ships one. Backend allows Prisma + esbuild (native binaries needed); frontend allows `@parcel/watcher` + esbuild and disallows `core-js` (funding notice only). |
| 7-day quarantine on new versions | `pnpm-workspace.yaml` (`minimumReleaseAge: 10080`) | New package versions are held back from installation for 7 days, giving the ecosystem time to revoke compromised releases. |
| Frozen-lockfile installs | CI (`setup-pnpm` composite action) and both Dockerfiles | Keeps the lockfile authoritative across every install path. |
| pnpm version pinned | `corepack prepare pnpm@10.33.4 --activate` in CI and the Dockerfiles (`PNPM_VERSION`) | CI and production builds use the same pnpm. |
| `pnpm audit` in CI | `pnpm audit --audit-level=high --prod` step in `reusable-checks.yml` | Fails CI on high or critical advisories in production dependencies. |
| Transitive/direct-dep CVE pins | `overrides:` in `pnpm-workspace.yaml` | Forces minimum versions of known-vulnerable deps (e.g. backend: hono, lodash; frontend: jspdf). Audit periodically with `pnpm why <pkg>` and retire entries once the tree resolves above the vulnerable range. |
| Action pinning | All `uses:` lines in `.github/workflows/` carry a 40-char SHA | Protects against tag-rewrite supply-chain attacks. |
| Least-privilege workflow permissions | Workflow-level `permissions: contents: read`, with per-job overrides only where a job needs more (e.g. `packages: write` for image publishing) | CI runs with `secrets.GITHUB_TOKEN` scoped to the minimum each job requires. |
| Dependabot 7-day cooldown | `cooldown:` block in `.github/dependabot.yml` (each ecosystem) | Holds version-update PRs for 7 days after a release, mirroring `minimumReleaseAge`. Security updates are exempt so CVE fixes still flow promptly. |
| Node base image bumped manually | `ignore: dependency-name: "node"` in `.github/dependabot.yml` (docker ecosystems) | Dependabot does not open PRs for the Node base image; bumps follow the Node LTS release cycle and are applied by hand. |

## Running checks locally

```bash
# in frontend/ or backend/
pnpm install --frozen-lockfile
pnpm audit --audit-level=high --prod   # match the CI gate
pnpm run lint:check && pnpm run type:check && pnpm test
```

## Adding a new override

1. Confirm the CVE via `pnpm audit` or the advisory link.
2. Identify the affected version range, e.g. `jspdf@<=4.2.0`.
3. Add the entry to `overrides:` in that project's `pnpm-workspace.yaml` with the patched version.
4. Run `pnpm install` to refresh the lockfile, then commit both files.
5. Once `pnpm why <pkg>` shows the tree resolves above the vulnerable range, retire the override.
