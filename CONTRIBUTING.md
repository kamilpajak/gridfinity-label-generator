# Contributing to Gridfinity Label Generator

Thanks for your interest in contributing! This project ("gridscribe", published as
**Gridfinity Label Generator** and hosted at
[gridfinitylabels.com](https://gridfinitylabels.com)) welcomes bug reports, feature
ideas, and pull requests.

Please read this guide before opening a pull request. By participating you agree to
follow our [Code of Conduct](CODE_OF_CONDUCT.md) and to license your contributions
under the terms described in the [License](#license) section below.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Branch Naming](#branch-naming)
- [Commit Messages](#commit-messages)
- [Running Tests](#running-tests)
- [Lint, Format, and Type Checks](#lint-format-and-type-checks)
- [Standards Data Pipeline](#standards-data-pipeline)
- [Pull Request Process](#pull-request-process)
- [CI Expectations](#ci-expectations)
- [Fork PRs Run Limited CI](#fork-prs-run-limited-ci)
- [License](#license)

## Code of Conduct

This project is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By
participating, you are expected to uphold it. Please report unacceptable behavior to
the maintainer.

## Prerequisites

- **Node.js 22** (this is the version CI uses; a newer LTS is fine locally)
- **pnpm 10** — this project uses [pnpm](https://pnpm.io/) as its package manager.
  Do not use `npm` or `yarn`; the lockfile is `pnpm-lock.yaml` and CI installs with a
  frozen lockfile.

Enable pnpm via Corepack if you don't already have it:

```bash
corepack enable
corepack prepare pnpm@10 --activate
```

## Getting Started

```bash
# 1. Fork and clone the repository
git clone https://github.com/<your-username>/gridfinity-label-generator.git
cd gridfinity-label-generator

# 2. Install dependencies (also sets up Husky git hooks via the prepare script)
pnpm install

# 3. Start the dev server with hot reload
pnpm dev

# Or open it in your browser automatically
pnpm dev --open
```

The `pnpm install` step runs `prepare`, which installs the Husky hooks used for
commit-message linting and pre-commit formatting. If you clone without installing,
those hooks will not run.

To build and preview a production bundle locally:

```bash
pnpm build
pnpm preview
```

Note: `pnpm build` runs `standards:build` first (via the `prebuild` script), which
regenerates `src/lib/data/standards-generated.ts` from the standards data. See
[Standards Data Pipeline](#standards-data-pipeline).

## Branch Naming

Create a topic branch off `master`. Use one of the following prefixes so the branch's
intent is clear:

| Prefix      | Use for                              |
| ----------- | ------------------------------------ |
| `feature/`  | New features                         |
| `bugfix/`   | Bug fixes                            |
| `hotfix/`   | Urgent production fixes              |
| `refactor/` | Code changes with no feature/bug fix |
| `test/`     | Adding or fixing tests               |
| `docs/`     | Documentation only                   |
| `chore/`    | Tooling, config, and other chores    |

Example:

```bash
git checkout -b feature/qr-code-toggle
```

## Commit Messages

This project uses [**Conventional Commits**](https://www.conventionalcommits.org/),
**enforced by commitlint** through a Husky `commit-msg` hook. Commits that do not
follow the format will be rejected locally and in CI.

### Format

```
type(scope): description

[optional body]

[optional footer]
```

### Allowed types

| Type       | Description                 | Version bump |
| ---------- | --------------------------- | ------------ |
| `feat`     | New feature                 | minor        |
| `fix`      | Bug fix                     | patch        |
| `perf`     | Performance improvement     | patch        |
| `docs`     | Documentation only          | –            |
| `style`    | Formatting, no code change  | –            |
| `refactor` | Code change, no feature/fix | –            |
| `test`     | Adding or fixing tests      | –            |
| `build`    | Build system changes        | –            |
| `ci`       | CI configuration            | –            |
| `chore`    | Other changes               | –            |
| `revert`   | Reverting a previous commit | –            |

Additional rules enforced by `commitlint.config.js`:

- The type must be lower-case.
- The subject must not be empty.
- The subject must be at most 100 characters.

### Breaking changes

Add `!` after the type or include a `BREAKING CHANGE:` footer to signal a major bump:

```
feat!: remove deprecated label export API
```

### Examples

```
feat(batch): add per-label font size override
fix(preview): correct thread size formatting for imperial units
docs: document the standards data pipeline
```

## Running Tests

```bash
# Run unit tests once (Vitest)
pnpm test:unit --run

# Run unit tests in watch mode while developing
pnpm test:unit

# Unit tests with coverage
pnpm test:unit:coverage

# Run end-to-end tests (Playwright)
pnpm test:e2e

# Run everything (unit once, then e2e) — mirrors CI
pnpm test
```

Run a single unit test file:

```bash
pnpm test:unit path/to/file.test.ts
```

Notes:

- Unit tests use Vitest with separate browser and node environments. `*.svelte.test.ts`
  files run in a Playwright-backed browser; plain `*.test.ts` / `*.spec.ts` run in node.
- E2E tests live in `/e2e/`. The first run may need browsers installed:
  `pnpm exec playwright install --with-deps chromium`.
- Do not add hard-coded `waitForTimeout` waits in tests; wait on conditions/locators
  instead.

## Lint, Format, and Type Checks

```bash
# Check formatting (Prettier) and lint rules (ESLint)
pnpm lint

# Auto-format the codebase with Prettier
pnpm format

# Type-check with svelte-check
pnpm check
```

A Husky pre-commit hook runs `lint-staged`, which formats and lints staged files
automatically. Please still run `pnpm check` before pushing, since type errors are not
caught by the pre-commit hook but will fail CI.

### UI and icon conventions

- Reference [**shadcn-svelte**](https://www.shadcn-svelte.com/) docs for components,
  not the React `ui.shadcn.com` docs.
- Use [Lucide icons](https://lucide.dev/) via `@lucide/svelte/icons/<icon-name>`; do
  not hand-write inline SVG icons.

## Standards Data Pipeline

Hardware standard metadata (DIN/ISO titles, cross-references, withdrawn status) is not
edited by hand in the generated TypeScript. It flows through a small pipeline whose
Single Sources of Truth are documented in [`CLAUDE.md`](CLAUDE.md).

If you change anything under `data/` (for example `data/standards-config.json`), you
must regenerate and validate the derived data:

```bash
pnpm standards:validate   # Validate standards-config.json
pnpm standards:build      # Rebuild src/lib/data/standards-generated.ts
```

Convenience scripts:

```bash
pnpm standards:refresh    # fetch metadata + rebuild
pnpm standards:add        # full pipeline for adding new standards
```

Do not manually edit `src/lib/data/standards-generated.ts` — it is generated output and
will be overwritten. CI runs `pnpm build-standards` (validate + build), so an
out-of-date generated file will fail the build. See the "Standards Data" section of
[`CLAUDE.md`](CLAUDE.md) for the full pipeline and data-file reference.

## Pull Request Process

1. Fork the repo and create a topic branch (see [Branch Naming](#branch-naming)).
2. Make your change with Conventional Commit messages.
3. Make sure it is green locally:
   ```bash
   pnpm lint
   pnpm check
   pnpm test:unit --run
   pnpm test:e2e
   ```
4. If you touched `data/`, run the [standards pipeline](#standards-data-pipeline) and
   commit the regenerated files.
5. Open a pull request against `master`. Describe what changed and why, and link any
   related issue.
6. Keep the PR focused. Small, reviewable PRs are merged faster than large ones.
7. Address review feedback with additional commits (avoid force-pushing over an active
   review so reviewers can see what changed between iterations).

`master` is protected: changes land through pull requests, and the required checks must
pass before a PR can be merged.

## CI Expectations

Every pull request runs the CI workflows in `.github/workflows/`. Your PR is expected
to have **all checks green** before it can be merged. The main jobs are:

- **validate** — installs dependencies, runs `pnpm check`, `pnpm lint`, commitlint (on
  PRs), unit tests (`pnpm test:unit --run`), the standards build, image validation, the
  production build, and Playwright e2e tests.
- **security** — dependency and secret scanning.
- **sonar** — SonarCloud analysis. Your change must pass the **SonarCloud quality gate**
  (no new bugs, vulnerabilities, or code smells above threshold, and coverage on new
  code maintained).
- **docker-security** — container image scanning.

If a check fails, open its logs from the PR's "Checks" tab, fix the issue, and push a
new commit. CI re-runs automatically on each push.

## Fork PRs Run Limited CI

Because this repository is public, pull requests from **forks run a reduced set of CI
checks**. Some jobs depend on repository secrets that GitHub intentionally does not
expose to fork-based workflow runs, and are therefore skipped for external
contributors:

- The **sonar** (SonarCloud) job is skipped for fork PRs — it needs a token that is not
  available to forks, so it is not a required check for external contributions and will
  not show a failing status you cannot fix.
- Secret-dependent and privileged automation jobs are gated to same-repository events.

This is expected. Your fork PR should still pass the checks that do run (notably
**validate** and **security**). A maintainer may need to approve workflow runs on your
first contribution before they start. If something looks stuck, mention it in the PR and
a maintainer will help.

## License

This project's own source code is licensed under **AGPL-3.0-only**. See the
[LICENSE](LICENSE) file for the full text.

Some assets and data shipped with the project (for example bundled fonts and any
retained standard designations) are covered by their own separate terms, documented in
`THIRD-PARTY-NOTICES`. The project's license grant covers the project's source code
only.

By submitting a contribution (for example a pull request), you agree that your
contribution is licensed under AGPL-3.0-only, and — so the maintainer can continue to
offer the project under both the public AGPL license and a commercial license — you
grant the maintainer the rights described in the project's contributor terms. Please
sign off your commits to certify you have the right to submit them:

```bash
git commit -s -m "feat: my change"
```

If you have questions about licensing or contributor terms before submitting, open a
discussion or issue first.
