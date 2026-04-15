FROM nginx:alpine
COPY ./dist /usr/share/nginx/html
COPY ./nginx.conf.template /etc/nginx/conf.d/default.conf.template
COPY ./docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENV GATEWAY_HOST=host.docker.internal
ENV GATEWAY_WS_PORT=8787
ENV GATEWAY_REST_PORT=18790

EXPOSE 80
ENTRYPOINT ["/docker-entrypoint.sh"]