import asyncio
import json
import logging
import os
import re
import uuid

import httpx
from bs4 import BeautifulSoup
from fastapi import WebSocket

logger = logging.getLogger("hooman.research")

SERPER_URL = "https://google.serper.dev/search"
FETCH_TIMEOUT = 8
MAX_FETCH_PER_QUERY = 5
MAX_CONTENT_CHARS = 8000


async def _emit(websocket: WebSocket, session_id: str, request_id: str, stage: str, status: str, data: dict | None = None):
    payload = {
        "type": "trace",
        "stage": stage,
        "status": status,
        "session_id": session_id,
        "request_id": request_id,
    }
    if data:
        payload["data"] = data
    await websocket.send_json(payload)


async def _plan_queries(provider, query: str) -> list[str]:
    prompt = [
        {
            "role": "user",
            "content": (
                f"Generate 5 research queries covering: \n\n"
                "- Background\n"
                "- Recent developments\n"
                "- Technical details\n"
                "- Criticisms\n"
                "- Future outlook\n"
                "\nReturn JSON array only."
                f"Topic: {query}\n\n"
                "Return ONLY a JSON array of strings, nothing else. Example: [\"sub-query 1\", \"sub-query 2\"]"
            ),
        }
    ]
    chunks = []
    async for chunk in provider.generate(prompt):
        chunks.append(chunk)
    raw = "".join(chunks).strip()
    match = re.search(r'\[.*?\]', raw, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass
    return [query]


async def _search_serper(query: str) -> list[dict]:
    from database import get_user_setting
    serper_key = get_user_setting("serper_api_key", "") or os.getenv("SERPER_API_KEY", "")
    if not serper_key:
        logger.warning("SERPER_API_KEY not set — skipping web search")
        return []
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                SERPER_URL,
                json={"q": query, "num": 5},
                headers={"X-API-KEY": serper_key, "Content-Type": "application/json"},
            )
            resp.raise_for_status()
            data = resp.json()
            results = []
            for item in data.get("organic", []):
                results.append({
                    "title": item.get("title", ""),
                    "url": item.get("link", ""),
                    "snippet": item.get("snippet", ""),
                })
            return results
    except Exception as e:
        logger.warning(f"Serper search failed for '{query}': {e}")
        return []


async def _fetch_url(url: str) -> str:
    try:
        async with httpx.AsyncClient(timeout=FETCH_TIMEOUT, follow_redirects=True, headers={"User-Agent": "Mozilla/5.0"}) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "html.parser")
            for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
                tag.decompose()
            paragraphs = soup.find_all("p")
            text = " ".join(p.get_text(separator=" ", strip=True) for p in paragraphs)
            return text[:MAX_CONTENT_CHARS].strip()
    except Exception as e:
        logger.debug(f"Fetch failed for {url}: {e}")
        return ""


