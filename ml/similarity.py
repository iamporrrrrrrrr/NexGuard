"""
Feature 3 — Semantic Similarity / Duplicate Detection

Cosine similarity between new proposal embedding and all stored historical
proposal embeddings. Embeddings fetched live from ChromaDB (same collection
used by the RAG agent). No saved model — computed at runtime.

Threshold: 0.92 similarity score.
"""

import chromadb
from openai import OpenAI
from pydantic import BaseModel

SIMILARITY_THRESHOLD = 0.92
CHROMA_COLLECTION = "proposals"

client = OpenAI()
chroma = chromadb.PersistentClient(path="../chroma_db")


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
    """
    TODO:
    1. Call OpenAI embeddings API with text-embedding-3-small
    2. Return embedding vector
    """
    raise NotImplementedError


def check_similarity(body: SimilarityInput) -> SimilarityOutput:
    """
    TODO:
    1. Build text from proposal (summary + files + diff[:2000])
    2. Embed via _embed()
    3. Query ChromaDB collection for top-1 nearest neighbor
    4. ChromaDB returns distance (L2) — convert to cosine similarity
       OR use cosine distance directly: similarity = 1 - distance (if normalized)
    5. If similarity >= SIMILARITY_THRESHOLD → is_duplicate = True
    6. Return SimilarityOutput with matched_proposal_id from metadata
    """
    raise NotImplementedError
