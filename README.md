# Save Stroke frontend

Thai health recording and care management application. Requires Node.js 20+.

## Local development

```powershell
npm install
npm start
```

The frontend runs at `http://localhost:3000`. In development it uses HTTP port
8080 on the same hostname as the browser page: `localhost:3000` uses
`http://localhost:8080/api`, while `127.0.0.1:3000` uses
`http://127.0.0.1:8080/api`. This keeps local session cookies on the same site.
For a phone or another device on the local network, the API uses the page's
network hostname/IP; allow that exact frontend origin in backend
`CORS_ALLOWED_ORIGINS` and make the development API reachable on port 8080.
IPv6 also requires its exact frontend origin in that allowlist.
Set `REACT_APP_API_URL` to override the API address before starting or building,
including for HTTPS development or a shared `/api` proxy. The production API
default remains `https://carevigoapi.onrender.com/api`. The backend is in the
adjacent `CarevigoAPI` repository; its README documents MongoDB, email, background
processing, and deployment settings. Update/restart the backend together with
frontend authentication changes so `/api/auth/session` and cookie login are
available.

## Browser storage and cookies

Browser login uses separate patient/staff HttpOnly cookies issued by the backend.
The frontend never writes JWTs, passwords, citizen IDs, account profiles, health
records, or CSRF tokens to localStorage or sessionStorage. Legacy credential/profile
keys are removed on startup and session changes. Account profiles, expiry metadata,
and CSRF tokens live only in memory; reload verifies the server cookie before
displaying private pages. Optional browser storage holds only anonymous coordination
signals and per-role pending sign-out flags. Disabled browser storage does not
prevent normal cookie authentication.

Login verifies that the browser accepted its cookie. Sign-out clears private UI
immediately and revokes the server session; a failed request shows a retry action
and retains a nonsecret sign-out intent so reload can retry without publishing the
account profile. Successful sign-out affects only the selected role. Tabs broadcast
changes without account data, discard earlier requests, and revalidate after returning
from the background or browser history. Web Locks serialize cookie changes across
tabs where supported, with per-tab serialization as fallback. An unfinished login
is revoked if the user leaves the login form before it completes. Guest drafts
remain in the current page's memory through session changes.

