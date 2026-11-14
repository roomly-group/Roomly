# DPIA draft: identity verification ("Verifica identità")

> **Status: DRAFT, not approved.** Prepared on 14 November 2026 from the code in this repository (audit finding RMY-03).
> It records the technical facts. The legal assessment, the risk ratings and the sign-off belong to the controller and its DPO or privacy lawyer.
> Items marked **[OPEN]** need a decision before this DPIA can be approved.

| | |
|---|---|
| Controller | [Company name], [registered office], [VAT no.] (see `frontend/src/lib/legal-content.ts`) |
| Contact | hello@roomly.it |
| Processing | Identity verification of users with ID document photos and a face video, plus optional training of a Roomly verification model |
| Prepared by | [name, role] |
| Reviewed by (DPO / lawyer) | [name, date] |
| Approved by (controller) | [name, date] |
| Next review | [date], and whenever the processing changes (for example when the training model is built) |

---

## 1. Why a DPIA is required

- **Art. 35(1) GDPR:** the processing uses new technology (training a model on face videos) and is likely to result in a high risk to people's rights and freedoms.
- **Art. 9 GDPR:** face videos used to train a model that identifies people are biometric data processed by specific technical means. That is special-category data.
  **[OPEN]** Decide whether the verification alone (a person visually comparing the photos with the video, without technical processing) also counts as biometric processing under Recital 51. The safest choice, and the one this draft assumes, is to treat the whole flow as special-category processing.
- **Garante list of processing that requires a DPIA (provvedimento n. 467 of 11 October 2018):** this list includes processing of biometric data and processing that uses innovative technology.
- **Art. 35(3)(b):** large-scale processing of special-category data. Not large-scale today (pre-launch), but it will be once the service opens.

---

## 2. Systematic description of the processing (Art. 35(7)(a))

### 2.1 Purposes

| ID | Purpose | Who it concerns |
|---|---|---|
| P1 | Verify that the user is the person named on the account, and show the "Identità verificata" badge | Students (optional) and owners (required to publish listings: `backend/src/routes/roomly.ts`, "Only verified owners can create listings") |
| P2 | Train Roomly's own verification model with the files and the reviewer's decision as a label | Only users who tick the separate training consent |

### 2.2 Data

| Data | Source | Where it is stored |
|---|---|---|
| Front and back photo of an ID card, passport, driving licence or residence permit | Uploaded by the user | Supabase Storage, private bucket `verifiche_identita`, `<user id>/<attempt id>/fronte.jpg`, `retro.jpg` |
| Challenge video of the face, up to 30 s and 30 MB: the user says a 4-digit code and makes 2 random gestures | Recorded in the browser | Same bucket, `<user id>/<attempt id>/video.<webm\|mp4\|mov>` |
| Name, surname and date of birth on the account (compared with the document; frozen during the review and after approval) | User profile | Table `utenti` |
| Attempt record: status, document type, challenge code and gestures, consent flags, dates, reviewer id, rejection reason, reviewer note (up to 500 characters) | Backend | Table `verifiche_identita` (`backend/migrations/011_verifiche_identita.sql`) |

Documents can show more than identity data: nationality, place of birth, document number, signature, and on a residence permit the type of permit. **[OPEN]** Assess whether to ask users to cover fields the reviewer does not need (document number, MRZ), or to state that these fields are not used.

### 2.3 Data flow

1. **Start.** The user picks a document type, confirms their details, ticks the required verification consent and, separately and only if they want, the training consent (`frontend/src/pages/verification.tsx`). The backend stores `consenso_verifica_at` and `consenso_addestramento`, and creates a random challenge.
2. **Upload.** The browser sends the files to `/api/me/verification/...`. Vercel forwards `/api/*` to the Railway backend, so the bytes pass through Vercel's network but are not stored there.
3. **Clean-up before storage** (`backend/src/routes/verification.ts`, `backend/src/lib/video.ts`):
   - photos are decoded and re-encoded as JPEG of at most 2000×2000 px, so EXIF data such as GPS position never reaches storage;
   - videos are checked against their container signature, then copied without metadata with ffmpeg in a temporary folder on the Railway server, which is deleted right after.
