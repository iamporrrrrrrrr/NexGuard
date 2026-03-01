FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY . .

# Pre-download CodeBERT tokenizer at build time (speeds up cold start)
# RUN python -c "from transformers import RobertaTokenizer; RobertaTokenizer.from_pretrained('microsoft/codebert-base')"

EXPOSE 8001

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