Deploy the updated backend before this frontend. Cookie requests use credentials,
an expected session generation, and a session-bound CSRF header on writes. Backend
`CORS_ALLOWED_ORIGINS` must include the exact frontend origin. Production cookies
require HTTPS; `COOKIE_SAME_SITE` is configurable on the backend. Separate Render
subdomains are cross-site: `SameSite=None; Secure` allows those requests, but browser
third-party cookie policies may still block them. A blocked cookie displays a
recoverable login message. For deployments supporting restrictive browser policies,
serve `/api` through the frontend origin and build with `REACT_APP_API_URL=/api`, or
use same-site HTTPS domains with a suitable SameSite setting. Both frontend and API
must be updated together; static hosting alone does not provide the `/api` proxy.
See [MDN cookie/CORS behavior](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS#third-party_cookies)
and the [OWASP storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html#local-storage).

## Production login checks

Deploy the current `CarevigoAPI` backend together with this frontend. Read-only
checks on 1 November 2026 found the frontend reachable while the default API
returned `404` for its cookie-session route. Deploying static frontend files
alone cannot add that missing backend route.

Check the configured API with requests that contain no account credentials:

```powershell
curl.exe -i "https://carevigoapi.onrender.com/api/health"
curl.exe -i "https://carevigoapi.onrender.com/api/auth/session?scope=admin" `
  -H "Origin: https://carevigo-frontend.onrender.com" `
  -H "X-Carevigo-Session: cookie" `
  -H "X-Carevigo-Scope: admin"
```

- Health should return `200` with `mongodb: "CONNECTED"`. A `503` requires fixing
  the backend database connection before testing account credentials.
- The anonymous session request should return `401`, which means the route is
  available and there is no signed-in account. A `404` means the deployed API or
  configured API address does not provide the required authentication contract;
  deploy the updated backend and verify its service/start command.
- Check `REACT_APP_API_URL` at frontend build time and backend
  `CORS_ALLOWED_ORIGINS`, `FRONTEND_URL`, `NODE_ENV`, and `COOKIE_SAME_SITE`.
  The exact HTTPS frontend origin must be allowed with credentialed CORS.
  Separate Render sites require `HttpOnly; Secure; SameSite=None` login cookies.
  Confirm the browser accepts the cookie and its follow-up session request
  succeeds; use the same-origin proxy or same-site domain setup above where
  third-party cookies are blocked.

Keep authentication in server-issued HttpOnly cookies. Manually adding tokens
to localStorage or sessionStorage is not a supported login recovery method.

## Waiting for a suspended API

Before sending a business request, the client shares an anonymous, uncached
`/api/health` check across callers and waits up to 90 seconds for the API and
database to be ready. A notice appears after 1.5 seconds; a warm response stays
quiet. Successful readiness is reused for five minutes, with no periodic traffic
while idle. Unready health responses honor the server's bounded `Retry-After`.
Credentialed requests retain their normal 20-second timeout after readiness.

Only health reads are retried. Login, save, review, password reset and other
business requests are dispatched once. A business network/server failure expires
readiness for the next user action; it never resends the failed request. Leaving
login, guest, recovery or email-review pages cancels their queued dispatch;
changing accounts cancels pending requests tied to the previous session. A
readiness timeout preserves the form for a manual retry. Health checks send no
cookies, account headers or form data, including with a same-origin API.

This handles cold starts in code; it does not change the hosting plan or prevent
the platform from suspending an idle process. The backend's review/email worker
catches up on wake and cannot run at 23:59 while its host is suspended.

## Workflows

- `/guest`: submit recipient details without logging in, with any number of health measurement categories, including none. After 13 citizen-ID digits and a 350ms pause, the public personal-profile endpoint fills the official verified recipient's first name, last name, gender, birth date and phone. Unknown profiles and lookup errors permit manual entry. Late responses cannot overwrite manually edited fields or another recipient; changing the ID clears the previous recipient's draft and agreements. Previous clinical measurements and history are never filled. Acceptance clears the editable fields and shows a read-only summary and assessment of this submission, including a masked citizen ID, entered details/results, submission time, pending status and Thai review deadline. The summary stays only in current-page memory; a new entry, full reload or navigating away inside the app clears it. This page does not fetch receipts, private history or past CV results, and has no account navigation. Unchanged failed retries reuse the same request ID.
- `/login`: personal login with citizen ID and password. Staff issue a random or manually entered six-digit initial code. The first login requires changing it. Patients can choose a six-digit code or a password of at least eight characters.
- `/`: staff go to `/admin`, signed-in patients go to their personal dashboard, and anonymous visitors go to `/guest`. If both roles are signed in, staff take priority on this neutral entry route. Explicit patient pages and guest entry remain accessible under their normal permissions.
- `/health`, `/history`, `/profile`, `/settings`: a patient's own records, editable profile, and password settings. Individual record URLs are checked against the signed-in account. Private reads are also authorized by the backend.
- `/admin/login`: staff email and password login.
- `/admin/forgot-password`: request a staff password reset by account email. The acknowledgment is the same for existing and unknown accounts.
- `/admin/reset-password`: open the email link, enter a new password and matching confirmation, then return to staff login. Links expire after 30 minutes and are single use; a newer request replaces the earlier link. The token is kept only in page memory and removed from the URL fragment. Reopen the email link if the page is reloaded before saving. Recovery pages remain public even when session bootstrap fails. A successful reset revokes that staff account's previous cookie and Bearer sessions; patient sessions remain separate. External email requires the backend SMTP settings.
- `/admin?view=dashboard|members|verification|reviews|settings`: care overview, member registry, member verification, health record review, and settings. Member verification and health record review are separate workflows.
- `/register`: staff-only patient registration, followed by account provisioning from member details.
- `/review-email`: token-scoped review from an admin notification. Opening a link only reads the submission; an explicit confirmation sends the approval/cancellation.
- `/help`: instructions and frequently asked questions.
- `/terms` and `/privacy`: public service terms and the general privacy/PDPA notice;
  links open in a new tab from forms so unsent data remains in memory.

Guest submissions can be confirmed or cancelled individually, in a selected group, or across all matching pending submissions. This also applies to profile-only submissions with zero measurements: they enter review and notification flows without creating invented health rows. All-selection uses a server snapshot so later submissions are excluded. Remaining pending submissions are automatically confirmed at **23:59 on their submission date in Asia/Bangkok**. Cancellation preserves the submission, reason, timestamps, and audit history. Email delivery uses a durable backend queue; production requires a running backend worker and configured email transport.

Data entry uses one section per page: guest entry has seven steps, health recording
has five, staff registration has six, and the personal profile has five. Next checks
the current section; Back and previously visited steps preserve entered values.
Every measurement category is optional and can be skipped. Guest submission
with no measurements still saves the recipient details and requires fresh
agreements; its accepted summary explicitly shows zero results. An authenticated
health entry with no measurements skips saving and creates no health record.
Entered categories still validate their required paired values. The final page
summarizes the current draft and requires fresh agreements before a write. Enter on an earlier
page advances the form without sending data. Validation opens and focuses the
section containing the first error. Private health/profile drafts and the current
step remain only in memory for the same verified session and clear when that
session ends or changes; they do not survive a full browser reload.

## Service terms and privacy agreements

The Thai documents intentionally use general wording, as requested; they do not
invent a controller name, contact address, or fixed retention period. The deploying
organization remains responsible for its actual controller/contact details,
retention rules, lawful bases, processors, and handling rights/withdrawal requests.
This change provides notices and evidence for new form submissions, rather than
a complete organizational PDPA compliance or automated rights-request system.

Guest/patient forms show separate, initially unchecked service-terms and explicit
health-data consent controls. Staff forms instead record notice acknowledgment
and lawful authority to act; staff confirmation is not presented as the patient's
own consent. Reading, login, receipts, and sign-out do not require agreement.

Before new registration, profile changes, or health saves, the API validates the
current `termsVersion` and `privacyVersion` and records its own timestamp, source,
and actor. Agreement state is never remembered in browser storage or prefilled
from someone else's acceptance. Unchanged guest retries retain their original
proof; older records are not assigned consent retrospectively. Keep versions in
`src/utils/legal.js` aligned with the backend legal agreement constants when
updating documents. The generic withdrawal wording refers requests to the actual
service organization; cancelling a review record does not withdraw consent or
delete a health record.

## Risk assessment

The server calculates the ten-year Thai CV risk using the [Ramathibodi total-cholesterol model](https://www.rama.mahidol.ac.th/cardio_vascular_risk/thai_cv_risk_score/), version 2.5. Green means below 10%, yellow means 10% through 20%, and red means above 20%, as required by this application. The official model's display limit is preserved as `>30%`.

A CV calculation requires gender, age, current smoking, confirmed diabetes history, systolic blood pressure, and total cholesterol. These are assessment requirements; a form can be submitted without health measurements. Missing inputs or patients outside the model's eligibility produce an explanation rather than a fabricated percentage. Pending and cancelled measurements do not contribute. BMI and cardiovascular risk are displayed separately. Approved guest assessments identify their submitted-profile source.

## Verification

```powershell
$env:CI = 'true'
npm test -- --watchAll=false --runInBand
npm run build
```

Component tests cover account isolation, session changes, temporary-code setup, registration failure recovery, conditional profile fields, optional/empty health entry, partial health retries, guest idempotency and one-time summaries, review selection and audit, email confirmation, and exact risk color boundaries using mocked APIs. All test patients are synthetic; tests never send real email.

The deeper workflow browser harness additionally uses the production Express
factory and an isolated real MongoDB with synthetic patients, intercepting every
browser API request before it could reach an existing API. External email delivery
is replaced with an in-memory sink. This verifies staff registration/provisioning,
patient password rotation, health/profile saves, CV risk, guest-only entry,
review decisions and email confirmation against actual persisted documents.

## Thai dates and accessible responsive forms

All visible dates use Buddhist Era years and the Asia/Bangkok timezone. Birthday
text fields accept `DD/MM/BE` or eight digits `DDMMBE` and include a Thai month/day calendar with a Buddhist
year control, keyboard navigation and touch targets. For example, `01/01/2523`
becomes `1980-01-01` in form state and the existing `19800101` API/database format.
Typing `06122541` displays `06/12/2541` and stores Gregorian `19981206`.
Slash edits and partial input remain editable; valid slash dates format on blur.
Manual dates obey the same minimum/maximum bounds as the calendar.
Notice versions and timestamps retain their machine-readable Gregorian formats.
Impossible dates are rejected instead of being rolled into another month.

The interface uses 18px core Thai copy and form text, larger labels, darker helper
text and controls sized for touch. Forms reflow for phones, tablets and desktops;
wide data tables scroll within their own region. Calendar popups stay inside the
viewport. Guest entry uses a single-purpose layout with the essential legal links.

Health and profile drafts stay only in the current document's memory. Returning
from another tab still hides private views and revalidates the cookie, then
restores a draft only for the same verified session and the same patient target.
Logout, expiry or a different session clears it. Passwords, PINs and agreement
checkboxes are never retained as private drafts. Partial health successes remain
locked so retrying does not resend successful sections; an interrupted submission
is marked uncertain and directs the user to check history before retrying.

## Brand assets

The Save Stroke mark is an original vector brain inside a protective shield,
shared by the website, browser tab and app metadata. Files in `public/` include
`save-stroke-mark.svg`, the app carrier SVG, PNG icons at 192 and 512px, and a
multi-size `favicon.ico`. Artwork contains no external resources or fonts.
API origins remain configurable. The frontend requires the updated backend's
cookie-session authentication contract described above.

## Motion and navigation

Session bootstrap and patient-account verification use a branded full-page loader
with the existing shield mark, gentle orbit and pulse-line animation. Its single
polite status has no invented percentage or extra minimum wait. A guest-entry link
remains available. Public forms stay editable with compact readiness feedback;
that feedback is suppressed while a full loader is mounted. Reduced motion keeps
the same information with a static mark and pulse line.

Short 140–280ms entrances and control feedback help show navigation, opened
dialogs and completed saves. Headings replay a subtle fade when the admin view
changes without replacing the surrounding page or form. Cards and popups animate
only on entry; private content disappears immediately on logout/expiry. Existing
keyboard focus, Escape handling and field values are preserved. The operating
system's reduced-motion preference disables CSS animations/transitions, loading
spinners/shimmer and active heading animations, including changes made while the
page is open. No animation library is required.

Login returns to recognized local application destinations, including query and
hash state. Return paths reject external URLs, protocol-relative URLs, control
characters and unknown application paths. Patient record links normalize to the
signed-in person's ID, and initial PIN changes take priority over return links.
An old logout/expiry marker never overrides a valid staff session on entry.

Layout checks cover 16 public/patient/staff views at 360, 768 and 1440px. Wide
admin tables remain inside keyboard-focusable scrolling regions, with a visible
hint on smaller screens. Search icon padding, mobile history captions, filters,
statistics, CV summaries and footer wrapping use the larger readable text sizes.

## Current-entry health interpretation

After an accepted guest submission, the results page shows only that entry's
measurements, readable interpretation, and specific next steps before the separate
ten-year Thai CV risk card. Signed-in entry shows only categories that actually
saved; failed or uncertain categories appear only after a successful retry.
Profile-only guest submissions remain neutral. No historical measurements are
looked up or inserted into the result and no diagnosis is persisted.

The pure `interpretHealthRecords` utility uses the
[2024 Thai BP classification summarized by DDC](https://ddc.moph.go.th/uploads/publish/1643320241125083206.pdf),
[DDC Thai BMI bands](https://ddc.moph.go.th/uploads/publish/1648820241210053223.pdf),
[NIDDK glucose screening](https://www.niddk.nih.gov/health-information/diabetes/overview/tests-diagnosis),
and linked CDC, AHA, NIH lipid and age guidance. References are expandable on the
result itself. Labels are screening guidance rather than diagnoses or personal
treatment targets. Unknown age is explicit; known children do not receive adult
normal classifications, and BMI/lipid adult bands require age20+. Severe acute
glucose/BP and severe triglyceride safety guidance remain visible at younger ages.

BP at least180 systolic **or**110 diastolic, FBS below70 or at least300mg/dL
appears before routine results with actions that do not wait for administrative
review. The first FBS>=300 same-day contact flag is a conservative application
choice: [CDC's emergency guidance](https://www.cdc.gov/diabetes/about/diabetic-ketoacidosis.html)
specifies persistent glucose>=300 or relevant danger symptoms; that distinction
is stated in the card. Low-glucose oral carbohydrate advice is conditional on safe
swallowing, with child-specific guidance instead of a fixed adult15g amount.
No result recommends changing medication without a clinician. The separate CV
risk percentage never overrides acute warning signs or derives from BMI labels.

## Staff health dashboard

The dashboard follows the earlier count-card and record-table layout. Four
clickable cards show the global number of BP, glucose, lipid and BMI **records**
across all review states. The record list immediately follows. Member totals,
today's Bangkok totals, verification work and the member CV risk overview are
secondary; a member count is never presented as a measurement count.

Search, type, review status, stored Thai CV risk, legacy BMI group and sorting
are applied by `/api/dashboard/health` before pagination. Search waits350ms;
changing a filter resets to page1 and stale responses cannot replace the new
result. The advanced filters keep BMI grouping separate from the ten-year CV
score. Deploy the matching backend filter contract before this frontend.

Each row shows all supplied measurements, an interpretation with a textual
severity, a next step, and expandable guidance. HbA1c-only records do not invent
an FBS result. Guest interpretation uses the submitted demographic snapshot.
Historic urgent readings ask staff to check current symptoms/results before
acting; row CV risk is explicitly the assessment stored with that record.
Legacy BMI-only records retain the stored number neutrally when weight/height
are missing. The UI does not fetch clinical history to fill missing values.
