# Branch Protection Verification Checklist

## GitHub UI Updates (2025)

GitHub now offers two ways to protect branches:

1. **Classic Branch Protection Rules** (traditional method)
2. **Rulesets** (newer, more flexible approach)

Both methods are supported and can be used together. This guide focuses on the classic branch protection rules for single-developer workflow.

## Classic Branch Protection Rules

Go to Settings → Code and automation → Branches → Add rule (next to "Branch protection rules")

### ✅ Correct Settings for Single-Developer Workflow

#### 1. Branch Name Pattern

- Pattern: `master`

#### 2. Pull Request Settings

- [ ] **Require a pull request before merging**: ❌ UNCHECKED
  - Keep this disabled for single-developer workflow
  - If checked, additional sub-options appear:
    - [ ] Require approvals
    - [ ] Dismiss stale pull request approvals
    - [ ] Require review from Code Owners
    - [ ] Require approval of the most recent reviewable push

#### 3. Status Checks

- [x] **Require status checks to pass before merging**: ✅ CHECKED
- [x] **Require branches to be up to date before merging**: ✅ CHECKED
- Required checks:
  - [x] `validate` (from CI workflow)
  - [ ] `test-build` (should NOT be selected)

#### 4. Additional Requirements

- [ ] Require conversation resolution before merging
- [ ] Require signed commits
- [ ] Require linear history
- [ ] Require merge queue
- [ ] Require deployments to succeed

#### 5. Branch Restrictions

- [ ] Lock branch
- [x] Allow fork syncing (optional)
- [ ] Restrict who can push to matching branches
- [ ] Restrict pushes that create matching branches

#### 6. Rules Applied to Everyone Including Administrators

- [x] **Allow force pushes**: ✅ CHECKED
  - Select one:
    - [ ] Everyone
    - [x] Specify who can force push: Administrators
- [x] **Allow deletions**: Optional (✅ CHECKED)

#### 7. Bypass Settings for Automation

For the release workflow to work with branch protection:

1. Create a Personal Access Token (PAT) with admin permissions
2. Add it as repository secret `RELEASE_TOKEN`
3. The PAT allows the workflow to bypass branch protection
   See [RELEASE_TOKEN_SETUP.md](./RELEASE_TOKEN_SETUP.md) for detailed instructions

### ❌ Settings to AVOID for Single-Developer Workflow

These should remain UNCHECKED:

- [ ] Require a pull request before merging
- [ ] Require approvals
- [ ] Dismiss stale pull request approvals
- [ ] Require review from Code Owners
- [ ] Restrict who can push to matching branches
- [ ] Lock branch

## Alternative: GitHub Rulesets

For more advanced configurations, consider using GitHub Rulesets:

- Navigate to Settings → Code and automation → Rules → Rulesets
- Rulesets allow multiple rules to apply simultaneously
- Better visibility for all repository users
- More flexible layering with branch protection rules

## 🔍 Verification Steps

1. Test direct push to master:

   ```bash
   echo "test" >> README.md && git add README.md && git commit -m "test: verify branch protection" && git push origin master
   ```

2. Verify the `validate` workflow runs on push

3. Check that the release workflow executes successfully

4. If successful, revert the test:
   ```bash
   git revert HEAD && git push origin master
   ```

## Common Issues

1. **"Cannot push to protected branch"**: Ensure "Require a pull request" is unchecked
2. **CI not running**: Verify `validate` is listed in required status checks
3. **Can't force push**: Check "Allow force pushes" is enabled for administrators

## Notes

- As of 2025, GitHub maintains both classic branch protection and rulesets
- Rulesets and branch protection rules can layer together
- For single-developer workflows, classic branch protection is sufficient
- Consider rulesets for team environments or complex requirements
