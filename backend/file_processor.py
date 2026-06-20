import io
import logging

logger = logging.getLogger("hooman.files")

SUPPORTED_EXTENSIONS = {".pdf", ".txt", ".md", ".docx", ".csv"}


def extract_text(filename: str, data: bytes) -> str:
    ext = ("." + filename.lower().rsplit(".", 1)[-1]) if "." in filename else ""
    if ext in (".txt", ".md", ".csv"):
        return data.decode("utf-8", errors="ignore")
    if ext == ".pdf":
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(data))
        pages = [page.extract_text() or "" for page in reader.pages]
        return "\n\n".join(p.strip() for p in pages if p.strip())
    if ext == ".docx":
        from docx import Document
        doc = Document(io.BytesIO(data))
        return "\n\n".join(p.text for p in doc.paragraphs if p.text.strip())
    raise ValueError(f"Unsupported file type '{ext}'. Supported: {', '.join(sorted(SUPPORTED_EXTENSIONS))}")


def chunk_text(text: str, max_chars: int = 600) -> list[str]:
    paragraphs = [p.strip() for p in text.split("\n\n") if len(p.strip()) > 40]
    chunks: list[str] = []
    current = ""
    for para in paragraphs:
        if not current:
            current = para
        elif len(current) + len(para) + 2 <= max_chars:
            current += "\n\n" + para
        else:
            chunks.append(current)
            current = para
    if current:
        chunks.append(current)
    return chunks
