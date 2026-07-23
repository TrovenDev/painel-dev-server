# node-pty precisa compilar um binding nativo — usa a imagem completa (não
# alpine/musl) com as ferramentas de build instaladas.
FROM node:22-bookworm

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --omit=dev

COPY src ./src

ENV WORKSPACE_PATH=/workspace
EXPOSE 4000

CMD ["node", "src/index.js"]
