Refactor the existing app into a simple Event Security Rostering, Deployment and Variation Management System, following your master brief. Existing users, guards, sites, shifts, rosters and history are kept; removed modules are hidden, not deleted.

## Stage 1 — Simplify
- Navigation reduced to: Dashboard, Roster, Variations, Guards, Communications, Settings (tabs inside each).
- Hide incidents, alerts, live map/GPS tracking, site plans, photo requests, financial reports and extra approval stages. Their data stays in the database untouched.
- Guard mobile portal reduced to: My Shift, Sign On/Off, Roster Changes, Messages, My Profile.

## Stage 2 — Roster foundation
- Events and Contractors set up in Settings (event has its own time zone and optional sign-on GPS check).
- Staffing slots (positions) exist independently of guard names.
- CSV/Excel import with a column-mapping screen; revised uploads match existing Shift IDs instead of duplicating.
- First import saved permanently as Original Roster v1; a separate Current Approved Roster drives everything else.
- Download the current approved roster as CSV at any time; each approved change creates a new version.
- Change History tab on every shift, shown as a simple timeline.

## Stage 3 — Variations
- Three-step request: pick type (Extend/Reduce, Redeploy, Add Guards) → only the needed fields, pre-filled → review original vs proposed → Submit.
- Status flow: Requested → Awaiting Contractor Acknowledgement → Awaiting Approval → Approved / Declined, with "Return for clarification".
- Acknowledgement and approval recorded separately (who, when, comments).
- On approval the roster is updated automatically and once only: times, deployment, new slots, sign-off time, vacated positions. Temporary redeployments return automatically.
- Variation register with filters and full history.

## Stage 4 — Attendance
- Guard sign-on links to their shift and slot; guards with no slot show as Unallocated and never count as filling a position.
- Supervisors/contractor managers allocate unallocated guards to vacant slots; a guard can't fill two slots.
- Dashboard: three big cards (Rostered, Signed On, Missing), live staffing table, upcoming/finishing within an hour, vacant positions, unallocated guards, pending variations. Updates live.
- Automatic sign-off on the server at the latest approved finish time; manual early sign-off allowed; method recorded. Approvals made after sign-off need an authorised attendance adjustment.
- Optional GPS check at sign-on only, with manager override. No tracking afterwards.

## Stage 5 — Communications
- Guard groups (by contractor, event, shift, zone, role, position, supervisor, or custom; dynamic or manual).
- Send to one guard, selected guards, a group, a shift, everyone signed on, guards affected by a variation, or a whole contractor.
- Templates, recipient and character counts, message history.
- Pre-filled message after each approved change.
- No SMS provider yet: messages are saved and shown as "Not sent — provider not connected". Connecting one later (e.g. Twilio) only switches on delivery.

## Stage 6 — Contractor manager access and testing
- New Contractor Manager role that only sees their own contractor's roster, guards, variations and messages.
- Load a realistic test event: 200 guards, 3 contractors, multiple zones and shifts, with extensions, reductions, redeployments, extra guards, unallocated guards and missing positions. Check every rule end to end, including CSV exports.

## Technical details
- New tables: events, contractors, contractor_members, roster_versions, roster_slots (original_* + current_* columns, version counter for conflict detection), slot_assignments, attendance (sign_on/off, method, slot link, unique active per guard), variations (type, payload, status, ack_*, approval_*, applied_at unique guard), variation_slot_changes, roster_change_log (insert-only), guard_groups, guard_group_members, sms_messages, sms_recipients. All with grants + RLS; contractor scoping via security-definer `is_contractor_member()`.
- Add `contractor_manager` and `event_manager` to app_role.
- `approve_variation(id)` Postgres function applies changes in one transaction with row locks and an "already applied" guard; also writes the change log and new roster version.
- Existing per-minute auto-end job replaced by `auto_sign_off_due()` reading current approved finish times, scheduled every 5 minutes (lowers database load raised earlier); temporary redeployment return handled in the same job.
- Live dashboard via realtime on attendance, roster_slots, variations.
- Split the large single page file into feature folders (dashboard, roster, variations, guards, comms, settings, mobile). Existing prototype localStorage data migrated into the database where it maps cleanly.
- Tests for the business rules: missing count, unallocated not counted, double allocation blocked, sign-off uses latest finish, variation applied once.
- Build is staged; I'll confirm after each stage so you can check it in the preview.
