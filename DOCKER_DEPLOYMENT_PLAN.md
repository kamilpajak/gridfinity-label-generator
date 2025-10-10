# Plan Wdrożenia Docker na VPS

## 🎯 Główny cel

Przygotowanie aplikacji GridScribe do deploymentu jako kontener Docker na serwerze VPS z pełną automatyzacją i łatwym zarządzaniem.

---

## 📋 Wymagania funkcjonalne

### 1. **Konteneryzacja aplikacji**

- Dockerfile z multi-stage build (builder + production)
- Wykorzystanie pnpm jako package managera
- Optymalizacja rozmiaru finalnego image'a
- Poprawna konfiguracja SvelteKit adapter-node

### 2. **Zarządzanie deployment**

- GitHub Container Registry (ghcr.io) jako image registry
- Prosty `docker run` command (bez docker-compose)
- Konfiguracja zmiennych środowiskowych
- Skrypty automatyzujące deployment
- Dokumentacja procesu wdrożenia

### 3. **Produkcyjne ustawienia**

- Port exposure: **80 wewnątrz kontenera → 8081 na hoście** (zgodnie z istniejącą infrastrukturą)
- Health checks dla Docker
- Proper logging configuration
- Graceful shutdown handling
- Cloudflare Tunnel dla publicznego dostępu (gridfinitylabels.com)

---

## ⚙️ Wymagania techniczne

### 1. **Adapter SvelteKit**

⚠️ **KRYTYCZNE**: Zmiana adaptera z `adapter-auto` na `adapter-node`

**Obecna konfiguracja (svelte.config.js):**
```javascript
import adapter from '@sveltejs/adapter-auto';
```

**Wymagana konfiguracja:**
```javascript
import adapter from '@sveltejs/adapter-node';
```

**Instalacja:**
```bash
pnpm add -D @sveltejs/adapter-node
pnpm remove @sveltejs/adapter-auto
```

**Dlaczego?**
- `adapter-auto` nie działa w środowisku Docker
- `adapter-node` generuje standalone Node.js server
- Wymagane do produkcyjnego deploymentu

### 2. **Dockerfile - Multi-stage Build**

**Stage 1: Builder**
- Base image: `node:20-alpine` (lub nowszy)
- Instalacja pnpm globalnie
- Kopiowanie package.json + pnpm-lock.yaml
- `pnpm install --frozen-lockfile`
- Kopiowanie kodu źródłowego
- Uruchomienie `pnpm build`

**Stage 2: Production**
- Base image: `node:20-alpine`
- Instalacja tylko pnpm
- Kopiowanie built artifacts z stage 1
- Kopiowanie node_modules (production only)
- **Expose port 80** (zgodnie z istniejącą infrastrukturą)
- ENV: `PORT=80`, `HOST=0.0.0.0`
- CMD: `node build/index.js`

### 3. **.dockerignore**

Wykluczyć z context:
```
node_modules
.git
.svelte-kit
build
.env
.env.*
*.log
coverage
.playwright
test-results
.vscode
.idea
README.md
*.md
!DOCKER_DEPLOYMENT_PLAN.md
```

### 4. **GitHub Container Registry (ghcr.io)**

**Konfiguracja registry:**
```bash
# Login do GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Build i tag image'a
docker build -t ghcr.io/USERNAME/gridscribe:latest .
docker build -t ghcr.io/USERNAME/gridscribe:v1.0.0 .

# Push do registry
docker push ghcr.io/USERNAME/gridscribe:latest
docker push ghcr.io/USERNAME/gridscribe:v1.0.0
```

**Deployment command (VPS):**
```bash
# Stop i usuń stary kontener
docker stop storage-label-maker
docker rm storage-label-maker

# Pull i uruchom nowy kontener
docker pull ghcr.io/USERNAME/gridscribe:latest
docker run -d \
  --name gridscribe \
  -p 8081:80 \
  -e NODE_ENV=production \
  -e PORT=80 \
  -e ORIGIN=https://gridfinitylabels.com \
  --restart unless-stopped \
  ghcr.io/USERNAME/gridscribe:latest
```

### 5. **Zmienne środowiskowe**

**Wymagane:**
- `NODE_ENV=production`
- `PORT=80` (wewnętrzny port kontenera)
- `ORIGIN=https://gridfinitylabels.com` - adres URL aplikacji przez Cloudflare Tunnel (ważne dla CORS i SvelteKit)

**Opcjonalne:**
- `BODY_SIZE_LIMIT` - limit rozmiaru requestów
- `HOST=0.0.0.0` - binding do wszystkich interfejsów (domyślnie ustawione w Dockerfile)

### 6. **Static Assets**

- Katalog `/static` kopiowany podczas build
- Serwowane przez SvelteKit adapter-node
- Skrypty pre-build (`build-standards`) uruchamiane podczas Docker build

