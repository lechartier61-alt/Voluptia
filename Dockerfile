FROM node:22-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=10000
ENV VITE_API_URL=/api
ENV DATA_DIR=/app/data
ENV DATABASE_PATH=laccord_secret.sqlite

COPY package.json package-lock.json .npmrc ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json

# Render/Node 22 images can ship an npm 10.x build that sometimes exits with
# "Exit handler never called" during npm ci. Pin npm 11 before installing.
RUN npm install -g npm@11.15.0 --no-audit --no-fund && npm --version
RUN npm ci --include=dev --no-audit --no-fund --prefer-online

COPY backend ./backend
COPY frontend ./frontend

RUN npm run build
RUN npm run check:backend-syntax
RUN npm prune --omit=dev
RUN mkdir -p /app/data

EXPOSE 10000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=5   CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||10000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npm", "run", "start:render"]
