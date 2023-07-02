FROM postgres:latest

ENV POSTGRES_USER=admin
ENV POSTGRES_DB=homeworkapp

COPY update-scripts/*.sql /docker-entrypoint-initdb.d/update-scripts/

COPY entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/entrypoint.sh
ENTRYPOINT ["entrypoint.sh"]

EXPOSE 5432