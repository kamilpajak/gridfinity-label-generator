FROM python:3.12-slim

# OCP wheels need a few shared libs at runtime.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglu1-mesa libxrender1 libxext6 libsm6 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /work
COPY catalog/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

CMD ["python", "-c", "import build123d; print(build123d.__version__)"]
