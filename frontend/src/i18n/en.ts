// English-first dictionary. Adding a new locale later is a matter of adding a
// sibling file (e.g. ./fr.ts) and registering it in ./index.ts.
export const en: Record<string, string> = {
  // Common
  "common.appName": "NewsSearch",
  "common.tagline": "Hybrid fake news analysis",
  "common.cancel": "Cancel",
  "common.delete": "Delete",
  "common.confirm": "Confirm",
  "common.retry": "Retry",
  "common.loading": "Loading",
  "common.openSource": "Open source",
  "common.openLink": "Open link",
  "common.notAvailable": "Unavailable",

  // Auth
  "auth.signInTitle": "Welcome back",
  "auth.signInSubtitle": "Sign in to analyze claims and keep your history.",
  "auth.signUpTitle": "Create your account",
  "auth.signUpSubtitle": "Registration is required before running an analysis.",
  "auth.emailLabel": "Email",
  "auth.passwordLabel": "Password",
  "auth.confirmPasswordLabel": "Confirm password",
  "auth.signInButton": "Sign in",
  "auth.signUpButton": "Create account",
  "auth.signInSubmitting": "Signing in…",
  "auth.signUpSubmitting": "Creating account…",
  "auth.switchToSignUp": "New here? Create an account",
  "auth.switchToSignIn": "Already have an account? Sign in",
  "auth.termsPrompt": "By continuing, you agree to our Terms of Service and Privacy Policy.",
  "auth.checkEmailTitle": "Confirm your email",
  "auth.checkEmailBody": "We sent a confirmation link to your inbox. Confirm your email, then sign in.",
  "auth.notConfiguredTitle": "Supabase is not configured yet",
  "auth.notConfiguredBody":
    "Add your Supabase project URL and publishable key (secure key card in the builder, or frontend .env) to enable sign-in and registration.",
  "auth.passwordMismatch": "Passwords do not match.",
  "auth.passwordTooShort": "Password must be at least 6 characters.",

  // Tabs
  "tabs.analyze": "Analyze",
  "tabs.discover": "Discover",
  "tabs.history": "History",
  "tabs.settings": "Settings",

  // Analyze
  "analyze.title": "Analyze",
  "analyze.modeText": "Text",
  "analyze.modeUrl": "Article link",
  "analyze.textInputLabel": "Claim or article text",
  "analyze.textPlaceholder": "Paste the claim or the article text you want to review…",
  "analyze.urlInputLabel": "Article URL",
  "analyze.urlPlaceholder": "https://example.com/article",
  "analyze.submit": "Analyze",
  "analyze.submitting": "Analyzing…",
  "analyze.emptyInput": "Enter a claim, paste article text, or add an article link to begin.",
  "analyze.hintTitle": "How it works",
  "analyze.hintBody":
    "NewsSearch searches worldwide fact-checkers and news providers for your claim and gives a verdict based only on the records it finds, each one cited. A separate writing-style model is shown for reference only and is never part of the verdict.",
  "analyze.mlTrackTitle": "Automated model signal",
  "analyze.mlTrackSubtitle": "Statistical language-pattern classification",
  "analyze.mlUnavailable": "The baseline model is not available right now. The evidence review still works.",
  "analyze.mlLabelReal": "Likely authentic",
  "analyze.mlLabelFake": "Likely fabricated",
  "analyze.confidenceLabel": "Model confidence",
  "analyze.probabilityReal": "Real",
  "analyze.probabilityFake": "Fabricated",
  "analyze.topFeaturesTitle": "Most influential words",
  "analyze.explanationTitle": "Why the model decided this",
  "analyze.explanationAiNote": "AI-written from the model's actual output.",
  "analyze.explanationUnavailable": "AI explanation is unavailable right now.",
  "analyze.groqNotConfigured": "AI narratives are off — no Groq key is configured.",
  "analyze.evidenceTrackTitle": "External evidence review",
  "analyze.evidenceTrackSubtitle": "Records from worldwide fact-checking and news providers",
  "analyze.summaryTitle": "Evidence summary",
  "analyze.summaryUnavailable": "AI summary is unavailable right now.",
  "analyze.noEvidence": "No matching records were retrieved from providers.",
  "analyze.providerFailureNote": "Some providers were unavailable:",
  "analyze.evidenceFooter": "All retrieved records are listed so you can check the verdict yourself.",
  "analyze.separationNote": "The verdict comes only from the retrieved sources. The language-pattern signal is shown separately and is never part of the verdict.",
  "analyze.notSaved": "Analysis completed but not saved to history.",
  "analyze.persistedNote": "Saved to your history.",

  // Search-based verdict
  "verdict.title": "Search-based verdict",
  "verdict.subtitle": "Decided only from the fact-checks and news records found for this claim",
  "verdict.supported": "Likely real",
  "verdict.supportedBody": "Reputable sources report the same thing.",
  "verdict.contradicted": "Likely fake",
  "verdict.contradictedBody": "Fact-checkers or reputable sources contradict it.",
  "verdict.mixed": "Mixed evidence",
  "verdict.mixedBody": "Relevant sources disagree with each other.",
  "verdict.insufficient": "Not enough evidence",
  "verdict.insufficientBody": "No record found is directly about this claim. Treat it as unverified.",
  "verdict.confidence": "Confidence",
  "verdict.conf_low": "Low",
  "verdict.conf_medium": "Medium",
  "verdict.conf_high": "High",
  "verdict.citedSources": "Cited sources",
  "verdict.unavailable": "The search-based verdict is unavailable right now.",
  "verdict.aiNote": "Written by AI only from the records listed in this analysis. Always open the sources.",

  // Language-pattern model (secondary)
  "ml.title": "Language-pattern signal (experimental)",
  "ml.subtitle": "A writing-style model, separate from the verdict. It does not check facts.",
  "ml.lowReliability": "Low reliability: this model was trained on full-length articles and often mislabels short claims.",
  "ml.styleReal": "Writing style resembles real news",
  "ml.styleFake": "Writing style resembles fabricated news",

  // Sharing
  "share.button": "Share",
  "share.title": "Share this analysis",
  "share.body": "Signed-in NewsSearch users who open this link can view a snapshot of this analysis.",
  "share.create": "Create share link",
  "share.send": "Send link",
  "share.stop": "Stop sharing",
  "share.stopped": "Sharing turned off.",
  "share.created": "Share link ready.",
  "share.failed": "Could not create the share link.",
  "shared.title": "Shared analysis",
  "shared.notice": "Shared by a NewsSearch user. Snapshot from {date}.",
  "shared.notFound": "This shared analysis no longer exists or sharing was turned off.",

  // Password reset
  "auth.forgotLink": "Forgot password?",
  "forgot.title": "Reset your password",
  "forgot.body": "Enter your account email and we will send you a link to choose a new password.",
  "forgot.submit": "Send reset link",
  "forgot.sent": "If an account exists for that email, a reset link is on its way. Check your inbox.",
  "forgot.back": "Back to sign in",
  "reset.title": "Choose a new password",
  "reset.waiting": "Opening your reset link…",
  "reset.invalid": "This reset link is invalid or has expired. Request a new one.",
  "reset.newPassword": "New password",
  "reset.submit": "Update password",
  "reset.done": "Password updated. You are signed in.",
  "reset.requestNew": "Request a new link",

  // Export
  "history.export": "Export",
  "history.noVerdict": "No verdict saved",
  "history.exportCsv": "Spreadsheet (CSV)",
  "history.exportPdf": "PDF report",
  "history.exportReady": "Export ready.",
  "history.exportFailed": "Export failed.",

  // Language
  "settings.languageSection": "Language",
  "settings.languageHint": "AI-written verdicts and summaries for new analyses use this language. Source titles stay in their original language.",
  "analysis.detailTitle": "Analysis details",

  // Kinds
  "kind.factcheck": "Fact check",
  "kind.news": "News",

  // Discover
  "discover.title": "Discover",
  "discover.placeholder": "Search claims, topics or keywords…",
  "discover.inputLabel": "Claim, topic or keywords",
  "discover.search": "Search",
  "discover.searching": "Searching…",
  "discover.hintTitle": "Search worldwide records",
  "discover.hintBody": "Query fact-checking organizations and news providers across the globe.",
  "discover.chipAll": "All",
  "discover.resultsTitle": "Results",
  "discover.noResults": "No records matched this search.",
  "discover.queryTooShort": "Enter at least 2 characters.",
  "discover.sourcesCta": "Browse curated primary sources",

  // History
  "history.title": "History",
  "history.empty": "No analysis history yet",
  "history.emptyBody": "Analyzed claims are kept here, newest first. Your history holds your 50 most recent analyses and auto-deletes after 30 days.",
  "history.clearAll": "Clear all",
  "history.deleteTitle": "Delete this analysis?",
  "history.deleteBody": "This removes the analysis from your history. This cannot be undone.",
  "history.clearTitle": "Clear your history?",
  "history.clearBody": "All of your saved analyses will be removed. This cannot be undone.",
  "history.evidenceCount": "{count} evidence records",
  "history.noModel": "No model signal",
  "history.loadFailed": "Failed to load history.",
  "history.deleted": "Analysis deleted.",
  "history.cleared": "History cleared.",

  // Alerts
  "alerts.title": "Notifications",
  "alerts.empty": "All caught up",
  "alerts.emptyBody": "When new fact-checks match your recent analyses, they will show up here.",
  "alerts.markAll": "Mark all read",
  "alerts.matchTitle": "New evidence related to your analysis",

  // Settings
  "settings.title": "Settings",
  "settings.accountSection": "Account",
  "settings.signedInAs": "Signed in as",
  "settings.statusSection": "System status",
  "settings.model": "Baseline model",
  "settings.modelReady": "Ready",
  "settings.modelMissing": "Training",
  "settings.aiNarratives": "AI narratives (Groq)",
  "settings.configured": "Configured",
  "settings.notConfigured": "Not configured",
  "settings.providersSection": "Discovery providers",
  "settings.dataSection": "Data and retention",
  "settings.retentionBody":
    "Minimal retention: your 50 most recent analyses are stored and everything auto-deletes after 30 days. Notifications expire after 30 days.",
  "settings.clearHistory": "Clear analysis history",
  "settings.sourcesLink": "Curated primary sources",
  "settings.legalSection": "Legal",
  "settings.terms": "Terms of Service",
  "settings.privacy": "Privacy Policy",
  "settings.signOut": "Sign out",
  "settings.signOutBody": "You can always sign back in. Your history stays protected by your account.",
  "settings.cleared": "History cleared.",

  // Sources
  "sources.title": "Primary sources",
  "sources.subtitle": "Curated organizations and primary references for manual verification.",
  "sources.empty": "No sources configured.",

  // Legal
  "terms.title": "Terms of Service",
  "privacy.title": "Privacy Policy",
  "legal.updated": "Last updated: June 2026",
};

