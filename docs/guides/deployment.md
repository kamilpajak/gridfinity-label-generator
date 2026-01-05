# 🚀 GridScribe Deployment Guide

Quick reference guide for deploying GridScribe to VPS using GitHub Container Registry and Docker.

---

## 📋 Prerequisites

- Docker installed locally and on VPS
- GitHub account with Personal Access Token (PAT) with `write:packages` permission
- VPS with Docker installed
- Cloudflare Tunnel configured (pointing to `localhost:8081`)

---

## 🔧 Local Build & Test

### Test application build

```bash
# Build the application
pnpm build

# Test locally on port 80
PORT=80 node build/index.js
```

### Test Docker build

```bash
# Build Docker image
docker build -t gridscribe-test .

# Run locally
docker run -p 8081:80 \
  -e ORIGIN=http://localhost:8081 \
  -e PUBLIC_MATOMO_URL=https://statistics.gridfinitylabels.com/ \
  -e PUBLIC_MATOMO_SITE_ID=1 \
  gridscribe-test

# Test in browser
open http://localhost:8081
```

---

## 📦 GitHub Container Registry (Automated)

### Automated builds via GitHub Actions

Docker images are automatically built and pushed when:

- **Push to `master`** → Builds `latest` and `sha-{short_sha}` tags
- **Pull Request** → Builds `pr-{number}` tag for testing

**Image tags created:**

- `ghcr.io/YOUR_USERNAME/gridfinity-label-generator:latest` (only from master)
- `ghcr.io/YOUR_USERNAME/gridfinity-label-generator:sha-abc1234` (every commit)
- `ghcr.io/YOUR_USERNAME/gridfinity-label-generator:pr-123` (pull requests)

**Verify builds:** Check [Actions tab](../../actions) after pushing to master.

### Make package public

After first build, make the package public:

1. Go to https://github.com/YOUR_USERNAME?tab=packages
2. Click on `gridfinity-label-generator` package
3. Package settings → Change visibility → Public

This allows pulling images without authentication on VPS.

---

## 🖥️ VPS Deployment

### Initial deployment

```bash
# 1. SSH to VPS
ssh user@your-vps.com

# 2. Stop old container (if exists)
docker stop gridscribe 2>/dev/null || true
docker rm gridscribe 2>/dev/null || true

# 3. Pull new image (using latest)
docker pull ghcr.io/YOUR_USERNAME/gridfinity-label-generator:latest

# 4. Record the SHA for rollback capability
DEPLOYED_SHA=$(docker inspect ghcr.io/YOUR_USERNAME/gridfinity-label-generator:latest \
  --format='{{index .RepoDigests 0}}' | cut -d'@' -f2 | cut -c1-12)
echo "Deployed SHA: $DEPLOYED_SHA" >> ~/gridscribe-deployments.log
echo "Deployed at: $(date)" >> ~/gridscribe-deployments.log

# 5. Run container
docker run -d \
  --name gridscribe \
  -p 8081:80 \
  -e NODE_ENV=production \
  -e PORT=80 \
  -e ORIGIN=https://gridfinitylabels.com \
  -e PUBLIC_MATOMO_URL=https://statistics.gridfinitylabels.com/ \
  -e PUBLIC_MATOMO_SITE_ID=1 \
  --restart unless-stopped \
  ghcr.io/YOUR_USERNAME/gridfinity-label-generator:latest

# 6. Health check
sleep 5
if curl -f http://localhost:8081 > /dev/null 2>&1; then
  echo "✅ Deployment successful"
else
  echo "❌ Deployment failed - check logs"
  docker logs gridscribe
fi

# 7. Cloudflare Tunnel will route traffic from gridfinitylabels.com
```

---

## 🔄 Update Deployment

Updates are automatic via GitHub Actions. Just merge to `master` and the image will be built.

### On VPS

```bash
# 1. Pull latest image
docker pull ghcr.io/YOUR_USERNAME/gridfinity-label-generator:latest

# 2. Record SHA before updating (for potential rollback)
DEPLOYED_SHA=$(docker inspect ghcr.io/YOUR_USERNAME/gridfinity-label-generator:latest \
  --format='{{index .RepoDigests 0}}' | cut -d'@' -f2 | cut -c1-12)
echo "Updating to SHA: $DEPLOYED_SHA at $(date)" >> ~/gridscribe-deployments.log

# 3. Stop and remove old container
docker stop gridscribe
docker rm gridscribe

# 4. Run new version
docker run -d \
  --name gridscribe \
  -p 8081:80 \
  -e NODE_ENV=production \
  -e PORT=80 \
  -e ORIGIN=https://gridfinitylabels.com \
  -e PUBLIC_MATOMO_URL=https://statistics.gridfinitylabels.com/ \
  -e PUBLIC_MATOMO_SITE_ID=1 \
  --restart unless-stopped \
  ghcr.io/YOUR_USERNAME/gridfinity-label-generator:latest

# 5. Verify deployment
sleep 5
curl -f http://localhost:8081 && echo "✅ Update successful" || echo "❌ Update failed"
```

---

## ⏪ Rollback

If a deployment fails, you can rollback to a previous version using SHA tags.

### Find available versions

```bash
# View deployment history
cat ~/gridscribe-deployments.log

# Or check GitHub Container Registry
# Visit: https://github.com/YOUR_USERNAME/gridfinity-label-generator/pkgs/container/gridfinity-label-generator
```

