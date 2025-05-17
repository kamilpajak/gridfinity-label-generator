# Release Token Setup Guide

This guide explains how to create and configure a Personal Access Token (PAT) for the release workflow to bypass branch protection rules.

## Why is this needed?

The release workflow needs to push version bump commits to the protected `master` branch. Since branch protection requires the `validate` status check to pass, and this check only runs after a push, we need a token that can bypass these protection rules.

## Steps to Create the Token

1. Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)

   - Or navigate directly to: https://github.com/settings/tokens

2. Click "Generate new token" → "Generate new token (classic)"

3. Configure the token:

   - **Note**: `Release Workflow Token` (or similar descriptive name)
   - **Expiration**: Choose based on your security requirements (90 days recommended)
   - **Scopes**: Select the following permissions:
     - [x] `repo` (Full control of private repositories)
     - [x] `workflow` (Update GitHub Action workflows)

4. Click "Generate token" at the bottom

5. **IMPORTANT**: Copy the token immediately (it won't be shown again)

## Add Token to Repository Secrets

1. Go to your repository: https://github.com/kamilpajak/gridfinity-label-generator

2. Navigate to Settings → Secrets and variables → Actions

3. Click "New repository secret"

4. Create the secret:

   - **Name**: `RELEASE_TOKEN`
   - **Secret**: Paste the token you copied

5. Click "Add secret"

## Workflow Configuration

The release workflow is already configured to use this token:

```yaml
- uses: actions/checkout@v3
  with:
    token: ${{ secrets.RELEASE_TOKEN || secrets.GITHUB_TOKEN }}
```

This configuration:

- Uses `RELEASE_TOKEN` if available
- Falls back to `GITHUB_TOKEN` if not set
- The PAT allows pushing to protected branches

## Security Best Practices

1. **Limit Token Scope**: Only grant the minimum permissions needed
2. **Set Expiration**: Use short-lived tokens when possible
3. **Rotate Regularly**: Update the token periodically
4. **Monitor Usage**: Check token usage in GitHub settings
5. **Never Commit Tokens**: Always use GitHub Secrets

## Troubleshooting

### Error: "Repository rule violations found"

- Ensure the PAT has admin permissions on the repository
- Verify the token is correctly added as `RELEASE_TOKEN` secret

### Error: "Authentication failed"

- Check if the token has expired
- Ensure the token is correctly copied (no extra spaces)
- Verify the secret name matches `RELEASE_TOKEN`

### Error: "Insufficient permissions"

- The token needs the `repo` scope for full repository access
- If updating workflows, also needs the `workflow` scope

## Alternative: GitHub App

For production environments, consider using a GitHub App instead of a PAT:

- Better security through fine-grained permissions
- No expiration management
- Audit trail for all actions

See [GitHub Apps documentation](https://docs.github.com/en/apps) for more information.
