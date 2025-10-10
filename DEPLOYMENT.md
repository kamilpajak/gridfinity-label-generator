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
docker run -p 8081:80 -e ORIGIN=http://localhost:8081 gridscribe-test

# Test in browser
open http://localhost:8081
```

---

## 📦 Push to GitHub Container Registry

### 1. Login to ghcr.io

```bash
# Create GitHub Personal Access Token with write:packages permission
# Then login:
echo $GITHUB_TOKEN | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

### 2. Build and tag image

```bash
# Build with tags
docker build -t ghcr.io/YOUR_GITHUB_USERNAME/gridscribe:latest .
docker build -t ghcr.io/YOUR_GITHUB_USERNAME/gridscribe:v1.0.0 .
```

### 3. Push to registry

```bash
docker push ghcr.io/YOUR_GITHUB_USERNAME/gridscribe:latest
docker push ghcr.io/YOUR_GITHUB_USERNAME/gridscribe:v1.0.0
```

### 4. Verify

Visit: `https://github.com/YOUR_GITHUB_USERNAME?tab=packages`

**Important:** Make package public if you want to pull without authentication on VPS:
- Go to package settings
- Change visibility to "Public"

---

## 🖥️ VPS Deployment

### Initial deployment

```bash
# 1. SSH to VPS
ssh user@your-vps.com

# 2. Login to ghcr.io (if package is private)
echo $GITHUB_TOKEN | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin

# 3. Stop old container
docker stop storage-label-maker
docker rm storage-label-maker

# 4. Pull new image
docker pull ghcr.io/YOUR_GITHUB_USERNAME/gridscribe:latest

# 5. Run container
docker run -d \
  --name gridscribe \
  -p 8081:80 \
  -e NODE_ENV=production \
  -e PORT=80 \
  -e ORIGIN=https://gridfinitylabels.com \
  --restart unless-stopped \
  ghcr.io/YOUR_GITHUB_USERNAME/gridscribe:latest

# 6. Check logs
docker logs -f gridscribe

# 7. Test endpoint
curl http://localhost:8081

# 8. Cloudflare Tunnel will route traffic from gridfinitylabels.com
```

---

## 🔄 Update Deployment

When deploying new versions:

### On local machine

```bash
# Build with new version tag
docker build -t ghcr.io/YOUR_GITHUB_USERNAME/gridscribe:v1.1.0 .
docker push ghcr.io/YOUR_GITHUB_USERNAME/gridscribe:v1.1.0

# Update latest tag
docker tag ghcr.io/YOUR_GITHUB_USERNAME/gridscribe:v1.1.0 ghcr.io/YOUR_GITHUB_USERNAME/gridscribe:latest
docker push ghcr.io/YOUR_GITHUB_USERNAME/gridscribe:latest
```

### On VPS

```bash
# Pull latest
docker pull ghcr.io/YOUR_GITHUB_USERNAME/gridscribe:latest

# Restart container
docker stop gridscribe
docker rm gridscribe

docker run -d \
  --name gridscribe \
  -p 8081:80 \
  -e NODE_ENV=production \
  -e PORT=80 \
  -e ORIGIN=https://gridfinitylabels.com \
  --restart unless-stopped \
  ghcr.io/YOUR_GITHUB_USERNAME/gridscribe:latest
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

| Variable | Value | Description |
|----------|-------|-------------|
| `NODE_ENV` | `production` | Node environment |
| `PORT` | `80` | Internal container port |
| `ORIGIN` | `https://gridfinitylabels.com` | Public URL (for CORS/SvelteKit) |

Optional:

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `0.0.0.0` | Bind address (already set in Dockerfile) |
| `BODY_SIZE_LIMIT` | - | Request body size limit |

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

---

For detailed technical information, see [DOCKER_DEPLOYMENT_PLAN.md](./DOCKER_DEPLOYMENT_PLAN.md).