### 7. **Build Scripts**

Kolejność wykonania w Dockerfile:
1. `pnpm install --frozen-lockfile`
2. `pnpm build-standards` (jeśli potrzebne przed głównym buildem)
3. `pnpm build`

---

## 🔄 Workflow Deployment

### Przygotowanie lokalne:

```bash
# 1. Zmiana adaptera (adapter-auto → adapter-node) - DONE ✅
# 2. Utworzenie Dockerfile - DONE ✅
# 3. Utworzenie .dockerignore - DONE ✅

# 4. Test lokalny buildu
pnpm build
PORT=80 node build/index.js

# 5. Test Docker buildu lokalnie
docker build -t gridscribe-test .
docker run -p 8081:80 -e ORIGIN=http://localhost:8081 gridscribe-test

# 6. Weryfikacja działania
curl http://localhost:8081
# Lub otwórz w przeglądarce: http://localhost:8081
```

### Deployment do GitHub Container Registry:

```bash
# 1. Login do ghcr.io
echo $GITHUB_TOKEN | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin

# 2. Build z tagiem
docker build -t ghcr.io/YOUR_GITHUB_USERNAME/gridscribe:latest .
docker build -t ghcr.io/YOUR_GITHUB_USERNAME/gridscribe:v1.0.0 .

# 3. Push do registry
docker push ghcr.io/YOUR_GITHUB_USERNAME/gridscribe:latest
docker push ghcr.io/YOUR_GITHUB_USERNAME/gridscribe:v1.0.0

# 4. Weryfikacja
# Sprawdź na: https://github.com/YOUR_GITHUB_USERNAME?tab=packages
```

### Deployment na VPS:

```bash
# 1. Login na VPS
ssh user@your-vps.com

# 2. Login do ghcr.io (jeśli image jest private)
echo $GITHUB_TOKEN | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin

# 3. Stop starego kontenera
docker stop storage-label-maker
docker rm storage-label-maker

# 4. Pull nowego image'a
docker pull ghcr.io/YOUR_GITHUB_USERNAME/gridscribe:latest

# 5. Uruchom nowy kontener
docker run -d \
  --name gridscribe \
  -p 8081:80 \
  -e NODE_ENV=production \
  -e PORT=80 \
  -e ORIGIN=https://gridfinitylabels.com \
  --restart unless-stopped \
  ghcr.io/YOUR_GITHUB_USERNAME/gridscribe:latest

# 6. Sprawdź logi
docker logs -f gridscribe

# 7. Test endpointu
curl http://localhost:8081

# 8. Cloudflare Tunnel automatycznie przekieruje ruch z gridfinitylabels.com
```

### Update deployment (kolejne wersje):

```bash
# Na lokalnej maszynie:
docker build -t ghcr.io/YOUR_GITHUB_USERNAME/gridscribe:v1.1.0 .
docker push ghcr.io/YOUR_GITHUB_USERNAME/gridscribe:v1.1.0
docker tag ghcr.io/YOUR_GITHUB_USERNAME/gridscribe:v1.1.0 ghcr.io/YOUR_GITHUB_USERNAME/gridscribe:latest
docker push ghcr.io/YOUR_GITHUB_USERNAME/gridscribe:latest

# Na VPS:
docker pull ghcr.io/YOUR_GITHUB_USERNAME/gridscribe:latest
docker stop gridscribe
docker rm gridscribe
docker run -d --name gridscribe -p 8081:80 \
  -e NODE_ENV=production -e PORT=80 \
  -e ORIGIN=https://gridfinitylabels.com \
  --restart unless-stopped \
  ghcr.io/YOUR_GITHUB_USERNAME/gridscribe:latest
```

---

## 📦 Struktura plików deployment

```
/
├── Dockerfile                    # Multi-stage build definition ✅
├── .dockerignore                 # Wykluczenia z build context ✅
├── DOCKER_DEPLOYMENT_PLAN.md    # Ten dokument ✅
└── scripts/
    └── deploy.sh                 # Opcjonalny skrypt automatyzacji (TODO)
```

**Uwaga:** docker-compose.yml NIE jest potrzebny - używamy prostego `docker run` zgodnie z istniejącym pattern.

---

## ⚠️ Krytyczne punkty uwagi

### 1. **Adapter MUSI być zmieniony**
- Bez adapter-node aplikacja nie będzie działać
- adapter-auto nie rozpoznaje środowiska Docker jako znanej platformy

### 2. **pnpm w Dockerze**
- Standardowy obraz Node nie ma pnpm
- Trzeba zainstalować: `npm install -g pnpm`
- Lub użyć obrazu z pnpm (np. `pnpm/node:20-alpine` jeśli dostępny)