4. **Storage.** The files go to the private Supabase bucket. The bucket has no public URL and no storage policy, so only the backend can reach it (`backend/migrations/015_chiudi_bucket_storage.sql`).
5. **Review.** A reviewer (`utenti.admin = true`) opens `/admin/verifiche`. The backend gives the reviewer signed URLs that expire after 15 minutes. A reviewer can never decide their own attempt. The decision is made by a person.
6. **Retention and deletion.** See 2.5.

### 2.4 Recipients and processors

| Recipient | Role | Location |
|---|---|---|
| Authorised Roomly reviewers (`utenti.admin`) | Staff of the controller | [OPEN: list who has the admin flag] |
| Supabase Inc. | Processor: database and file storage | Project region eu-west-1 (Ireland). US parent company: DPF / SCC |
| Railway Corp. | Processor: application server that receives and processes the files | **[OPEN]** confirm the region of the Railway service |
| Vercel Inc. | Processor: proxies the upload requests | **[OPEN]** confirm the DPA and the transfer mechanism |

Other users never see the files. They see only the badge.

### 2.5 Retention

| Case | Files deleted | Enforced by |
|---|---|---|
| Decided attempt, no training consent | 7 days after the decision | `purgeExpiredVerificationFiles`, `backend/src/lib/verification.ts`, every 6 hours |
| Decided attempt, training consent | **12 months after the decision at most**, even with consent. Counted from `decisa_at`, so consenting again never extends it | Same job, `VERIFICATION_TRAINING_RETENTION_DAYS = 365` |
| Training consent withdrawn | At the next run, once the 7 days after the decision are over | Same job |
| Draft attempt never sent | 7 days after its last change | Same job |
| Account deleted in the app | Immediately, before any database row is deleted | `backend/src/lib/account.ts` |
| User row deleted outside the app (e.g. Supabase dashboard) | The deletion is refused while files exist; files of users that no longer exist are swept every 6 hours | DB trigger `backend/migrations/021_proteggi_file_verifiche.sql` and `purgeOrphanedVerificationFiles` |
| Attempt outcome (status, dates, reason) without files | While the account is active | Table `verifiche_identita` |

Gaps:
- **[OPEN]** Attempts waiting for review (`in_attesa`) have no maximum age. If nobody reviews them, the files stay. Set a limit, for example auto-reject after N days.
- **[OPEN]** Purges only run while the backend runs. There is no alert if the job keeps failing. Failures are logged as "Identity verification purge failed" in Railway.
- **[OPEN]** Backups. Check how long Supabase keeps database and storage backups, and state it.

---

## 3. Necessity and proportionality (Art. 35(7)(b))

| Principle | How the processing meets it |
|---|---|
| Lawfulness | Explicit consent, Art. 6(1)(a) and Art. 9(2)(a), separate for P1 and P2. **[OPEN]** For owners, P1 is a condition to publish listings, so consent may not be "freely given" (Art. 7(4)). Assess whether another basis or an alternative check (for example a video call) is needed for owners. |
| Separate, unbundled consent for training | A separate checkbox, never pre-ticked, not even on a retry after a rejection. Refusing it changes nothing. It can be withdrawn at any time from `/verifica`. |
| Purpose limitation | Files are used only for P1, and for P2 when the user consented. Not used for advertising, not shared with other users. |
| Data minimisation | Metadata removed; photos capped at 2000 px; video capped at 30 s; only 3 files per attempt; challenge prevents reuse of old recordings. **[OPEN]** Masking of document fields not needed (see 2.2). |
| Storage limitation | See 2.5: 7 days, or 12 months at most with consent. |
| Accuracy | Name, surname and date of birth are frozen during the review and after approval. |
| Transparency | Privacy policy, sections 2, 3, 4, 6, 8, 9 and 11 (`frontend/src/lib/legal-content.ts`); consent texts on the page state 7 days and 12 months. |
| Data subject rights | Account deletion removes files immediately. The data export lists attempts and whether files are still stored, but does not include the files; copies are given on request. **[OPEN]** Define the procedure and response time for those requests. |
| Accountability | `consenso_verifica_at` records when verification consent was given. **[OPEN]** There is no timestamp for when training consent was given or withdrawn. Recommended: add `consenso_addestramento_at` so the controller can prove consent (Art. 7(1)). |
| No automated decision (Art. 22) | A person decides every verification. **[OPEN]** Once a trained model takes or proposes decisions, this DPIA must be updated before it goes live. |

