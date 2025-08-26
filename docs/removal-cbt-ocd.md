# Removal: CBT and OCD Modules (Non-breaking to Core Data/API)

## Scope
- Removed UI screens, components, tests, i18n for CBT and OCD/Tracking.
- Kept UnifiedAIPipeline contracts intact; introduced routing remap (CBT→Mood, OCD→Breathwork).
- Preserved base clients, interceptors, telemetry, stores.

## Changes
- Tabs: removed `cbt` and `tracking` entries in `app/(tabs)/_layout.tsx`.
- Today: removed CBT/OCD summary cards and push navigation; remapped adaptive CTA.
- Routing: `features/ai/services/smartRoutingService.ts` screen configs remapped (`cbt`→`/(tabs)/mood`, `tracking`→`/(tabs)/breathwork`).
- Adaptive: `useAdaptiveSuggestion` remapped any CBT/Tracking CTA to Mood/Breathwork.
- Quick actions: `VoiceCheckinModern` removed CBT/Tracking quick buttons.
- Deleted UI files: CBT forms/dashboards, Compulsion components, YBOCS assessment.
- Deleted OCD services: `ocdTriggerDetectionService`, `turkishOcdCulturalService`, `ybocsAnalysisService`.
- Tests: removed system/integration/analytics tests for CBT/OCD/Tracking.
- i18n: removed CBT/Compulsions/ERP/Assessment keys from `tr.json` and `en.json`.
- Docs: updated `FEATURE_STATUS_MATRIX.md`, CBT/OCD docs marked as removed.

## Remap Policy
- CBT analysis → navigate to Mood (`/(tabs)/mood`).
- OCD analysis → navigate to Breathwork (`/(tabs)/breathwork`).
- Fallbacks preserved; telemetry continues to fire.

## Risks & Mitigation
- Legacy imports: grep used to ensure no active imports to removed modules.
- User data: No schema changes; existing data remains in storage; UI no longer references it.
- Telemetry: Event names unchanged; categories remapped in UI only.

## Rollback
- Revert this commit set; restore `app/(tabs)/cbt.tsx`, `tracking.tsx`, components and i18n keys.
- Revert remap changes in `smartRoutingService` and `useAdaptiveSuggestion`.

## Verification
- App builds and opens on iOS/Android/web.
- Lint clean, tests green (remaining suites).
- Navigations to CBT/OCD no longer present; voice routing goes to Mood/Breathwork.
