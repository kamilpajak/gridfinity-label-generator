# Security Policy

Thank you for helping keep Gridfinity Label Generator and its users safe.

This project is maintained by a single developer in their spare time. The
guidance below sets realistic expectations for how security reports are
handled.

## Supported Versions

Only the latest released version receives security fixes. Older versions
are not patched — please update to the newest release before reporting an
issue.

| Version        | Supported          |
| -------------- | ------------------ |
| Latest release | :white_check_mark: |
| Older releases | :x:                |

The hosted service at [gridfinitylabels.com](https://gridfinitylabels.com)
always runs a recent build, so reports against the live site are welcome.

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security problems.** Public
issues disclose the vulnerability to everyone before a fix is available.

Report privately using one of these channels:

1. **GitHub Security Advisories (preferred).** Go to the
   [Security tab](https://github.com/kamilpajak/gridfinity-label-generator/security/advisories/new)
   and click **Report a vulnerability**. This opens a private advisory that
   only you and the maintainer can see.
2. **Email.** If you cannot use GitHub, email the maintainer at
   **hello@gridfinitylabels.com** with `SECURITY` in the subject line.

To help triage the report faster, please include:

- A description of the vulnerability and its potential impact.
- Steps to reproduce, or a proof of concept.
- The affected version, URL, or commit.
- Any suggested fix, if you have one.

## Response Expectations

This is a solo, best-effort project. Please allow reasonable time for a
response — there is no paid on-call rotation behind it.

- **Acknowledgement:** within about 7 days.
- **Initial assessment:** within about 14 days, including whether the
  report is accepted, needs more information, or is out of scope.
- **Fix and disclosure:** the timeline depends on severity and complexity.
  Critical issues affecting the hosted service are prioritized. We aim to
  coordinate public disclosure with you once a fix is released.

There is currently **no bug bounty or paid reward program**. Genuine,
responsibly disclosed reports will be credited in the release notes or
security advisory if you would like the recognition.

## Scope

This is a client-side web application that generates printable labels. It
does not require login, and it does not store personal user data on a
backend.

**In scope:**

- The application source code in this repository.
- The hosted deployment at [gridfinitylabels.com](https://gridfinitylabels.com).
- The published container images on GHCR.

**Out of scope:**

- Vulnerabilities in third-party dependencies without a demonstrated,
  concrete impact on this project. Report those upstream; open an issue
  here only if this project needs to change how it uses the dependency.
- Findings from automated scanners with no proof of a real, exploitable
  issue.
- Denial of service through unrealistic traffic volumes, brute force, or
  request flooding.
- Social engineering, phishing, or physical attacks against the maintainer
  or hosting provider.
- Missing security headers or configuration hardening with no demonstrated
  exploit (reports with a working proof of concept are still welcome).
- Reports about third-party platforms (GitHub, the hosting provider, the
  CDN) — please report those to the respective vendor.

## Safe Harbor

Testing must not harm the service or its users. Do not run automated load
or denial-of-service tests against the live site, do not access or modify
data that is not yours, and stop as soon as you have confirmed a
vulnerability. Good-faith research that follows this policy will not be
pursued or reported by the maintainer.
