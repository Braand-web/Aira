FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg fonts-dejavu-core && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 10001 renderer && mkdir -p /data/jobs && chown renderer:renderer /data/jobs
WORKDIR /app
COPY server.py /app/server.py
USER renderer
ENV PORT=8080 RENDER_DATA=/data/jobs
EXPOSE 8080
CMD ["python", "/app/server.py"]
