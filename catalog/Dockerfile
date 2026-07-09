FROM python:3.12.13-slim

# OCP wheels need a few shared libs at runtime.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglu1-mesa libxrender1 libxext6 libsm6 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /work

# requirements.txt is the human-intent list (build123d, pytest).
# To add a dependency: edit requirements.txt, then regenerate the lock with
#   ./catalog/run python -m pip freeze > catalog/requirements.lock
# The pinned truth lives in requirements.lock, which is what the image installs.
COPY catalog/requirements.txt /tmp/requirements.txt
COPY catalog/requirements.lock /tmp/requirements.lock
RUN pip install --no-cache-dir -r /tmp/requirements.lock

CMD ["python", "-c", "import build123d; print(build123d.__version__)"]
