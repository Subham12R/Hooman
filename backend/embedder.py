import logging
import numpy as np

logger = logging.getLogger("hooman.embedder")

_model = None


def _get_model():
    global _model
    if _model is None:
        from fastembed import TextEmbedding
        logger.info("Loading embedding model (first run — may download ~130MB)...")
        _model = TextEmbedding("BAAI/bge-small-en-v1.5")
        logger.info("Embedding model ready.")
    return _model


def embed(text: str) -> bytes:
    model = _get_model()
    vectors = list(model.embed([text]))
    return vectors[0].astype("float32").tobytes()


def cosine_similarity(a: bytes, b: bytes) -> float:
    if not a or not b:
        return 0.0
    va = np.frombuffer(a, dtype="float32")
    vb = np.frombuffer(b, dtype="float32")
    norm = np.linalg.norm(va) * np.linalg.norm(vb)
    if norm < 1e-9:
        return 0.0
    return float(np.dot(va, vb) / norm)
