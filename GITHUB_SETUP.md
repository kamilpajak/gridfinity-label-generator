# GitHub Branch Protection Setup Instructions

To complete the streamlined workflow setup, configure branch protection rules in GitHub:

## 1. Navigate to Repository Settings

1. Go to https://github.com/kamilpajak/gridfinity-label-generator
2. Click on "Settings" tab
3. Select "Branches" from the left sidebar

## 2. Create Branch Protection Rule

1. Click "Add rule"
2. Branch name pattern: `master`

## 3. Configure Protection Settings

Check the following options:

### ✅ Required Status Checks

- [x] Require status checks to pass before merging
- [x] Require branches to be up to date before merging
- Select these required checks:
  - `validate` (from the CI workflow)

### ❌ NO Pull Request Reviews

- [ ] DO NOT check "Require pull request reviews before merging"

### ✅ Additional Settings

- [x] Include administrators
- [x] Allow force pushes (by administrators only)
- [x] Allow deletions (optional, for cleanup)

### Optional but Recommended

- [x] Dismiss stale pull request approvals when new commits are pushed
- [x] Require conversation resolution before merging
- [x] Require signed commits (if you use GPG signing)

## 4. Save Changes

Click "Create" to save the protection rule.

## What This Achieves

- Ensures all code passes CI checks before reaching master
- Allows direct merges without PR approvals
- Maintains code quality through automated checks
- Simplifies workflow for single-developer projects

## Next Steps

1. Merge your current feature branch directly to master:

   ```bash
   git checkout master
   git merge feature/adjustable-label-dimensions
   git push origin master
   ```

2. Delete the feature branch:

   ```bash
   git branch -d feature/adjustable-label-dimensions
   git push origin --delete feature/adjustable-label-dimensions
   ```

3. Start using the new workflow for future changes!
