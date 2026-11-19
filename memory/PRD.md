# NewsSearch — PRD

## Original problem statement
Build NewsSearch, a cloud-ready hybrid fake news analysis system for everyday readers, journalists, researchers, students, and fact-checkers. Responsive React/TypeScript web app (English-first, i18n-ready), Supabase Auth required before analysis, user-specific history protected by Postgres RLS. Python Flask JSON API with Gunicorn, scikit-learn TF-IDF + Logistic Regression baseline, Groq used only to explain predictions and summarize retrieved evidence grounded in actual records; worldwide multi-provider news and fact-check discovery, curated primary sources, source metadata, resilient provider failures, background ingestion, notifications, SSRF protection, restricted CORS, health/readiness checks, minimal history retention. ML prediction and external evidence tracks visually separate, no combined verdict. Oat sand #FDFBF7, charcoal #2C2A29, terracotta #C87965, olive #7D846C, Nunito, sharp edges, no shadows/gradients/emojis. Sign-in/registration, analysis, history, notifications, Terms + Privacy pages, Expo TypeScript clients for Android/iOS; inference on server; never fabricate.

## User choices
- Supabase (guided setup), Groq (user key), providers: keyless + Google Fact Check + NewsAPI, Nunito, one Expo codebase for web + iOS + Android, GitHub via "Save to GitHub".

## Architecture
- Backend `/app/backend`: Flask app (`server.py`) served by Gunicorn (supervisor `uvicorn` path is a wrapper exec'ing gunicorn). Modules: `supa.py` (JWT validation via Supabase Auth, PostgREST with user JWT → RLS; service-role only for jobs), `ml_model.py` + `train_model.py` (TF-IDF+LR, 6,335 docs, ~94% acc), `providers.py` (PolitiFact, EUvsDisinfo, Google Fact Check, AFP/Africa Check optional feed env, GDELT, Google News, NewsAPI; timeouts, cooldown circuit breaker, relevance filter, HTML stripping), `groq_client.py` (openai/gpt-oss-120b, grounded prompts), `ssrf.py`, `ingestion.py` (APScheduler: ingest every 20 min → evidence_pool + notifications; daily retention purge), `sources_data.py`.
- DB: Supabase Postgres, `supabase/schema.sql` (analyses, notifications, evidence_pool, profiles; RLS; 30-day expiry; 50-row trim; purge function).
- Frontend `/app/frontend`: Expo Router; tabs Analyze/Discover/History/Settings (NativeTabs on iOS 26+); screens sign-in, sign-up, analysis/[id], alerts, sources, terms, privacy. i18n in `src/i18n`.

## Implemented (2026-10-28)
- All above; tested iteration_1 (28/30 backend, all frontend flows). Fixed: CORS regex anchoring + methods, HTML in snippets, detail title, auth link stacking, design spacing/duplicate labels, PolitiFact feed URL, relevance filter.

## Implemented (2026-11-19) — iteration 2/3
- Search-based verdict (supported/contradicted/mixed/insufficient) from Groq grounded ONLY in retrieved records with validated citations; short claims searched verbatim. ML model demoted to "Language-pattern signal (experimental)" (no features/explanation, low-reliability flag for <80 words).
- Share links (signed-in viewers only): shared_analyses snapshot table, POST/GET/DELETE /api/analyses/<id>/share, GET /api/shared/<token> (service-role lookup), /shared/[token] screen, sign-in `next` return.
- Forgot/reset password (Supabase resetPasswordForEmail; web detectSessionInUrl, native deep link setSession/exchangeCode).
- i18n: en/es/fr/gu/hi (machine-translated by scripts/translate_i18n.py), device language + Settings switch, dayjs locales, AI verdict/summary in chosen language.
- History export: /api/export?format=csv|pdf (reportlab + Noto Sans Devanagari/Gujarati with HarfBuzz shaping).
- Fallback: without migration 002 the verdict/lang are stored in ml_features and normalized on read.
- PENDING USER ACTION: run supabase/002_verdict_share.sql (sharing returns 503 until then); add Redirect URLs (<preview>/reset-password, frontend://reset-password).

## Backlog
- P1: Additional locales (UI copy ready in `src/i18n`); AFP/Africa Check feed URLs once confirmed; GDELT backoff (frequently 429).
- P1: Password reset email flow.
- P2: Shareable public analysis link; export history (CSV/PDF); model retraining with newer datasets.
