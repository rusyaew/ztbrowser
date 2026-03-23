FROM python:3.12-slim

WORKDIR /app

COPY micrus/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY micrus/demo.py .
COPY fixtures /fixtures

EXPOSE 3000

ENV PORT=3000
ENV DEMO_ROOT_CERT_PATH=/fixtures/demo-pki/root-cert.pem
ENV DEMO_LEAF_CERT_PATH=/fixtures/demo-pki/leaf-cert.pem
ENV DEMO_LEAF_KEY_PATH=/fixtures/demo-pki/leaf-key.pem

CMD ["python", "demo.py"]
