# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS dev
RUN mkdir -p /workspace /workspace/node_modules /home/node/.npm \
    && chown -R node:node /workspace /home/node
WORKDIR /workspace
COPY --chown=node:node package.json package-lock.json ./
USER node
RUN --mount=type=cache,target=/home/node/.npm,uid=1000,gid=1000 npm ci --prefer-offline --no-audit --no-fund
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