### Rollback to specific SHA

```bash
# Use SHA from deployment log (e.g., sha-abc1234)
TARGET_SHA="sha-abc1234"

# Pull the specific version
docker pull ghcr.io/YOUR_USERNAME/gridfinity-label-generator:$TARGET_SHA

# Stop current container
docker stop gridscribe
docker rm gridscribe

# Run the previous version
docker run -d \
  --name gridscribe \
  -p 8081:80 \
  -e NODE_ENV=production \
  -e PORT=80 \
  -e ORIGIN=https://gridfinitylabels.com \
  -e PUBLIC_MATOMO_URL=https://statistics.gridfinitylabels.com/ \
  -e PUBLIC_MATOMO_SITE_ID=1 \
  --restart unless-stopped \
  ghcr.io/YOUR_USERNAME/gridfinity-label-generator:$TARGET_SHA

# Verify
curl -f http://localhost:8081 && echo "✅ Rollback successful"

# Log the rollback
echo "Rolled back to $TARGET_SHA at $(date)" >> ~/gridscribe-deployments.log
```

### Emergency rollback (last working version)

```bash
# Get the second-to-last SHA from logs
PREVIOUS_SHA=$(grep "Deployed SHA" ~/gridscribe-deployments.log | tail -2 | head -1 | awk '{print $3}')

echo "Rolling back to: $PREVIOUS_SHA"

docker pull ghcr.io/YOUR_USERNAME/gridfinity-label-generator:sha-$PREVIOUS_SHA
docker stop gridscribe && docker rm gridscribe
docker run -d --name gridscribe -p 8081:80 \
  -e NODE_ENV=production -e PORT=80 \
  -e ORIGIN=https://gridfinitylabels.com \
  -e PUBLIC_MATOMO_URL=https://statistics.gridfinitylabels.com/ \
  -e PUBLIC_MATOMO_SITE_ID=1 \
  --restart unless-stopped \
  ghcr.io/YOUR_USERNAME/gridfinity-label-generator:sha-$PREVIOUS_SHA
```

---

## 🛠️ Useful Commands

### Check container status

```bash
docker ps
docker ps -a  # including stopped containers
```

### View logs

```bash
docker logs gridscribe
docker logs -f gridscribe  # follow logs
docker logs --tail 100 gridscribe  # last 100 lines
```

### Container info

```bash
docker inspect gridscribe
docker stats gridscribe  # resource usage
```

### Cleanup

```bash
# Remove old images
docker image prune -a

# Remove stopped containers
docker container prune

# Full cleanup
docker system prune -a
```

---

## 🔍 Troubleshooting

### Container won't start

```bash
# Check logs
docker logs gridscribe

# Check if port 8081 is already in use
lsof -i :8081
netstat -tulpn | grep 8081
```

### Application errors

```bash
# Check environment variables
docker inspect gridscribe | grep -A 10 "Env"

# Access container shell
docker exec -it gridscribe sh

# Check inside container
docker exec gridscribe ls -la /app
docker exec gridscribe cat /app/package.json
```

### Image pull issues

```bash
# Re-login
echo $GITHUB_TOKEN | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin

# Verify package visibility (should be public or you must be logged in)
```

### Cloudflare Tunnel not working

```bash
# Verify container is listening on 8081
curl http://localhost:8081

# Check Cloudflare Tunnel status
# (depends on your tunnel setup - cloudflared service)
systemctl status cloudflared
```

---

## 📝 Environment Variables

Required environment variables for the container:

| Variable   | Value                          | Description                     |
| ---------- | ------------------------------ | ------------------------------- |
| `NODE_ENV` | `production`                   | Node environment                |
| `PORT`     | `80`                           | Internal container port         |
| `ORIGIN`   | `https://gridfinitylabels.com` | Public URL (for CORS/SvelteKit) |

Analytics (optional but recommended):

| Variable                | Value                                      | Description          |
| ----------------------- | ------------------------------------------ | -------------------- |
| `PUBLIC_MATOMO_URL`     | `https://statistics.gridfinitylabels.com/` | Matomo analytics URL |
| `PUBLIC_MATOMO_SITE_ID` | `1`                                        | Matomo site ID       |

Optional:

| Variable          | Default   | Description                              |
| ----------------- | --------- | ---------------------------------------- |
| `HOST`            | `0.0.0.0` | Bind address (already set in Dockerfile) |
| `BODY_SIZE_LIMIT` | -         | Request body size limit                  |

---

## ✅ Deployment Checklist

- [ ] Application builds successfully locally (`pnpm build`)
- [ ] Docker image builds successfully
- [ ] Image pushed to ghcr.io
- [ ] Package visibility set correctly (public/private)
- [ ] Old container stopped and removed on VPS
- [ ] New container running on VPS
- [ ] Container logs show no errors
- [ ] `curl http://localhost:8081` works on VPS
- [ ] Application accessible via `https://gridfinitylabels.com`
- [ ] All features work as expected

---

## 🔐 Security Notes

- GitHub Personal Access Token should have minimal permissions (`write:packages` only)
- Store tokens securely (use environment variables, not hardcoded)
- Consider using GitHub Actions for automated deployment
- Keep Docker images updated regularly
- Monitor container logs for security issues
