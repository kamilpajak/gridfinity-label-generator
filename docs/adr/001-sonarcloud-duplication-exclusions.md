# ADR-001: SonarCloud Duplication Exclusions for Content-Heavy Components

## Status

Accepted

## Date

2026-01-11

## Context

SonarCloud Quality Gate was failing due to code duplication at 15.2%, exceeding the default 3% threshold. The duplication originated primarily from similar HTML structure in content-heavy modal components:

- `src/lib/components/whats-new/*.svelte` - What's New modal with changelog entries
- `src/lib/components/legal/*.svelte` - Privacy Policy modal with policy sections
- `src/lib/components/shared/modal-wrapper.svelte` - Shared modal wrapper component

### Refactoring Already Performed

Before this decision, significant refactoring was completed:

1. Extracted shared CSS (`@keyframes sparkle`, `.custom-scrollbar`) to global `app.css`
2. Created `modal-utils.ts` with shared handler functions (`createEscapeHandler`, `createBackdropClickHandler`)
3. Created `ModalWrapper` component for shared modal structure (header, content, footer)

Despite these efforts, duplication remained at 15.2% due to the inherent similarity of content sections within these modals.

### Research Findings

1. **Industry best practices** recommend different duplication thresholds:
   - Backend/business logic: 3-5%
   - UI/template-heavy projects: 10-15%

2. **SonarCloud limitations**: Cannot set different thresholds per file type or folder

3. **Further refactoring** (e.g., extracting every privacy policy section into separate components) was deemed over-engineering with no practical benefit

## Decision

Use `sonar.cpd.exclusions` to exclude specific content-heavy Svelte components from Copy-Paste Detection (CPD):

```properties
sonar.cpd.exclusions=...,**/whats-new/**/*.svelte,**/legal/**/*.svelte,**/shared/modal-wrapper.svelte
```

## Rationale

1. **Precision**: Excludes only the known sources of acceptable structural duplication, not the entire codebase
2. **Maintains standards**: The 3% threshold remains enforced for business logic and interactive components
3. **Transparency**: The exclusion is explicitly configured and documented
4. **Avoids over-engineering**: Prevents unnecessary component extraction for static content

## Alternatives Considered

| Alternative                             | Why Not Chosen                                                      |
| --------------------------------------- | ------------------------------------------------------------------- |
| Raise global threshold to 15-20%        | Too permissive for the entire codebase; could mask genuine issues   |
| Split into multiple SonarCloud projects | Overhead not justified for a single frontend project                |
| Further component extraction            | Over-engineering; no practical benefit for static content sections  |
| Exclude files from all analysis         | Too aggressive; we still want other metrics (coverage, code smells) |

## Consequences

### Positive

- SonarCloud Quality Gate passes
- Maintains strict duplication standards for core application logic
- Clear documentation of the decision

### Negative

- Duplication within excluded files won't be detected (acceptable trade-off for content-heavy templates)

## References

- [SonarCloud CPD Documentation](https://docs.sonarcloud.io/advanced-setup/analysis-scope/)
- [Industry duplication thresholds](https://www.metridev.com/metrics/code-duplication-best-practices-for-maintainable-programming/)
