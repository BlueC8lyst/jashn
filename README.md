# Jashn (جشن / जश्न) — Celebration & Event Planner

> A production-grade, GenAI-powered celebration planning assistant designed for weddings, milestone birthdays, and community events. Jashn turns high-level event ideas into honest budget projections, dependency-aware timelines, vendor checklists, and personalized concepts — and intelligently re-plans when real-world constraints change.

Built for **Challenge 5: Celebration & Event Planner**.

---

## 🌟 Key Features

### 1. "Ask Before Planning" Wizard
- **Conversational Onboarding**: Structured 4-step wizard that captures event type, target date, guest count, total budget, vibe/atmosphere, top priority categories, accessibility accommodations, and cultural or family traditions.
- **Instant Feasibility & Headroom**: Calculates per-guest spend and reserve contingency budgets upfront, preventing under-budgeted surprises.

### 2. Honest Budgeting & What-If Scenarios
- **Priority-Weighted Allocation**: Distributes funds across essential categories (venue, catering, decor, photography, entertainment, etc.) while safeguarding user-designated priorities.
- **Dynamic Trade-Off Engine**: When budgets are trimmed or guest counts rise, the engine evaluates realistic options:
  - *Protect Priorities*: Cuts non-essential categories to keep top priorities intact.
  - *Spread Evenly*: Uniform proportional adjustments.
  - *Trim Guest Count*: Computes the exact guest reduction required to preserve quality.
  - *Raise Budget*: Shows the exact monetary shortfall needed to maintain standards.
  - *Reinvest Surplus*: Suggests smart allocations for unexpected savings.

### 3. Dependency-Aware Timeline
- **Topological Scheduling**: Tasks are scheduled backwards from the event date based on realistic vendor lead times, with dependency chains (e.g., booking venue before caterer).
- **Critical Path Tracking**: Visual flags for overdue tasks, upcoming milestones, and completed steps.
- **Calendar Integration**: One-click `.ics` calendar export for synching deadlines with Google Calendar, Apple Calendar, or Outlook.

### 4. Vendor Management & Quote Intelligence
- **"Before You Contact" Checklist**: Category-specific preparation advice to prevent premature or uninformed inquiries.
- **Tailored Vendor Interview Questions**: GenAI-assisted questions customized to the occasion, accessibility needs, and cultural traditions (with deterministic offline fallbacks).
- **Quote Comparison Engine**: Normalizes flat fees, per-guest rates, and hourly pricing to actual total cost.
- **Risk & Ambiguity Flags**: Automatically detects and warns about missing tax specifications, ambiguous overtime policies, and unpriced extras.
- **Smart Paste/Raw Text Extraction**: Heuristic and AI parsing of messy vendor quotes and email snippets directly into structured proposals.

### 5. Personalized Celebration Ideas
- **3 Distinct Concept Directions**: Generates contrasting themes tailored to the event vibe, guest scale, and cultural traditions.
- **Family & Accessibility Adaptations**: Concrete guidance on multi-generational comfort and accessibility inclusions.
- **Interactive Refinement**: Fine-tune concepts through natural feedback or interactive clarifying questions.
- **Chosen Direction**: Lock in a concept to guide theme, palette, and budget priorities across the entire dashboard.

### 6. Dynamic Re-Planning Without Data Loss
- Real life changes dates, budgets, and guest counts. Jashn re-calculates timeline deadlines and budget allocations from where you currently are **without resetting finished tasks, custom items, or already-booked vendor quotes**.

---

## ⚡ Performance & Efficiency

Jashn is engineered for sub-millisecond execution and minimal memory overhead. The core domain logic has **zero third-party runtime dependencies**:

| Domain Operation | Throughput | Mean Latency | Allocation Profile |
| :--- | :--- | :--- | :--- |
| **`summariseBudget`** | **> 1,000,000 ops/sec** | **0.0011 ms** | Single-pass accumulator |
| **`compareQuotes`** | **> 580,000 ops/sec** | **0.0020 ms** | Zero allocations per quote |
| **`date maths`** | **> 160,000 ops/sec** | **0.0070 ms** | Fast string slicing (no heap arrays) |
| **`heuristicParseQuote`** | **> 72,000 ops/sec** | **0.0157 ms** | Single-pass regex extraction |
| **`evaluateScenario`** | **> 23,000 ops/sec** | **0.0456 ms** | In-memory priority weighting |
| **`computeSchedule`** | **> 10,000 ops/sec** | **0.1049 ms** | Topological sort (22 template tasks) |

---

## 🏗️ Architecture

```
jashn/
├── app/                     # Next.js App Router
│   ├── api/ai/              # Serverless GenAI endpoint with rate limiting & caching
│   ├── plan/                # Overview dashboard & active direction
│   │   ├── budget/          # Allocation table, priority sliders, & What-If scenarios
│   │   ├── timeline/        # Scheduled task list, status toggles, & ICS export
│   │   ├── vendors/         # Checklists, AI interview questions, & quote comparison
│   │   └── ideas/           # Concept generator, feedback refinement, & preferences
│   ├── start/               # "Ask before planning" multi-step onboarding wizard
│   ├── globals.css          # Design system (fluid typography, dark/light theme, accessible tokens)
│   ├── layout.tsx           # Root layout with CSP & security headers
│   └── proxy.ts             # Reverse proxy & CSP nonce injector
├── components/planner/      # Accessible UI components (VendorQuestionsPanel, Shell, Modals)
├── lib/
│   ├── domain/              # Pure TypeScript business logic (0 dependencies)
│   │   ├── budget.ts        # Budget calculations & headroom
│   │   ├── dates.ts         # High-efficiency ISO-8601 date arithmetic
│   │   ├── quotes.ts        # Quote comparison & ambiguity detection
│   │   ├── scenarios.ts     # Trade-off evaluation engine
│   │   ├── schedule.ts      # Topological timeline scheduler
│   │   ├── catalog/         # Default task & vendor templates for 3 event types
│   │   └── store/           # Reactive browser store (useSyncExternalStore + localStorage)
│   └── server/ai/           # GenAI prompt engineering, sanitization, & rate limiter
└── tests/                   # 18 test suites (160 tests + microsecond benchmarks)
```

### Safety & Resilience
- **Deterministic Offline Fallback**: All AI features function completely offline without an API key, providing rich built-in suggestions with clear UI transparency.
- **Bounded In-Memory Caching & FIFO Eviction**: Protects serverless memory against exhaustion.
- **Streaming Guardrails**: Bounded byte-stream limits and payload sanitization prevent prompt injection and oversized payloads.
- **Accessibility**: 100% keyboard navigable, semantic HTML5 landmarks, native dialogs with proper focus traps, and WCAG 2.1 AA color contrast compliance.

---

## 🚀 Quick Start

### Prerequisites
- Node.js `>= 20.9.0`
- npm `>= 10.0.0`

### Installation
```bash
git clone <repo-url>
cd jashn
npm install
```

### Development
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Verification & Quality Suite

Run all quality checks (ESLint + TypeScript + Vitest):
```bash
npm run check
```

Run unit and integration test suite:
```bash
npm test
```

Run microsecond performance benchmarks:
```bash
npm run bench
```

Build production bundle:
```bash
npm run build
```

---

## 🌐 Deployment to Vercel

1. Push this repository to GitHub/GitLab.
2. Import the project into [Vercel](https://vercel.com).
3. (Optional) Set the `GEMINI_API_KEY` environment variable in **Project Settings > Environment Variables** for live GenAI generation.
4. Deploy! Vercel will automatically run `npm run build` using Next.js Turbopack.

---

## 📄 License
MIT
