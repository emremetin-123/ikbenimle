FROM postgres:17-bookworm

RUN apt-get update \
    && apt-get upgrade -y \
    && apt-get install -y --no-install-recommends ca-certificates curl jq restic sqlite3 tzdata \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /var/cache/apt/* \
    && rm -f /usr/local/bin/gosu

COPY backup.sh restore.sh /usr/local/bin/
RUN chmod 0555 /usr/local/bin/backup.sh /usr/local/bin/restore.sh

ENV TZ=Europe/Istanbul
ENTRYPOINT ["/usr/local/bin/backup.sh"]
