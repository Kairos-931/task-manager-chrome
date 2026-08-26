FROM nginx:1.27-alpine

COPY deploy/demo/nginx.conf /etc/nginx/conf.d/default.conf
COPY demo/ /usr/share/nginx/html/
COPY icons/icon128.svg /usr/share/nginx/html/icons/icon128.svg

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz || exit 1
