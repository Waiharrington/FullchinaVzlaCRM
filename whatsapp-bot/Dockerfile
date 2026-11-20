FROM node:22-bookworm-slim
ENV NODE_ENV=production
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends chromium ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0 libatk1.0-0 libcups2 libdbus-1-3 libdrm2 libgbm1 libgtk-3-0 libnss3 libx11-xcb1 libxcomposite1 libxdamage1 libxrandr2 xdg-utils && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
COPY scripts/patch-whatsapp-web.js ./scripts/patch-whatsapp-web.js
RUN npm install --omit=dev
RUN node scripts/patch-whatsapp-web.js
COPY index.js queue.js ./
RUN mkdir -p /data/session
EXPOSE 3033 3034
HEALTHCHECK --interval=30s --timeout=15s --start-period=180s --retries=5 CMD node -e "fetch('http://127.0.0.1:3034/health').then(async r => { if (!r.ok) process.exit(1); const h = await r.json(); process.exit(h.connected ? 0 : 1) }).catch(() => process.exit(1))"
CMD ["npm", "start"]