---

## 4. Risks to people (Art. 35(7)(c))

Ratings are proposals: likelihood (L) and severity (S) from 1 (low) to 3 (high). The DPO should confirm them.

| ID | Risk | Effect on the person | L | S | Main measures |
|---|---|---|---|---|---|
| R1 | Leak of the bucket (misconfiguration, provider breach) | Identity theft, fraud, deepfakes from face videos | 1 | 3 | Private bucket, no policies, signed URLs only, short retention |
| R2 | Theft of the backend service-role key | Full access to all files | 1 | 3 | Key only in Railway env vars, never in code or frontend. **[OPEN]** key rotation procedure |
| R3 | A reviewer misuses access (downloads, screenshots) | Same as R1 for the people concerned | 2 | 3 | Few admins, 15-minute links. **[OPEN]** no log of which reviewer opened which file; no confidentiality agreement recorded |
| R4 | Files kept longer than stated (job down, orphaned files, pending attempts) | Exposure lasts longer than promised | 2 | 2 | 6-hour purge, 12-month cap, DB guard and orphan sweep. **[OPEN]** pending-attempt limit, alerting |
| R5 | Consent not freely given (owners) | Unlawful processing | 2 | 2 | Training consent separate and optional. **[OPEN]** see section 3, Lawfulness |
| R6 | Function creep: files used for other purposes than P1/P2 | Loss of control over biometric data | 1 | 3 | Purposes fixed in the privacy policy; access only via backend |
| R7 | Training model built without a new assessment | Biased or wrong automated decisions | 2 | 3 | No model in production today. **[OPEN]** update this DPIA before any model is trained or used |
| R8 | Transfers outside the EEA | Weaker protection | 1 | 2 | DPF / SCC. **[OPEN]** confirm regions and DPAs for Railway and Vercel |
| R9 | Interception in transit | Same as R1 | 1 | 3 | HTTPS everywhere, HSTS on the frontend |
| R10 | Personal data in logs | Exposure through log access | 1 | 2 | Logs carry counts and ids only; emails masked (RMY-10) |

---

## 5. Measures

### 5.1 Already in place

- Private bucket, no storage policies, backend-only access (migrations 011, 015).
- Signed URLs valid for 15 minutes, made only for reviewers (`requireAdmin`).
- A reviewer cannot decide their own verification.
- Metadata stripped from photos and videos before storage.
- Separate, unticked, withdrawable training consent.
- Retention: 7 days without consent, 12 months at most with consent, enforced every 6 hours (RMY-03).
- Files deleted before rows on account deletion (RMY-02), enforced in the database by trigger `proteggi_file_verifica` (migration 021), plus a sweep for files of deleted users.
- Rate limits on uploads; size and type checks; container signature check on videos.
- Privacy policy describes the processing, the legal bases, the recipients, the retention and how to withdraw consent.

### 5.2 Recommended (see [OPEN] items)

1. Maximum age for attempts waiting for review.
2. Alert when the purge job fails several times in a row.
3. Audit log of reviewer access to files.
4. Timestamp of training consent and of its withdrawal.
5. Written confidentiality commitment for every reviewer; keep the admin list short.
6. Re-check the privacy policy statement that no DPO is required (Art. 37(1)(c)), given the special-category data.
7. Confirm processor regions and DPAs (Railway, Vercel).
8. Update this DPIA before any model is trained or used on these files.

---

## 6. Residual risk and outcome (to be completed by the controller)

| | |
|---|---|
| Residual risk after measures | [low / medium / high] |
| DPO / lawyer opinion | [text] |
| Prior consultation with the Garante needed (Art. 36)? | [yes / no, and why] — required if a high residual risk remains |
| Decision | [go / go with conditions / no go] |
| Signed | [name, role, date] |
