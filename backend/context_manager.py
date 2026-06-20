import os
import asyncio
from typing import List, Dict, Tuple
from providers.registry import get_provider
from database import update_session_summary
from database import get_provider_config


TOKEN_BUDGET = 32000  
def estimate_tokens(text: str) -> int:
    return int(len(text.split()) * 1.3)

def build_context(
    messages: List[Dict], 
    existing_summary: str, 
    token_budget: int = TOKEN_BUDGET
) -> Tuple[List[Dict], List[Dict]]:
    """
    Fits messages into a token budget starting from the newest to the oldest.
    Returns:
        (active_messages, overflow_messages)
    """
    active_messages = []
    overflow_messages = []
    cumulative_tokens = 0
    
    # Traverse messages backwards (newest first)
    for msg in reversed(messages):
        msg_tokens = estimate_tokens(msg["content"])
        if cumulative_tokens + msg_tokens <= token_budget:
            cumulative_tokens += msg_tokens
            active_messages.insert(0, msg)
        else:
            # Older messages that don't fit go to overflow
            overflow_messages.insert(0, msg)
            
    return active_messages, overflow_messages

async def summarize_overflow(
    session_id: str, 
    existing_summary: str, 
    overflow_messages: List[Dict]
):
    """
    Sends overflowing messages to the active LLM provider in the background
    to compile them into a concise rolling summary, enforcing assignment constraints.
    """
    if not overflow_messages:
        return
     
    try:
        config = get_provider_config()

        if not config:
            print("No active provider configured")
            return

        provider = get_provider(provider_config=config)

    except Exception as e:
        print(f"Error resolving provider for background summarization: {e}")
        return
        
  
    messages_text = ""
    for msg in overflow_messages:
        role = "User" if msg["role"] == "user" else "Assistant"
        messages_text += f"{role}: {msg['content']}\n"
        
    if existing_summary:
        prompt = (
            f"Here is the existing summary of the older conversation:\n{existing_summary}\n\n"
            f"Here are the new messages that occurred after:\n{messages_text}\n"
            "Please generate an updated, concise summary of the overall conversation so far.\n"
        )
    else:
        prompt = (
            f"Here is the conversation text so far:\n{messages_text}\n"
            "Summarize the conversation preserving:\n\n"
            "- User goals\n"
            "- Uploaded files\n"
            "- Decisions made\n"
            "- Important facts\n"
            "- Open tasks\n"
            "- Technical details\n"
            "- Names of projects\n"
            "Do not remove information that may be useful in future responses."
        )
        
  
    prompt += (
        "\nCRITICAL: Absolutely NO emojis or emoticons. Never use 😊, 🙂, 🎉, ✅, ❌, or any other emoji.\n"
        "STRICT FORMATTING RULES:\n"
        "- Do NOT use emojis anywhere in your response.\n"
        "- Do NOT use em dashes anywhere in your response.\n"
    )
    
    summary_chunks = []
    try:
        
        async for chunk in provider.generate([{"role": "user", "content": prompt}]):
            summary_chunks.append(chunk)
            
        new_summary = "".join(summary_chunks).strip()
        
   
        update_session_summary(session_id, new_summary)
        print(f"Successfully updated rolling summary for session {session_id}")
    except Exception as e:
        print(f"Error in background summarization: {e}")
