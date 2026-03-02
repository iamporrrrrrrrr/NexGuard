"""
Feature 3 — Semantic Similarity / Duplicate Detection

Cosine similarity between new proposal embedding and all stored historical
proposal embeddings. Embeddings fetched live from ChromaDB (same collection
used by the RAG agent). No saved model — computed at runtime.

Threshold: 0.92 similarity score.
"""

import os
import chromadb
from openai import OpenAI
from pydantic import BaseModel

SIMILARITY_THRESHOLD = 0.92
CHROMA_COLLECTION = "proposals"

client = OpenAI()
chroma = chromadb.HttpClient(
    host=os.environ.get("CHROMA_HOST", "localhost"),
    port=int(os.environ.get("CHROMA_PORT", "8002")),
)


class ProposalText(BaseModel):
    summary: str
    diff: str
    files_to_modify: list[str]


class SimilarityInput(BaseModel):
    proposal: ProposalText


class SimilarityOutput(BaseModel):
    is_duplicate: bool
    similarity_score: float
    matched_proposal_id: str | None


def _embed(text: str) -> list[float]:
    """Embed text using text-embedding-3-small."""
    response = client.embeddings.create(model="text-embedding-3-small", input=text)
    return response.data[0].embedding


def check_similarity(body: SimilarityInput) -> SimilarityOutput:
    """Check if the proposal is a near-duplicate of any stored proposal."""
    text = (
        f"{body.proposal.summary}\n"
        f"{', '.join(body.proposal.files_to_modify)}\n"
        f"{body.proposal.diff[:2000]}"
    )
    embedding = _embed(text)

    try:
        collection = chroma.get_or_create_collection(
            CHROMA_COLLECTION,
            metadata={"hnsw:space": "cosine"},
        )
        if collection.count() == 0:
            return SimilarityOutput(is_duplicate=False, similarity_score=0.0, matched_proposal_id=None)

        results = collection.query(
            query_embeddings=[embedding],
            n_results=1,
            include=["distances", "ids"],
        )

        if not results["ids"][0]:
            return SimilarityOutput(is_duplicate=False, similarity_score=0.0, matched_proposal_id=None)

        # ChromaDB cosine distance: 0 = identical, 1 = orthogonal → similarity = 1 - distance
        distance = float(results["distances"][0][0])
        similarity = 1.0 - distance
        matched_id = results["ids"][0][0]

        return SimilarityOutput(
            is_duplicate=similarity >= SIMILARITY_THRESHOLD,
            similarity_score=similarity,
            matched_proposal_id=matched_id if similarity >= SIMILARITY_THRESHOLD else None,
        )

    except Exception as e:
        print(f"[similarity] ChromaDB error: {e}")
        return SimilarityOutput(is_duplicate=False, similarity_score=0.0, matched_proposal_id=None)
