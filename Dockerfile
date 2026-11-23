FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8080

COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY src ./src
COPY public ./public

EXPOSE 8080
USER node
CMD ["node", "src/server.js"]