# FNOL AI Agent — Auto Accident Intake

A two-sided claims automation platform that handles the full First Notice of Loss (FNOL) process for auto accidents — from policyholder intake to adjuster workspace — built to demonstrate AI product thinking in the insurance vertical.

**Built with:** React · Anthropic Claude API

---

## What it does

**Policyholder side**
A conversational AI agent named Alex guides the claimant through the full FNOL intake in natural language. Alex collects all required fields, presents a formatted summary for confirmation, and only generates a claim number once the claimant confirms everything is correct.

**Adjuster side**
The moment intake is complete, a fully structured case file populates automatically in the adjuster workspace — no manual entry, no data re-keying. Includes a claim summary, coverage flags identified during the conversation, and a full claims lifecycle timeline.

---

## Key features

- End-to-end FNOL intake via conversational AI
- Real-time structured data extraction from unstructured conversation
- Auto-populated adjuster workspace with coverage flags
- Adjuster workspace with Overview and Timeline tabs
- Auto-assignment to adjuster on intake completion
- Graceful edge case handling (missing policy number, injury escalation, no police report)

---

## Prompt architecture

The agent uses a structured system prompt with four components:

- **Role** — empathetic AI claims agent named Alex
- **Context** — structured intake session, not general support
- **Task** — collect 8 FNOL fields conversationally, one question at a time, with a strict closing sequence requiring claimant confirmation before generating a claim number
- **Constraints** — no em dashes or asterisks, short conversational responses, JSON extraction block appended after every response

The JSON extraction block runs silently in parallel to the conversation, populating the adjuster workspace in real time without the claimant seeing it.

---

## Data collected

| Field | Description |
|---|---|
| Policyholder name | Full name of the claimant |
| Policy number | Insurance policy identifier |
| Accident date & time | When the incident occurred |
| Location | Where the incident occurred |
| Incident description | What happened in the claimant's own words |
| Other parties | Names and insurance of other parties involved |
| Injuries | Any injuries reported by claimant or others |
| Vehicle damage | Description of damage to the vehicle |
| Police report | Whether a report was filed and report number |

---

## Setup

```bash
npm create vite@latest fnol-agent -- --template react
cd fnol-agent
npm install
```

Add a `.env` file in the project root:

```
VITE_ANTHROPIC_KEY=your_anthropic_key_here
```

Replace the hardcoded API key in `App.tsx` with:
```js
import.meta.env.VITE_ANTHROPIC_KEY
```

Run locally:
```bash
npm run dev
```

---

## Context

Built independently to demonstrate deep product understanding of AI voice agent workflows in the insurance vertical, with specific focus on the FNOL intake process, structured data extraction, and adjuster handoff automation.

---

*Built by Relina Vas · Product Manager*