### 3. **ORIGIN environment variable**
- SvelteKit wymaga `ORIGIN` w produkcji
- Ustawić na właściwy adres URL aplikacji
- Błędna wartość = problemy z CORS/routing

### 4. **Port binding**
- Aplikacja nasłuchuje na porcie z ENV (`PORT=80`)
- Docker mapping: `-p 8081:80` (host 8081 → container 80)
- **Zgodne z istniejącą infrastrukturą** (port 8081 na hoście)

### 5. **Health checks**
- Docker może sprawdzać `/` endpoint
- SvelteKit automatycznie odpowiada na główny route
- Nie trzeba tworzyć custom health endpoint

---

## 🔧 Opcjonalne rozszerzenia

### 1. **Nginx Reverse Proxy**

**W tej konfiguracji: NIE POTRZEBNE** ✅

**Powody:**
- ✅ Cloudflare Tunnel obsługuje SSL/TLS termination
- ✅ Cloudflare Tunnel obsługuje routing i proxy
- ✅ Uproszczona infrastruktura
- ✅ Zgodne z obecnym setupem (stara aplikacja też nie używa nginx)

**Kiedy BYŁOBY potrzebne:**
- Hosting wielu aplikacji bez Cloudflare Tunnel
- Load balancing (przyszłość)
- Zaawansowane caching strategie

### 2. **Volume dla persistence**

Obecna aplikacja nie wymaga wolumenów (stateless), ale można dodać:
```yaml
volumes:
  - ./logs:/app/logs  # Jeśli aplikacja pisze logi do pliku
```

### 3. **Deployment automation**

Skrypt `deploy.sh`:
```bash
#!/bin/bash
git pull origin docker-deployment
docker compose down
docker compose up -d --build
docker compose logs -f
```

### 4. **CI/CD Pipeline**

- GitHub Actions
- Automatyczny build przy push
- Deploy na VPS przez SSH
- Rolling updates bez downtime

---

## ✅ Definicja sukcesu

Deployment będzie uznany za udany, gdy:

1. ✅ Aplikacja buduje się w kontenerze Docker bez błędów
2. ✅ Kontener uruchamia się i odpowiada na porcie 3000
3. ✅ Wszystkie funkcjonalności działają (UI, generowanie PNG, batch mode)
4. ✅ Aplikacja automatycznie restartuje się po restarcie VPS
5. ✅ Proces deployment jest udokumentowany i powtarzalny
6. ✅ Logi są dostępne i czytelne (`docker compose logs`)
7. ✅ Zużycie zasobów jest akceptowalne (RAM, CPU, storage)

---

## 📝 Kolejność implementacji

### Krok 1: Adapter Configuration ⚠️ NAJPIERW
- [ ] Instalacja `@sveltejs/adapter-node`
- [ ] Usunięcie `@sveltejs/adapter-auto`
- [ ] Zmiana w `svelte.config.js`
- [ ] Test lokalny: `pnpm build && node build/index.js`

### Krok 2: Docker Files
- [ ] Utworzenie `Dockerfile` z multi-stage build
- [ ] Utworzenie `.dockerignore`
- [ ] Test: `docker build -t gridscribe .`

### Krok 3: Docker Compose
- [ ] Utworzenie `docker-compose.yml`
- [ ] Utworzenie `.env.example`
- [ ] Test: `docker compose up`

### Krok 4: Dokumentacja
- [ ] Instrukcje deployment w README (lub osobny plik)
- [ ] Troubleshooting guide
- [ ] Environment variables documentation

### Krok 5: VPS Deployment
- [ ] Transfer plików na VPS
- [ ] Konfiguracja środowiska
- [ ] Uruchomienie kontenera
- [ ] Weryfikacja działania

### Krok 6: Finalizacja
- [ ] Monitoring setup (opcjonalnie)
- [ ] Backup strategy (opcjonalnie)
- [ ] Nginx setup (jeśli potrzebne)
- [ ] SSL certificates (jeśli potrzebne)

---

## 🎓 Wnioski z analizy

**Błędy w początkowym planie:**
1. ❌ Brak informacji o zmianie adaptera (KRYTYCZNE)
2. ❌ Brak uwzględnienia pnpm w Dockerze
3. ❌ Przecenianie roli nginx (opcjonalne, nie wymagane)
4. ❌ Niepotrzebny custom health check endpoint
5. ❌ Brak uwagi na skrypty pre-build (`build-standards`)

**Poprawki:**
1. ✅ Adapter-node jako pierwszy priorytet
2. ✅ Explicit pnpm installation w Dockerfile
3. ✅ Nginx jako opcja, nie requirement
4. ✅ Wykorzystanie istniejących endpoints do health checks
5. ✅ Uwzględnienie custom build scripts

**Ten plan jest kompletny i gotowy do implementacji.**
