from contextlib import asynccontextmanager
from fastapi import FastAPI
from pydantic import BaseModel

from classify import ClassifierInput, ClassifierOutput, load_classifier, predict_tier
from anomaly import AnomalyInput, AnomalyOutput, load_autoencoder, detect_anomaly
from similarity import SimilarityInput, SimilarityOutput, check_similarity


# ---------------------------------------------------------------------------
# Model state — loaded once at startup
# ---------------------------------------------------------------------------

models: dict = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    models["classifier"] = load_classifier()
    models["autoencoder"] = load_autoencoder()
    yield
    models.clear()


app = FastAPI(title="DevGuard ML Sidecar", version="1.0.0", lifespan=lifespan)


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return {
        "status": "ok",
        "classifier_loaded": "classifier" in models,
        "autoencoder_loaded": "autoencoder" in models,
    }


# ---------------------------------------------------------------------------
# Feature 1 — Blast Radius Classifier (CodeBERT)
# ---------------------------------------------------------------------------

@app.post("/classify", response_model=ClassifierOutput)
def classify(body: ClassifierInput):
    return predict_tier(models["classifier"], body)


# ---------------------------------------------------------------------------
# Feature 2 — Anomaly Detector (Autoencoder)
# ---------------------------------------------------------------------------

@app.post("/anomaly", response_model=AnomalyOutput)
def anomaly(body: AnomalyInput):
    return detect_anomaly(models["autoencoder"], body)


# ---------------------------------------------------------------------------
# Feature 3 — Semantic Similarity / Duplicate Detection
# ---------------------------------------------------------------------------

@app.post("/similarity", response_model=SimilarityOutput)
def similarity(body: SimilarityInput):
    return check_similarity(body)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