async def run_research_agent(websocket: WebSocket, session_id: str, request_id: str, query: str, provider):
    from database import save_message, save_chunk
    from embedder import embed

    # Stage 1: Plan
    await _emit(websocket, session_id, request_id, "plan", "running")
    sub_queries = await _plan_queries(provider, query)
    await _emit(websocket, session_id, request_id, "plan", "completed", {"queries": sub_queries})

    # Stage 2: Search
    await _emit(websocket, session_id, request_id, "search", "running")
    all_results: list[dict] = []
    search_tasks = [_search_serper(q) for q in sub_queries]
    search_batches = await asyncio.gather(*search_tasks)
    for q, results in zip(sub_queries, search_batches):
        all_results.extend(results)
        await _emit(websocket, session_id, request_id, "search", "completed", {
            "query": q,
            "results": results,
        })

    # Stage 3: Fetch
    await _emit(websocket, session_id, request_id, "fetch", "running")
    seen_urls: set[str] = set()
    fetched_docs: list[dict] = []

    fetch_candidates = []
    for r in all_results:
        url = r.get("url", "")
        if url and url not in seen_urls:
            seen_urls.add(url)
            fetch_candidates.append(r)
        if len(fetch_candidates) >= len(sub_queries) * MAX_FETCH_PER_QUERY:
            break

    fetch_tasks = [_fetch_url(r["url"]) for r in fetch_candidates]
    fetch_contents = await asyncio.gather(*fetch_tasks)
    for r, content in zip(fetch_candidates, fetch_contents):
        preview = content[:300] if content else r.get("snippet", "")
        fetched_docs.append({"url": r["url"], "title": r["title"], "content": content or r.get("snippet", ""), "snippet": r.get("snippet", "")})
        await _emit(websocket, session_id, request_id, "fetch", "completed", {
            "url": r["url"],
            "title": r["title"],
            "preview": preview,
        })

    # Stage 4: Synthesize
    await _emit(websocket, session_id, request_id, "synthesize", "running")

    has_web_results = bool(fetched_docs or all_results)

    if has_web_results:
        context_parts = []
        references = []
        # Prefer fully fetched docs; fall back to search snippets
        docs_to_use = fetched_docs if fetched_docs else [
            {"title": r["title"], "url": r["url"], "content": r.get("snippet", ""), "snippet": r.get("snippet", "")}
            for r in all_results[:8]
        ]
        for i, doc in enumerate(docs_to_use, 1):
            references.append(f"[{i}] {doc['title']} — {doc['url']}")
            context_parts.append(f"[{i}] Source: {doc['title']}\nURL: {doc['url']}\n{doc['content']}")

        context_block = "\n\n".join(context_parts)
        refs_block = "\n".join(references)

        synthesis_prompt = [
            {
                "role": "system",
                "content": (
                    "You are a research synthesizer. Write a clear, structured report answering the user's question. "
                    "You are a senior research analyst.\n\n"
                    "Requirements:\n"
                    "1. Executive Summary\n"
                    "2. Key Findings\n"
                    "3. Detailed Analysis\n"
                    "4. Contradictory Evidence\n"
                    "5. Conclusions\n"
                    "6. References\n"
                    "Cite every factual claim using [1], [2], etc.\n"
                    "Distinguish facts from interpretation.\n"
                    "End with a numbered References section. "
                    "Do not use emojis. Do not use em dashes. Use plain markdown with ## for section headers."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Research question: {query}\n\n"
                    f"Sources:\n{context_block}\n\n"
                    f"Write a comprehensive, well-structured answer with citations."
                ),
            },
        ]
    else:
        # No web results — answer from training knowledge, no fake citations
        refs_block = ""
        synthesis_prompt = [
            {
                "role": "system",
                "content": (
                    "You are a knowledgeable research assistant. Answer the question thoroughly and accurately "
                    "using your training knowledge. Structure the answer clearly with ## section headers. "
                    "Do not use emojis. Do not use em dashes. Do not claim to have searched the web."
                ),
            },
            {
                "role": "user",
                "content": f"Research question: {query}\n\nWrite a comprehensive, well-structured answer.",
            },
        ]

    full_response = ""
    async for chunk in provider.generate(synthesis_prompt):
        full_response += chunk
        await websocket.send_json({
            "type": "delta",
            "text": chunk,
            "session_id": session_id,
            "request_id": request_id,
        })

    final_report = full_response.strip()
    if refs_block and "References" not in final_report and "references" not in final_report.lower():
        final_report += f"\n\n## References\n{refs_block}"

    save_message(str(uuid.uuid4()), session_id, "assistant", final_report)

    await _emit(websocket, session_id, request_id, "synthesize", "completed")
    await websocket.send_json({
        "type": "done",
        "session_id": session_id,
        "request_id": request_id,
    })

    # Chunk and embed the report in background
    asyncio.create_task(_embed_report(session_id, final_report, embed, save_chunk))


async def _embed_report(session_id: str, report: str, embed_fn, save_chunk_fn):
    try:
        chunks = [p.strip() for p in report.split("\n\n") if len(p.strip()) > 80]
        for chunk_text in chunks:
            emb = embed_fn(chunk_text)
            save_chunk_fn(str(uuid.uuid4()), session_id, chunk_text, emb, source="research-report")
        logger.info(f"Embedded {len(chunks)} chunks for session {session_id}")
    except Exception as e:
        logger.warning(f"Embedding skipped: {e}")
