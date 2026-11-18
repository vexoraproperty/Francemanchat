import os
import re
import logging

from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone

logger = logging.getLogger(__name__)

AI_MODEL = ("anthropic", "claude-sonnet-5-5")

SYSTEM_PROMPT = """You are the virtual assistant for Franceman Exportation LLP, a Nigerian agricultural export company founded in 2023 in Asaba, Delta State, serving international buyers, suppliers and business partners.
Facts you may use:
- Products and MOQ: Kola Nut (Ogun, Osun, Oyo; MOQ 500 kg), Bitter Kola (Cross River, Edo, Delta; MOQ 300 kg), Ginger (Kaduna - Kachia, Jaba; MOQ 1,000 kg), Turmeric (Plateau, Nasarawa, Benue; MOQ 1,000 kg), Hibiscus (Jigawa, Katsina, Kano; MOQ 1,000 kg), Sesame (Benue, Nasarawa, Jigawa; MOQ 5,000 kg), Raw Cashew Nuts (Kwara, Kogi, Oyo; MOQ 5,000 kg). Prices are on request.
- Order formats: sample crates 0.5-5 kg (48h, DHL or FedEx); bag orders 25-500 kg (5-7 days, jute or PP bags, air or LCL); container loads 20ft/40ft FCL (10-14 days, Apapa or Tin Can).
- Samples: 500g-2kg shipped DHL Express within 48 hours of confirmation, with lab certificate and origin record.
- Incoterms: FOB Apapa or CIF destination port; CFR on request. Documents (NEPC, Phyto, CoA, BL) emailed within 24h of loading.
- Payment: 30% TT advance, 70% against scanned BL. LC accepted from rated banks.
- Certifications: NEPC Export Registration, HACCP, ISO 22000, EU Phytosanitary, NAFDAC compliance, FDA documentation.
- Quotations within one business day. Website: https://francemann.com (quote: /quote, samples: /sample-request, contact: /contact).
Rules: be concise (max 4 sentences), professional and corporate. Never invent prices, stock levels, delivery dates or facts not listed. For quotes or anything you cannot answer, say a member of the export team will follow up. No emojis. Plain text only, no markdown."""


def match_keyword(text: str, quick_answers: list[dict]) -> dict | None:
    lowered = text.lower()
    for qa in quick_answers:
        if lowered.strip() == qa.get("label", "").lower():
            return qa
        for kw in qa.get("keywords", []):
            kw = kw.strip().lower()
            if kw and re.search(rf"\b{re.escape(kw)}\b", lowered):
                return qa
    return None


async def ai_reply(conversation_id: str, history: list[dict]) -> str:
    transcript = "\n".join(
        f"{'Customer' if m['sender_type'] == 'visitor' else 'Franceman'}: {m['text']}" for m in history[-14:]
    )
    chat = LlmChat(
        api_key=os.environ["EMERGENT_LLM_KEY"],
        session_id=f"conv-{conversation_id}",
        system_message=SYSTEM_PROMPT,
    ).with_model(*AI_MODEL)
    prompt = f"Conversation so far:\n{transcript}\n\nWrite the next reply from Franceman to the customer's latest message."
    out = []
    async for ev in chat.stream_message(UserMessage(text=prompt)):
        if isinstance(ev, TextDelta):
            out.append(ev.content)
        elif isinstance(ev, StreamDone):
            break
    return "".join(out).strip()
