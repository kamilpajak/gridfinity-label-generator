# Codecov Setup Guide

This guide will help you set up Codecov for test coverage reporting.

## Steps

1. **Sign up for Codecov**

   - Go to [codecov.io](https://codecov.io)
   - Sign in with your GitHub account
   - Authorize Codecov to access your repositories

2. **Add your repository**

   - Navigate to the "Add repository" page
   - Find `gridfinity-label-generator` in the list
   - Click "Setup repo"

3. **Get your upload token**

   - Once the repo is added, you'll see a "Setup Instructions" page
   - Copy the upload token (it looks like a UUID)

4. **Add the token to GitHub Secrets**

   - Go to your repository on GitHub
   - Navigate to Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `CODECOV_TOKEN`
   - Value: Paste your upload token
   - Click "Add secret"

5. **Verify it's working**
   - The next time CI runs, it will upload coverage reports
   - You'll see coverage badges and reports on codecov.io
   - You can add a coverage badge to your README

## Optional: Add Coverage Badge to README

Once you have coverage data, you can add a badge to your README:

```markdown
[![codecov](https://codecov.io/gh/kamilpajak/gridfinity-label-generator/branch/master/graph/badge.svg?token=YOUR_TOKEN)](https://codecov.io/gh/kamilpajak/gridfinity-label-generator)
```

Replace `YOUR_TOKEN` with your actual token if the repo is private.

## Troubleshooting

- If coverage upload fails, check that the `CODECOV_TOKEN` secret is correctly set
- Ensure that `npm run test:coverage` generates coverage reports
- Check the CI logs for any error messages from the codecov action
