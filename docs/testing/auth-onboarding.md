# Auth & Onboarding Regression Checklist

Use this guide before shipping major authentication or onboarding changes. Unless specified, execute scenarios on both iOS and Android (device or simulator) with a clean install.

## 1. Email & Password Flows
- **Email signup — success**: register with a new email. Expect inline success prompt + onboarding redirect.
- **Email signup — invalid format**: enter malformed email (e.g., `user@`). Inline validation blocks submission; Supabase call is not triggered.
- **Email signup — duplicate**: reuse an existing account and confirm inline error text (“Bu e-posta zaten kayıtlı”) and matching alert copy.
- **Email login — wrong password**: submit incorrect credentials; error banner renders and buttons re-enable after editing.
- **Email login — success**: authenticate, confirm navigation guard routes directly to Today (no onboarding loop).
- **Sign out → sign back in**: confirm previous onboarding progress does not leak to a new session.

## 2. Google OAuth
- **First-time Google signup**: complete OAuth; onboarding starts at Welcome.
- **Existing Google account**: log out, log back in; ensure cached onboarding flags still skip Welcome if already completed.
- **Canceled OAuth**: abort the Google dialog; UI remains interactive with a clear error message.

## 3. Onboarding Step Persistence
- **Step 0 → Motivation**: begin, force-quit before saving. Relaunch; app resumes on Motivation.
- **First Mood / Lifestyle / Notifications**: for each step, navigate away mid-form and reopen. Previously entered values persist.
- **Summary completion**: finish onboarding; verify Today renders and store reset prevents re-entry on next launch.

## 4. Notification Permissions (Notifications Step)
- **Grant permission**: enable switch, accept OS prompt, choose hour/days. Leave onboarding and return; settings are intact.
- **Deny permission**: toggle on, decline prompt. Switch resets to off, red warning appears, `Ayarları Aç` deep-links to system settings.
- **Revoke externally**: grant permission, then disable notifications via OS Settings. Re-open onboarding step; UI shows warning and switch off.

## 5. HRV → Today Check-in Bridge
- Start a 60s HRV session, cancel mid-way, leave screen: countdown stops, no lingering timers.
- Complete HRV measurement; app routes to Today and opens the check-in sheet once.
- Return to Today later: sheet does not auto-open again.

## 6. Edge Cases
- **Offline mode**: disable network mid-onboarding. Interactions remain responsive; errors defer until reconnect.
- **Orientation changes**: rotate device during onboarding screens; layout remains stable.
- **Push denied + retry**: from warning state, reopen settings, allow notifications, return to app. Toggle reflects granted state without restarting onboarding.

Document results, platform, build number, and tester initials at the end of each run.