// Structured legal copy (English-first; move into per-locale modules when
// adding languages).
export const legalContent: {
  terms: { heading: string; body: string }[];
  privacy: { heading: string; body: string }[];
} = {
  terms: [
    {
      heading: "1. Acceptance",
      body: "By creating an account or using NewsSearch you agree to these Terms of Service. If you do not agree, do not use the service.",
    },
    {
      heading: "2. What NewsSearch does",
      body: "NewsSearch searches public records from third-party fact-checking and news providers and gives a search-based verdict that is grounded only in the records it retrieves, with citations. A separate statistical writing-style model is shown for reference and never contributes to the verdict. NewsSearch does not guarantee what is true or false.",
    },
    {
      heading: "3. No guarantee of accuracy",
      body: "The model is a statistical baseline and can be wrong. Evidence records are retrieved from external providers and may be incomplete, delayed or unavailable. You remain responsible for verifying information before acting on it, relying on it, or republishing it.",
    },
    {
      heading: "4. Acceptable use",
      body: "Do not submit content you do not have the right to process, do not attempt to disrupt the service, and do not use automated tooling to abuse analysis, search or rate limits. We may suspend accounts that abuse the service.",
    },
    {
      heading: "5. Third-party services",
      body: "The service relies on third parties (including authentication, database, AI and news/fact-check providers). Their availability, terms and pricing are outside our control, and features may degrade when they are unavailable.",
    },
    {
      heading: "6. Changes and termination",
      body: "We may update these terms as the service evolves and will publish the current version in the app. You can stop using the service and delete your account data at any time.",
    },
  ],
  privacy: [
    {
      heading: "1. Data we process",
      body: "We process the email address you register, the text or links you submit for analysis, the resulting model output and evidence records, and basic service events needed to operate the app. We keep the minimum needed to provide the feature.",
    },
    {
      heading: "2. How your data is protected",
      body: "Accounts are handled by Supabase authentication. Your analysis history and notifications live in PostgreSQL and are protected by Row Level Security: the database itself only ever returns rows that belong to your authenticated user.",
    },
    {
      heading: "3. Minimal retention",
      body: "Your 50 most recent analyses are kept. Analyses and notifications are deleted automatically 30 days after creation. Deleting an analysis or clearing your history removes it immediately.",
    },
    {
      heading: "4. Third parties",
      body: "Submissions are processed by our model server; evidence is retrieved from external news and fact-checking providers; AI-generated explanations and summaries are produced by Groq from the model output and the retrieved records only. These providers process data under their own policies.",
    },
    {
      heading: "5. Your choices",
      body: "You can view, delete individual analyses, or clear your whole history in the app. Signing out removes the session on this device. For any privacy request, contact the service operator.",
    },
    {
      heading: "6. No sale of data",
      body: "We do not sell your personal data, and we do not use your submitted content for advertising.",
    },
  ],
};
