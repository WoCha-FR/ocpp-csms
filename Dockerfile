# Stage 1: Build
FROM node:24-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Stage 2: Production
FROM node:24-alpine AS production
WORKDIR /app
COPY --from=build /app ./
EXPOSE 8080 8887
VOLUME [ "/datas", "/logs", "/config" ]
CMD ["node", "index.js"]
