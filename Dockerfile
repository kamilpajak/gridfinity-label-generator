# Stage 1: Build
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Serve
FROM nginx:alpine
# Ustaw zmienną środowiskową DEPLOY_URL wewnątrz kontenera
ENV DEPLOY_URL=https://gridfinitylabels.com/
# Kopiujemy wygenerowane pliki statyczne do katalogu serwującego Nginx
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
