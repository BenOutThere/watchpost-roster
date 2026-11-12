import type { Guide } from "./types";
import { GUIDE_UPDATED, deskMessages, deskScanner, liveMapSection, guardDeskOnly, guardRegistering, guardShiftChanged, guardTabs, shiftStatuses, signingIn, userGuidesTopic, variationStatuses } from "./shared";

export const adminGuide: Guide = {
  id: "admin",
  title: "Admin Guide",
  audience: "Super Admins, Senior Management, Event Managers and Event Control Assistants",
  updated: GUIDE_UPDATED,
  intro: "How to set up and run an event: roster, sign-in desk, variations, guards, communications and settings. What you can see depends on your user type — Super Admins see everything. Where a feature is limited, the guide says so (for example Super Admin only or needs Costs & rates).",
  sections: [
    {
      id: "whats-new",
      title: "What's new in this update",
      intro: "Changes since the previous version of this guide.",
      topics: [
        {
          id: "new-list",
          title: "Latest changes",
          blocks: [
            {
              t: "list",
              items: [
                "**Email invitations for new users** — Add user now sends an email so people create their own password. A temporary password is still available. (Settings → Users & roles)",
                "**Mobile numbers for staff** — add a mobile when creating a user, or edit it in the Users table. It's used for automatic variation texts.",
                "**Automatic variation alerts** — Security Managers are texted and emailed when a request needs acknowledging; approvers when it's ready to approve. (Variations → Automatic alerts)",
                "**Guards told about shift changes** — when an approved variation changes a signed-on guard's time or location, their phone shows a “Your shift has changed” banner and a text is queued.",
                "**Export all variations** — one click downloads every variation for the event as a spreadsheet. (Variations → Variation register)",
                "**Remove a user** — a Remove button in Settings → Users & roles deletes someone's login. (Section 10.5)",
                "**Searchable user guides** — these guides now live inside the app.",
                "**Real texts through Tall Bob, one account per event** — set each event's Tall Bob sub-account in Settings → Events → SMS integration. Communications then sends real texts and shows whether each one was delivered. (Sections 9 and 10.2)",
              ],
            },
            { t: "note", tone: "info", text: "Texts only send for events whose Tall Bob connection has passed a test. Emails start sending once the email domain finishes verifying." },
          ],
        },
      ],
    },
    {
      id: "key-ideas",
      title: "1. Key ideas",
      intro: "Six ideas explain how the whole app fits together. It's worth reading these first.",
      topics: [
        {
          id: "ideas",
          title: "How it fits together",
          blocks: [
            {
              t: "table",
              head: ["Idea", "What it means in the app"],
              rows: [
                ["**Event**", "A festival or venue with its own time zone. Everything — roster, sign-ons, variations, messages — belongs to the event chosen in the drop-down at the top of each page."],
                ["**Security provider (contractor)**", "A company supplying guards. Security user types (Security Manager, Security Zone Manager, Security Sign In) belong to one provider and only ever see that provider's positions, guards and requests."],
                ["**Position (shift)**", "One guard-sized slot in the roster, identified by its Shift ID. Positions list roles only, never names. A guard is linked to a position only when they are signed on at the Sign-in desk."],
                ["**Original vs current approved roster**", "Your first roster upload is kept permanently as Original Roster – Version 1 (the contractual baseline). The Current approved roster is what the app runs on. Only approved variations change it, and each approval creates a new version."],
                ["**Variation**", "A request to change the roster: extend or reduce a shift, change scope or redeploy, or add guards. It goes: request → contractor acknowledgement → approval → the roster updates automatically, once."],
                ["**Sign-on and automatic sign-off**", "Guards are signed on at the Sign-in desk. They are signed off automatically at their shift's current approved finish time (checked every 5 minutes). If an approved variation changes the finish, the sign-off time moves with it. There are no manual sign-off buttons."],
              ],
            },
          ],
        },
        shiftStatuses,
        {
          id: "who-sees-costs",
          title: "Who sees costs",
          blocks: [
            { t: "p", text: "Hourly rates and costs are only visible to user types with **Costs & rates** ticked — by default Super Admin and Senior Management. Security providers never see them." },
            { t: "p", text: "Even then, amounts start hidden: cost panels are collapsed and amounts are blurred until you hover over (or tap) them, so they aren't visible to someone looking over your shoulder." },
          ],
        },
      ],
    },
    {
      id: "getting-around",
      title: "2. Getting around",
      intro: "Signing in, the main screen and the controls that appear on every page.",
      topics: [
        signingIn,
        {
          id: "screen-parts",
          title: "The parts of the screen",
          blocks: [
            {
              t: "table",
              head: ["Control", "What it does"],
              rows: [
                ["**Left menu**", "Dashboard, Roster, Sign-in desk, Variations, Guards, Communications, Settings and User guides. You only see the items your user type can open."],
                ["**Collapse menu**", "At the bottom of the menu. Shrinks the menu to icons to give you more room; click Expand menu to bring it back. The app remembers your choice. On a phone or tablet the menu slides in from the menu button instead."],
                ["**Open Guard Portal**", "Opens the guards' phone view (section 11)."],
                ["**Event picker**", "The drop-down at the top left. Choose which event you're working on. It appears when there are two or more events, and the app remembers your choice."],
                ["**Admin view / Security Manager view**", "Only shown to people who can see costs. Security Manager view is a preview: it hides all costs, turns off approving and hides roster upload, and User guides shows only the Security Manager Guide, so you can see roughly what a security provider sees or work on a shared screen without showing costs. Switch back to Admin view to approve or see costs."],
                ["**Account menu**", "Your initials in the top right. Shows who you're signed in as, with links to Settings, User guides, Guard portal and Log out."],
              ],
            },
            { t: "note", tone: "info", text: "Pages update by themselves as guards sign on, positions change and variations move along, so you don't need to refresh." },
          ],
        },
        userGuidesTopic,
      ],
    },
    {
      id: "new-event",
      title: "3. Setting up a new event",
      intro: "A checklist for Super Admins. Do these in order before the event starts.",
      link: { to: "/admin/settings", label: "Open Settings" },
      topics: [
        {
          id: "checklist",
          title: "Setup checklist",
          blocks: [
            {
              t: "steps",
              items: [
                "**Create the event** — Settings → Events → New event. Enter the name, venue, date and time zone, then Save. (Section 10.1)",
                "**Add the security providers** — Settings → Contractors. Add each company's name, contact, phone and email. Use the same company names as in your roster file. (Section 10.3)",
                "**Check what each user type can do** — Settings → Users & roles → Access by user type. The usual access is already set; change ticks only if you need to. (Section 10.6)",
                "**Add users** — Settings → Users & roles → Add user. Invite your event staff and at least one Security Manager per provider by email. Security Managers can then add the rest of their own team. (Section 10.4)",
                "**Enter mobile numbers** for approvers and Security Managers so they get automatic variation texts. (Section 10.5)",
                "**Connect the event's Tall Bob account** — Settings → Events → SMS integration. Save the sub-account, sender ID and API login, then click Test connection. (Section 10.2)",
                "**Upload the roster** — Roster → Upload roster. Include hourly rates if you want variations priced. This becomes Original Roster – Version 1. (Section 5.8)",
                "**Check rates** — open a few shifts on the Roster and check the cost section. Set any missing rates in the shift details. (Section 5.6)",
                "**Get guards registered** — print the sign-up poster (Guards → Sign-up QR poster) and/or register guards manually (Guards → Register guard). (Section 8)",
                "**Create SMS groups** if you'll message teams regularly (Guards → SMS groups). (Section 8.3)",
                "**Brief each security provider** — point their Security Manager to the Security Manager Guide (in User guides) and make sure they've accepted their invitation.",
              ],
            },
          ],
        },
      ],
    },
    {
      id: "dashboard",
      title: "4. Dashboard",
      intro: "The live picture of staffing for the selected event. It's the first page you see after signing in.",
      link: { to: "/admin", label: "Open Dashboard" },
      topics: [
        {
          id: "big-numbers",
          title: "The three big numbers",
          blocks: [
            {
              t: "table",
              head: ["Box", "What it counts"],
              rows: [
                ["**Guards rostered**", "Positions that are on shift right now (started and not yet finished). It isn't the total for the whole event."],
                ["**Guards signed on**", "How many of those positions have a guard signed on."],
                ["**Missing guards**", "Positions on shift right now with nobody signed on. Shown in red when it's above zero."],
              ],
            },
          ],
        },
        {
          id: "dashboard-costs",
          title: "Roster costs (needs Costs & rates)",
          blocks: [
            { t: "p", text: "A collapsed **Roster costs** bar sits under the big numbers. Click **Show** to open it. It shows Original roster cost, Current approved cost, Approved variations (the difference between the two) and Pending variations. Amounts are blurred — hover over (or tap) one to reveal it. The bar closes again when you leave the page." },
          ],
        },
        {
          id: "four-tiles",
          title: "The four tiles",
          blocks: [
            {
              t: "table",
              head: ["Tile", "What it shows", "Click it to…"],
              rows: [
                ["**Starting within 1 hour**", "Positions starting in the next hour.", "Open the Roster on the Starting in 1h tab."],
                ["**Finishing within 1 hour**", "Positions finishing in the next hour.", "Open the Roster on the Finishing in 1h tab."],
                ["**Vacant positions**", "Positions that have started with nobody signed on (the same as Missing guards).", "Open the Roster on the Vacant now tab."],
                ["**Variations**", "Requests Awaiting acknowledgement, Awaiting approval and the Pending total. Counts are requests, so a multi-shift request counts once.", "Open the Variations register filtered to that status. View all shows every pending request."],
              ],
            },
            { t: "p", text: "Click a single line inside a tile (for example one vacant position) to open that shift's details on the Roster. **View all …** opens the full list." },
          ],
        },
        {
          id: "live-table",
          title: "Live staffing table",
          blocks: [
            { t: "p", text: "A list of positions with Shift time, Position, Location, Contractor, Signed-on guard and Status. Missing positions are listed first. Use the drop-down to switch between **On now** (default), Missing, Filled, Upcoming and Completed. The search box looks through position, zone, role and contractor." },
            { t: "note", tone: "tip", text: "For a guard's name or a Shift ID, use the search on the Roster page instead — it searches those too." },
          ],
        },
      ],
    },
    {
      id: "roster",
      title: "5. Roster",
      intro: "The single source of truth for the event: every position, its current approved times and deployment, who is on post and what has changed. The page has three tabs: Current approved roster, Upload roster (Super Admin only, in Admin view) and Versions & downloads.",
      link: { to: "/admin/roster", label: "Open Roster" },
      topics: [
        {
          id: "staffing-boxes",
          title: "5.1 Staffing boxes",
          blocks: [
            { t: "p", text: "The same three numbers as the Dashboard sit at the top. Here they are clickable: **Guards rostered** and **Guards signed on** switch to the Live now tab, and **Missing guards** switches to Vacant now. They always count the whole roster, whatever filters you have set below." },
          ],
        },
        {
          id: "quick-tabs",
          title: "5.2 Quick-filter tabs",
          blocks: [
            { t: "p", text: "Each tab shows a count. Vacant turns red and Change pending turns orange when they are above zero." },
            {
              t: "table",
              head: ["Tab", "Shows"],
              rows: [
                ["**All shifts**", "Every position (after any search or filters)."],
                ["**Live now**", "Positions on shift right now."],
                ["**Vacant now**", "Positions on shift right now with nobody signed on."],
                ["**Starting in 1h**", "Positions starting within the next hour."],
                ["**Finishing in 1h**", "Positions on shift that finish within the next hour."],
                ["**Change pending**", "Positions with a variation waiting for acknowledgement or approval (or returned)."],
                ["**Changed**", "Positions changed by an approved variation, plus extra positions added by variations."],
                ["**Finished**", "Positions whose finish time has passed (newest first)."],
              ],
            },
          ],
        },
        {
          id: "roster-search",
          title: "5.3 Search, filters and grouping",
          blocks: [
            {
              t: "list",
              items: [
                "**Search** — Shift ID, position, zone, role or the name of the guard on post.",
                "**Filters** — All days, All zones, All roles, All statuses and All contractors. Clear filters appears once any are set.",
                "**Grouping** — Group by zone (default), start time, contractor or role, or No grouping. Each group heading shows how many positions it has and how many are vacant, on post or have a change pending. Click a heading to fold it away; use Collapse all / Expand all for every group.",
                "Up to 500 rows show at once. Narrow down with the tabs, search or by folding groups. Downloads always include every matching row.",
              ],
            },
          ],
        },
        {
          id: "reading-row",
          title: "5.4 Reading a row",
          blocks: [
            { t: "p", text: "Columns: Shift ID, Time, Hours, Role, Position, Zone, Contractor and Status / on post. Under the status you'll see the name of the guard on post. Other markers:" },
            {
              t: "list",
              items: [
                "**(temp)** after a position — the guard is on a temporary redeployment.",
                "**A small dot** — the shift has been changed by an approved variation.",
                "**Change pending** — a variation is waiting.",
                "**A yellow Sign on → button** — appears on vacant positions and on empty positions starting within the hour. It opens the Sign-in desk with that position already chosen.",
              ],
            },
          ],
        },
        {
          id: "shift-details",
          title: "5.5 Shift details",
          blocks: [
            { t: "p", text: "Click any row to open its details on the right." },
            {
              t: "list",
              items: [
                "**Sign a guard on to this position** — opens the Sign-in desk with this position chosen (only while it's empty and hasn't finished).",
                "**Request variation** — starts a new variation request with this shift already ticked.",
                "A banner tells you who is on post (with their sign-on and automatic sign-off times), or that the position is vacant, not started or finished.",
                "**Details tab** — the shift's variations (click one to open it), the Current approved values, the Original roster values and, if you can see costs, the cost section.",
                "**Change history tab** — a timeline from the original roster, through every change, to the current approved shift.",
              ],
            },
            { t: "note", tone: "info", text: "Times, position and scope can't be edited directly — the shift details say “Changing times, position or scope requires a variation.” This keeps the original roster intact and every change on record." },
          ],
        },
        {
          id: "roster-costs",
          title: "5.6 Costs and rates (needs Costs & rates)",
          blocks: [
            { t: "p", text: "The roster has a collapsed **Roster costs** bar. Click **Show** to see Original roster cost, Current approved cost and Change from original for the rows you've filtered. While it's open, Rate and Cost columns appear in the table. Amounts are blurred until you hover over them." },
            { t: "p", text: "To set or fix a rate, open the shift and use the **Cost (admins only)** section: enter **Hourly rate** and, optionally, **Paid hours** (the hours charged in the original roster; leave blank to use the shift length), then click **Save rate**. Variations are priced from these rates." },
          ],
        },
        {
          id: "roster-download",
          title: "5.7 Downloading the roster",
          blocks: [
            { t: "p", text: "**Download CSV** on the Current approved roster saves every row that matches your current tab, search and filters. It includes Shift ID, contractor, role, position, zone, current and original times and deployment, version and — for cost viewers — paid hours, hourly rate and cost. Guard names aren't included." },
          ],
        },
        {
          id: "roster-upload",
          title: "5.8 Uploading a roster (Super Admin only)",
          blocks: [
            { t: "p", text: "Open **Upload roster** (or click Upload roster (.xlsx / .csv)). Only Super Admins can upload, and only in Admin view." },
            {
              t: "steps",
              items: [
                "Click **Choose File** and pick a CSV or Excel file (.csv, .xlsx or .xls). For Excel, only the first sheet is read.",
                "Under **Match your columns**, check each field is matched to the right column in your file. Most are matched automatically. Fields marked * must be matched.",
                "Choose how to load it (Replace or Revise, below). If the event already has a roster, Replace is selected.",
                "Check the preview — row count, number of positions created, total cost and the first few positions. Any problem rows are listed as Row 12: ….",
                "Click **Replace roster with … positions** or **Import … positions**.",
              ],
            },
          ],
        },
        {
          id: "upload-columns",
          title: "Columns the roster file can contain",
          blocks: [
            {
              t: "table",
              head: ["Field", "Needed?", "Column names recognised automatically"],
              rows: [
                ["Shift ID", "Yes", "Shift ID, Shift, ID, Ref, Shift Ref"],
                ["Position", "Yes", "Position, Post"],
                ["Shift start", "Yes", "Start, Shift Start, Start Time, From"],
                ["Shift finish", "Yes", "Finish, End, Shift Finish, End Time, To"],
                ["Date", "If start/finish have no date", "Date, Day"],
                ["Security contractor", "No", "Contractor, Security Contractor, Provider, Company"],
                ["Role", "No", "Role"],
                ["Zone or location", "No", "Zone, Location, Area"],
                ["Number of guards required", "No (default 1)", "Guards Required, Count, Qty, Required, Headcount"],
                ["Scope description", "No", "Scope, Scope Description, Duties"],
                ["Notes", "No", "Notes, Comments"],
                ["Paid hours / Hourly rate / Total cost", "No (cost viewers)", "Paid Hours, Staff Hours, Hours / Hourly Rate, Rate, Rate per Hour / Total Cost, Cost"],
              ],
            },
            {
              t: "list",
              items: [
                "Dates are read Australian style: 2026-01-09, 9/1/2026 or 9/1/26. Excel date cells are handled automatically.",
                "Times can be 18, 18:30, 18.30, 1800 or 6:30 pm, and are read in the event's time zone.",
                "A finish earlier than the start is treated as the next day (overnight shifts).",
                "A row needing 3 guards becomes three positions: ID-1, ID-2 and ID-3.",
                "A contractor name that doesn't exist yet is created automatically (matching ignores capitals).",
                "If only total cost and paid hours are given, the hourly rate is worked out for you (and vice versa).",
                "Don't include guard names — positions are never pre-assigned to people.",
              ],
            },
          ],
        },
        {
          id: "replace-revise",
          title: "Replace or revise?",
          blocks: [
            {
              t: "table",
              head: ["Option", "What happens", "Use it when"],
              rows: [
                ["**Replace roster & set as baseline**", "Deletes all current positions for this event, plus their variations and change history, and makes this file the new Original Roster – Version 1. You'll be asked to confirm.", "Loading the first real roster, or starting again before the event."],
                ["**Revise – match by Shift ID**", "Adds only shifts whose Shift ID isn't already in the roster. Existing shifts are left exactly as they are.", "Adding extra shifts to a roster that's already live."],
              ],
            },
            { t: "note", tone: "important", text: "Replace can't be undone. Never use it once an event is running — sign-ons and variations tied to the old positions are removed. To change an existing shift, use a variation; Revise won't update it." },
          ],
        },
        {
          id: "versions",
          title: "5.9 Versions & downloads",
          blocks: [
            { t: "p", text: "Lists each roster version with its type — Original, Upload or Approved change — a description (including the variation number), number of positions and when it was created. **Download original (v1)** gives the contractual baseline as first uploaded (without positions added later by variations). **Download current approved** gives the whole current roster." },
          ],
        },
      ],
    },
    {
      id: "sign-in-desk",
      title: "6. Sign-in desk",
      intro: "Where guards are linked to positions as they arrive: find the guard, choose the position, sign them on. The desk is normally run by each security provider's own staff (Security Manager or Security Sign In users), who only see their own guards and positions. Event staff with Sign-in desk access see every provider and can pick one from the drop-down.",
      link: { to: "/admin/sign-in", label: "Open Sign-in desk" },
      topics: [
        {
          id: "desk-sign-on",
          title: "Signing a guard on",
          blocks: [
            {
              t: "steps",
              items: [
                "**Scan or look up the guard.** Scan the guard's pass with the desk scanner (see Using a desk QR scanner), or click **Scan guard QR** and point the camera at it (on their phone under Profile → My guard pass, or the Sign-on tab). Or type their name, employee ID or licence number under **Or search name, employee ID or licence** and click them.",
                "**Allocate to a position.** Pick an open position from the list on the right. Search by position, role or Shift ID, or use the zone filter at the top. Positions already started are marked **· started** in red.",
                "**Sign the guard on.** Check the button text — e.g. Sign Alex Martin on to Gate 9 Access Control — and click it. You'll see a confirmation and the guard moves to **On post now**.",
              ],
            },
          ],
        },
        {
          id: "desk-controls",
          title: "Controls at the top",
          blocks: [
            {
              t: "table",
              head: ["Control", "What it does"],
              rows: [
                ["**All zones**", "Only show positions in one zone or location."],
                ["**All contractors**", "Event staff can narrow the desk to one provider. Security provider users only see their own provider (picked automatically if they have one)."],
                ["**Starting within 2h**", "How far ahead positions are listed: 1, 2 (default), 4, 8 or 24 hours. Positions already running are always included."],
              ],
            },
          ],
        },
        {
          id: "on-post",
          title: "On post now",
          blocks: [
            { t: "p", text: "Below the desk is a list of guards currently signed on: Guard, Position, Zone, Signed on time and Auto sign-off time (the current approved finish). Click a position to open it on the Roster. There are no sign-off buttons — guards are signed off automatically." },
          ],
        },
        {
          id: "desk-rules",
          title: "Rules the desk enforces",
          blocks: [
            {
              t: "list",
              items: [
                "Guards can only be signed on here — the Guard portal has no Sign on button.",
                "A guard can't be signed on twice — guards already on post don't appear in the search. A guard marked **Signed on · needs a position** (from before phone sign-on was removed) can still be picked and placed on a position.",
                "A position can only hold one guard — filled positions disappear from the list.",
                "Security provider users can only sign on their own guards to their own positions.",
                "Choosing a position from the Roster (Sign on →) opens the desk with that position ready; you then just find the guard.",
              ],
            },
          ],
        },
        deskScanner,
        { id: "desk-messages", title: "Messages you might see", blocks: [deskMessages] },
      ],
    },
    {
      id: "variations",
      title: "7. Variations",
      intro: "How roster changes are requested, acknowledged by the security provider, approved and applied — with the cost impact shown before anyone approves. The page has two tabs: New request (needs Request variations) and Variation register, which shows the number of pending requests.",
      link: { to: "/admin/variations", label: "Open Variations" },
      topics: [
        {
          id: "variation-flow",
          title: "7.1 How a variation moves through",
          blocks: [
            { t: "p", text: "Request → Contractor acknowledges (Security Manager confirms they've received it — this isn't approval) → Approve (Senior Management or Super Admin) → the roster updates automatically, once. Approvers can approve straight away without waiting for acknowledgement." },
            variationStatuses,
          ],
        },
        {
          id: "new-request",
          title: "7.2 Making a new request",
          blocks: [
            { t: "p", text: "**Step 1 — What kind of change?** Choose one:" },
            {
              t: "table",
              head: ["Type", "Use it to"],
              rows: [
                ["**Extend / reduce shift**", "Change the start or finish of one or more shifts."],
                ["**Change scope / redeploy**", "Move a guard, or change the role, position or location of one or more shifts."],
                ["**Add guards / shifts**", "Add extra guards beyond the original roster."],
              ],
            },
            { t: "p", text: "**Step 2 — Choose the shifts and enter the change.** Search by Shift ID, position, zone or time and tick one or more shifts (ticks stay when you change the search). **Select all shown** ticks everything in the list; **Clear** unticks all. Finished shifts are marked Finished and can still be varied." },
            { t: "p", text: "**Extend / reduce shift:** each ticked shift has its own **New start** and **New finish** boxes (format YYYY-MM-DD HH:mm, event time zone), filled in with the current times. Change each one. Every ticked shift must actually change — untick any you don't want to alter. Cost viewers see the rate, current cost, proposed cost and cost change." },
            { t: "p", text: "**Change scope / redeploy:** with one shift ticked, choose **Change role / position / location of this shift** or **Move this guard to another vacant position** (then pick the vacant destination). With several shifts ticked, enter a New role, New position and New zone / location for each one. Set **Effective from** and **Duration**: Remainder of shift, or Temporary, then return with a Return at time. Temporary moves return automatically." },
            { t: "p", text: "**Add guards / shifts:** enter the Contractor, Number of additional guards, Role, Position, Zone, Start and Finish. Cost viewers can enter an Hourly rate; leave it blank to use the usual rate for that role." },
            { t: "p", text: "**For every type:** enter a **Reason for change** (required), check **Requested by** (your email by default) and add Notes if helpful. Click **Review**." },
            { t: "p", text: "**Step 3 — Review and submit.** Check the Original and Proposed details for each shift, then click **Submit variation** (or Submit variation for 3 shifts). A multi-shift request is one item in the register but each shift is priced, acknowledged and approved individually." },
            { t: "note", tone: "tip", text: "The fastest way to start a request is from the Roster: open a shift and click **Request variation** — the shift is already ticked." },
          ],
        },
        {
          id: "register",
          title: "7.3 The variation register",
          blocks: [
            { t: "p", text: "Filter by status (including **All pending**, which shows requests awaiting acknowledgement or approval), by type and by contractor. Columns: ID (multi-shift requests show e.g. 3 shifts), Type, Requested, Contractor, Reason, Acknowledged and Approved (shown as e.g. 2 of 3 for multi-shift requests), Cost impact (cost viewers) and Status. Cost viewers also see the approved and pending cost totals above the table." },
          ],
        },
        {
          id: "export-variations",
          title: "Exporting all variations",
          blocks: [
            { t: "note", tone: "new", text: "New in this update." },
            { t: "p", text: "Click **Export all** at the top of the Variation register to download every variation for the selected event as a spreadsheet (CSV), whatever filters are set." },
            {
              t: "list",
              items: [
                "One row per shift — a 3-shift request gives 3 rows sharing the same request reference.",
                "Includes the shift ID, type, status, original and new times or deployment, reason, notes, who requested and acknowledged it, who decided (approved, returned or declined) and when, with comments, and when it was applied to the roster.",
                "Cost columns (rate, cost before, cost after, cost change) are included only for people who can see costs, and not in Security Manager view.",
              ],
            },
          ],
        },
        {
          id: "approving",
          title: "7.4 Approving, returning or declining",
          blocks: [
            {
              t: "steps",
              items: [
                "Click the request in the register (or a link from the Dashboard, Roster or an alert email).",
                "Check the Original and Proposed details, the reason and — if you see costs — the Cost section (hourly rate, paid hours, cost before, cost after and cost change).",
                "Add **Comments** (optional) — they're saved with your decision.",
                "Click **Approve**, **Return for clarification** or **Decline**. For a multi-shift request the buttons act on every pending shift in it (e.g. Approve 3 shifts, Decline all pending).",
              ],
            },
            { t: "p", text: "If the provider hasn't acknowledged yet, a note says so — you can still approve directly. **Acknowledge as contractor** only appears for people who can acknowledge but not approve (normally Security Managers)." },
            { t: "note", tone: "info", text: "In Security Manager view the Approve button is hidden. Switch back to Admin view to approve." },
          ],
        },
        {
          id: "on-approval",
          title: "What happens when you approve",
          blocks: [
            {
              t: "list",
              items: [
                "**Time change** — the shift's current approved start/finish update, and the guard's automatic sign-off moves to the new finish. For a finished shift, an automatic sign-off already recorded moves to the new finish.",
                "**Redeploy** — the position, role or zone updates (or a temporary redeployment is set that returns automatically). A moved guard is transferred to the new position.",
                "**Add guards** — new positions are created, marked as additional approved scope, ready for guards to be signed on at the desk.",
                "Costs, the change history and a new roster version are recorded. Each request can only be applied once.",
                "**Guards on post are told automatically** — for time and location changes, the guard's phone shows a “Your shift has changed” banner and a text is queued to them (section 11).",
                "A **Message affected guards** button also appears — it opens Communications with the guards currently on those positions selected and a message pre-written, if you want to add more detail.",
              ],
            },
            { t: "note", tone: "tip", text: "A returned request can't be edited. If the change itself needs to be different, decline it and submit a new request with the corrected details." },
          ],
        },
        {
          id: "automatic-alerts",
          title: "7.5 Automatic alerts to acknowledgers and approvers",
          blocks: [
            { t: "note", tone: "new", text: "New in this update." },
            { t: "p", text: "The app texts and emails the right people at each step, so nobody has to watch the register:" },
            {
              t: "table",
              head: ["When", "Who is alerted", "What they get"],
              rows: [
                ["**A new request is submitted**", "Security Managers (anyone who can acknowledge) at the affected provider. If that provider has nobody who can acknowledge, approvers are alerted instead.", "A text and an email saying the variation needs acknowledgement: reference, number of shifts, type of change, who requested it and a button/link straight to it."],
                ["**Nothing in the request is waiting for acknowledgement any more**", "Everyone who can approve — Senior Management and Super Admins by default.", "A text and an email saying it's ready for approval, with the provider, who acknowledged it and a link."],
              ],
            },
            {
              t: "list",
              items: [
                "A multi-shift request sends one alert, not one per shift.",
                "The person who made the change isn't alerted about their own action.",
                "Texts go to the mobile number in Settings → Users & roles; emails go to each person's sign-in email. People without a mobile only get the email.",
                "Every alert is recorded in Communications → SMS history as **Automatic alert: VAR-… · acknowledgement needed** (or approval needed).",
              ],
            },
            { t: "note", tone: "important", text: "Alert texts go out through the Tall Bob account of the variation's event. If that event's SMS isn't set up, the alert shows as **Failed** in SMS history. Emails start sending once the email domain finishes verifying; if one can't be sent, the app retries every 15 minutes for up to 24 hours." },
          ],
        },
      ],
    },
    {
      id: "guards",
      title: "8. Guards",
      intro: "The guard directory, registering guards, SMS groups and the sign-up poster. Guards only come into the app two ways: they register themselves from their phone, or they're registered manually. There's no bulk guard upload.",
      link: { to: "/admin/guards", label: "Open Guards" },
      topics: [
        {
          id: "directory",
          title: "8.1 Directory",
          blocks: [
            { t: "p", text: "Lists every guard with Name, Employee ID, Contractor, Phone (tap to call), Licence and whether they're Signed on. Search by name, employee ID, phone or licence, and filter by contractor. Event staff can change a guard's provider straight from the Contractor drop-down in the list — use this if a guard picked the wrong company when they registered." },
          ],
        },
        {
          id: "register-guard",
          title: "8.2 Register guard",
          blocks: [
            {
              t: "steps",
              items: [
                "Fill in **Full name**, **Employee ID** and **Mobile** (all required), plus Email, Security licence and Emergency contact.",
                "Choose the guard's **Contractor**. This links them to their provider so that provider's desk can sign them on.",
                "Click **Add guard**.",
              ],
            },
            { t: "p", text: "The **Self-registration link** panel shows the sign-up QR code and link. Use **Copy link** to paste it into a message, or **Make a branded poster**." },
            { t: "note", tone: "info", text: "Guards who register themselves must choose their security provider during sign-up, so they appear in that provider's Directory and at their Sign-in desk straight away — no extra linking step." },
          ],
        },
        {
          id: "sms-groups",
          title: "8.3 SMS groups",
          blocks: [
            {
              t: "steps",
              items: [
                "Enter a group **Name** (e.g. Gate 1 team).",
                "Find guards with the search box (name, mobile or employee ID). Narrow the list with All contractors or tick **Signed on now**.",
                "Tick each guard, or use **Select all shown**. Guards marked **No mobile** can't be added. **Clear shown** unticks the guards in view.",
                "Click **Create group**.",
              ],
            },
            { t: "p", text: "Saved groups appear on the right with their guard and mobile-number counts. Use **View** to see members, **Edit** to change them and **Delete** to remove the group. Groups are fixed lists of people — they don't change automatically." },
          ],
        },
        {
          id: "poster",
          title: "8.4 Sign-up QR poster",
          blocks: [
            {
              t: "table",
              head: ["Setting", "Options"],
              rows: [
                ["**Security provider**", "Any — guards choose their provider (default), or pick one provider to pre-fill it for everyone who scans this poster. Handy when each provider puts up their own poster."],
                ["**Logo**", "Upload your logo image (Remove logo to take it off)."],
                ["**Headline**", "Default: SECURITY STAFF REGISTRATION"],
                ["**Subtitle**", "Default: Scan to register before your first shift"],
                ["**Event / venue name**", "Optional — shown on the poster."],
                ["**Footer note**", "Default: Questions? See your supervisor at the sign-in desk."],
                ["**Brand colour**", "Safety yellow, High-vis orange, Security blue, Green, Red, or your own custom colour."],
                ["**Background**", "Light (print) or Dark (screens)."],
              ],
            },
            { t: "p", text: "Then click **Print / save as PDF** (choose “Save as PDF” in the print window for a file), **Download QR code (PNG)** for just the code, or **Copy registration link**. The poster explains the three steps to guards: scan, fill in the profile, show the guard pass at the sign-in desk." },
          ],
        },
      ],
    },
    {
      id: "communications",
      title: "9. Communications",
      intro: "Writing messages to guards and keeping a record of what was sent to whom — including the app's automatic alerts.",
      link: { to: "/admin/communications", label: "Open Communications" },
      topics: [
        {
          id: "sms-status",
          title: "Which Tall Bob account is used",
          blocks: [
            { t: "note", tone: "new", text: "New: real texts through each event's own Tall Bob account." },
            { t: "p", text: "Every text goes out through the Tall Bob account of the event it's for — the event picked at the top of the screen, or the variation's event for automatic alerts. Nobody chooses an account when sending, and the app never borrows another event's account." },
            { t: "p", text: "A green banner shows the sender ID and Tall Bob account being used. A red banner means the event's SMS isn't ready (not set up, switched off, or its connection hasn't passed a test) — the Send button stays off until a Super Admin fixes it in Settings → Events → SMS integration." },
            { t: "p", text: "Guards also see every message in their Guard portal under Messages." },
          ],
        },
        {
          id: "send-message",
          title: "Sending a message",
          blocks: [
            {
              t: "steps",
              items: [
                "Under **Send to**, choose the audience (table below) and pick the guards, group, shift time, variation or contractor.",
                "Click a template — **Shift extension**, **Shift reduction**, **Change of position**, **Change of location**, **Redeployment**, **Additional shift**, **Shift cancellation** or **General roster update** — or type your own message. With a variation chosen, templates fill in the details from that variation and the current roster; anything unknown shows in [brackets] for you to fill in.",
                "Check the recipient count. Guards without a valid Australian mobile are skipped, and the same number is only texted once per send.",
                "Click **Send SMS to … guards**. Clicking twice, or retrying after a slow connection, won't send it twice.",
              ],
            },
            {
              t: "table",
              head: ["Send to", "Who receives it"],
              rows: [
                ["Individual / selected guards", "The guards you tick (search by name, employee ID or mobile)."],
                ["A guard group", "Everyone in a saved SMS group."],
                ["All guards at this event", "Every guard who has been signed on at this event."],
                ["Everyone on a shift time", "Guards currently signed on to positions with the chosen start and finish time."],
                ["Everyone signed on in a zone", "Guards currently on post in the chosen zone."],
                ["All guards of a security contractor", "Every guard registered to one provider."],
                ["Everyone currently signed on", "Every guard on post right now."],
                ["Guards affected by an approved variation", "Guards currently signed on to the positions in an approved variation. The message is pre-written from the variation and the current roster."],
              ],
            },
            { t: "note", tone: "tip", text: "{name} is replaced with each guard's first name. Security providers can only text their own guards." },
          ],
        },
        {
          id: "history",
          title: "SMS history and delivery",
          blocks: [
            { t: "p", text: "Shows the latest 200 messages for this event (or **All events**) with date, event, Tall Bob account and sender ID, who sent it, audience, recipients, message and status. Click a message to see each recipient: their number, guard, Tall Bob SMS ID, whether Tall Bob accepted it, delivery status and any error. The internal reference links it to Tall Bob's records." },
            {
              t: "table",
              head: ["Status", "Meaning"],
              rows: [
                ["Pending", "Waiting to go to Tall Bob."],
                ["Submitted", "Tall Bob accepted it."],
                ["Queued", "Tall Bob has prepared it for sending. Not delivered yet."],
                ["Sent", "Passed to the phone network."],
                ["Delivered", "The phone network confirmed it reached the handset."],
                ["Failed", "Not sent or not delivered — the error says why (for example an invalid number, no credit or the event's SMS isn't set up)."],
                ["Skipped (duplicate)", "The same number was already in this send."],
              ],
            },
            { t: "p", text: "Delivery updates arrive by themselves from Tall Bob. Click **Refresh** to see the latest." },
            { t: "p", text: "Messages the app creates by itself show **Automatic alert** as the sender. The audience says what they were for — for example **Automatic alert: VAR-0012 · approval needed** (staff alert) or **Automatic alert: VAR-0012 · Gate 9** (guards on a changed shift)." },
          ],
        },
      ],
    },
    {
      id: "settings",
      title: "10. Settings",
      intro: "Events, security providers, user logins and what each user type can see and do. Settings has three tabs: Events (including each event's SMS integration), Contractors and Users & roles. Super Admins and Event Managers see Settings by default. Security Managers only see a cut-down Users page for their own team.",
      link: { to: "/admin/settings", label: "Open Settings" },
      topics: [
        {
          id: "events",
          title: "10.1 Events",
          blocks: [
            {
              t: "steps",
              items: [
                "Click **New event** (or click an existing event to edit it).",
                "Enter the **Event name**, **Venue**, **Date** and **Time zone** (Australian time zones, Auckland, London and UTC are available; default Australia/Sydney). All roster times are read and shown in this time zone.",
                "Click **Save**.",
              ],
            },
          ],
        },
        {
          id: "event-sms",
          title: "10.2 SMS integration (Tall Bob) for an event",
          blocks: [
            { t: "note", tone: "new", text: "New. Shown to Super Admins and anyone given **Set up event SMS (Tall Bob)**." },
            { t: "p", text: "Each event has its own Tall Bob sub-account, login and sender ID. Pick the event on the left, then fill in **SMS integration** under its settings." },
            {
              t: "steps",
              items: [
                "Enter the **Tall Bob sub-account name** and the **Sender ID** (up to 11 letters/numbers, or the event's Tall Bob virtual number).",
                "Choose **Production** for real texts or **Test (Tall Bob sandbox)** for trials.",
                "Enter the **API username** and **API key** from Tall Bob → Settings → API Credentials. Or choose **Use another event's account** if two events share one Tall Bob account.",
                "Tick **SMS enabled** and click **Save SMS settings**.",
                "Click **Test connection**. It checks the login works with Tall Bob, shows the account balance and switches on delivery tracking. Optionally enter your mobile and click **Send test SMS**.",
              ],
            },
            { t: "note", tone: "important", text: "Texts can only be sent once the test passes. Saved logins are encrypted and can never be viewed again — only replaced (**Replace / rotate**). Replacing them, or switching between test and production, needs a new test." },
            { t: "p", text: "The panel shows the connection status, last successful test and last configuration update." },
          ],
        },
        {
          id: "contractors",
          title: "10.3 Contractors",
          blocks: [
            { t: "p", text: "Lists each security provider with Contact, Phone, Email and how many Guards are registered to them. To add one, fill in the boxes under the table (Name is required) and click **Add**. Providers named in an uploaded roster are also added automatically." },
          ],
        },
        {
          id: "add-user",
          title: "10.4 Adding a user",
          blocks: [
            { t: "note", tone: "new", text: "Updated: email invitations and mobile numbers." },
            { t: "p", text: "Each person has one user type, and their access comes from that type. Security user types also belong to a security provider." },
            {
              t: "steps",
              items: [
                "Click **Add user**.",
                "Enter their **Full name** and **Email**.",
                "Enter their **Mobile (optional)** — used to text them when a variation needs their acknowledgement or approval.",
                "Choose how they get access: **Email invitation** (default) emails them a link to create their own password. **Temporary password** lets you set one yourself (click New for another, or type your own — at least 8 characters).",
                "Choose the **User type**. For Security Manager, Security Zone Manager or Security Sign In, also choose their **Security provider**.",
                "Click **Send invitation** (or **Add user** for a temporary password).",
              ],
            },
            { t: "p", text: "With an invitation you'll see “Invitation sent to …”. The person clicks **Set your password** in the email, chooses a password and is signed straight in. With a temporary password, click **Copy login details** and send them to the person yourself — ask them to keep it private." },
            { t: "p", text: "Super Admins can add any user type. Security Managers can add only Security Manager, Security Zone Manager and Security Sign In users for their own provider." },
            { t: "note", tone: "info", text: "Invitation emails start arriving once the email domain finishes verifying. Until then, use Temporary password if someone needs access straight away." },
          ],
        },
        {
          id: "mobiles",
          title: "10.5 Mobile numbers, removing users and changing a user's type",
          blocks: [
            { t: "note", tone: "new", text: "New in this update." },
            { t: "p", text: "The Users table now has a **Mobile** column. Click **Edit** (or **Add** where it says No mobile), type the number and click **Save**. Super Admins can edit anyone's mobile; everyone can edit their own; Security Managers can edit their own team's. Without a mobile, a person still gets alert emails but no texts." },
            { t: "p", text: "**Remove a user:** click **Remove** next to the person and confirm. Their login is deleted straight away — they can't sign in or receive alerts any more — but their name stays on past variations, sign-ons and messages. It can't be undone; to give them access again, add them as a new user. Super Admins can remove anyone except themselves; Security Managers can remove only Security Manager, Security Zone Manager and Security Sign In users of their own provider. Guards aren't removed here." },
            { t: "p", text: "**Change a user's type:** click **Change type** next to the person (Super Admin only), choose the new User type (and provider for security types) and click **Save user type**. You can't remove your own Super Admin access — another Super Admin has to." },
          ],
        },
        {
          id: "access",
          title: "10.6 Access by user type",
          blocks: [
            {
              t: "steps",
              items: [
                "Choose a **User type**. You'll see how many people have it.",
                "Tick or untick items under **Can view** (which pages appear) and **Can do** (which actions are allowed).",
                "Click **Save access**. People see the change next time they refresh. **Reset to usual access** puts the default ticks back (then click Save access).",
              ],
            },
            { t: "p", text: "Only Super Admins can change ticks, and Super Admin always has everything. Uploading rosters and managing users stay with Super Admins whatever is ticked." },
            {
              t: "table",
              head: ["Tick box", "Group", "What it allows"],
              rows: [
                ["Dashboard", "Can view", "Live staffing numbers and missing positions"],
                ["Roster", "Can view", "The current approved roster and its history"],
                ["Costs & rates", "Can view", "Hourly rates, shift costs and variation cost impact"],
                ["Variations", "Can view", "The variation register and request details"],
                ["Guards", "Can view", "The guard directory, guard registration, SMS groups and the sign-up poster"],
                ["Sign-in desk", "Can view", "The Sign-in desk page"],
                ["Communications", "Can view", "Messages to guards and message history"],
                ["Settings", "Can view", "Events, contractors and users"],
                ["Request variations", "Can do", "Raise new variation requests"],
                ["Acknowledge variations", "Can do", "Acknowledge requests for their security provider (and receive acknowledgement alerts)"],
                ["Approve variations", "Can do", "Give final approval so the roster updates (and receive approval alerts)"],
                ["Sign guards on to positions", "Can do", "Scan or look up guards and sign them on to a position"],
                ["Add security provider users", "Can do", "Create logins for Security Managers, Security Zone Managers and Security Sign In users of their own provider"],
              ],
            },
          ],
        },
        {
          id: "default-access",
          title: "Default access for each user type",
          blocks: [
            {
              t: "table",
              head: ["Access", "Super Admin", "Senior Mgmt", "Event Mgr", "Event Control Asst", "Security Mgr", "Security Zone Mgr", "Security Sign In"],
              rows: [
                ["Dashboard", "✓", "✓", "✓", "✓", "✓", "✓", "—"],
                ["Roster", "✓", "✓", "✓", "✓", "✓", "✓", "—"],
                ["Costs & rates", "✓", "✓", "—", "—", "—", "—", "—"],
                ["Variations", "✓", "✓", "✓", "✓", "✓", "✓", "—"],
                ["Guards", "✓", "✓", "✓", "✓", "✓", "✓", "—"],
                ["Sign-in desk", "✓", "—", "✓", "—", "✓", "—", "✓"],
                ["Communications", "✓", "✓", "✓", "—", "✓", "—", "—"],
                ["Settings", "✓", "—", "✓", "—", "Users only*", "—", "—"],
                ["Request variations", "✓", "✓", "✓", "—", "✓", "✓", "—"],
                ["Acknowledge variations", "✓", "—", "—", "—", "✓", "—", "—"],
                ["Approve variations", "✓", "✓", "—", "—", "—", "—", "—"],
                ["Sign guards on", "✓", "—", "—", "—", "✓", "—", "✓"],
                ["Add provider users", "✓", "—", "—", "—", "✓", "—", "—"],
                ["Sees only own provider", "—", "—", "—", "—", "✓", "✓", "✓"],
              ],
            },
            { t: "p", text: "* Security Managers don't see the full Settings page; Add security provider users gives them a Users page for their own team. Security user types only ever see their own provider's positions, guards and requests. Everyone can open User guides." },
          ],
        },
      ],
    },
    {
      id: "guard-portal",
      title: "11. What guards see (Guard portal)",
      intro: "Guards use the Guard portal on their own phone. It's useful to know what they see so you can help them.",
      link: { to: "/mobile", label: "Open Guard portal" },
      topics: [guardRegistering, guardTabs, guardShiftChanged, { id: "guard-desk-only", title: "Signing on", blocks: [guardDeskOnly] }],
    },
    {
      id: "event-day",
      title: "12. Event day routine",
      intro: "A suggested running order for the control room.",
      topics: [
        {
          id: "before-gates",
          title: "Before gates open",
          blocks: [{ t: "list", items: [
            "Pick the event in the event picker and open the Dashboard.",
            "Check the Roster's **Starting in 1h** tab and make sure each provider's desk is set up.",
            "Clear any pending variations (Dashboard → Variations tile).",
            "Check approvers and Security Managers have mobile numbers so alerts reach them.",
          ] }],
        },
        {
          id: "during-event",
          title: "During the event",
          blocks: [{ t: "list", items: [
            "Watch **Missing guards** and **Vacant positions**. Click the tile to see which positions are empty and follow up with the provider.",
            "When a change is needed, raise a variation from the shift on the Roster. The provider is alerted automatically; approve it when you get the “ready for approval” alert — or straight away if it's urgent.",
            "After approval, guards on post are told automatically. Use **Message affected guards** if you need to add detail.",
            "Use the **Finishing in 1h** tab to spot shifts that may need extending.",
          ] }],
        },
        {
          id: "after-event",
          title: "After the event",
          blocks: [{ t: "list", items: [
            "Guards are signed off automatically — no action needed.",
            "Download the current approved roster (Roster → Versions & downloads) and the original v1 for reconciliation.",
            "Click **Export all** in the Variation register for a full record of every change, and filter by Approved to review the cost impact.",
          ] }],
        },
      ],
    },
    {
      id: "troubleshooting",
      title: "13. Troubleshooting",
      intro: "Common questions and what to do.",
      topics: [
        {
          id: "problems",
          title: "Common problems",
          blocks: [
            {
              t: "table",
              head: ["Problem", "What to do"],
              rows: [
                ["Someone never got their invitation email", "Ask them to check spam/junk. Emails only start once the email domain finishes verifying — until then add them with a Temporary password and pass on the details yourself."],
                ["The Set your password link doesn't work", "Links expire. Ask a Super Admin to set the person up again with a temporary password."],
                ["“Your account has no access role yet”", "A Super Admin gives the person a user type in Settings → Users & roles. They then refresh."],
                ["“You don't have access to this page”", "Their user type doesn't have that page ticked. A Super Admin can tick it in Access by user type."],
                ["A page is missing from the menu", "Same as above — the menu only shows pages your user type can view."],
                ["I can't see costs", "Check you're in Admin view, not Security Manager view, and that your user type has Costs & rates. A shift with no rate shows no cost — set one in its shift details."],
                ["I can't approve a variation", "Switch to Admin view. Your user type needs Approve variations (Super Admin and Senior Management by default)."],
                ["“This shift was changed by another approved variation…”", "Another change was approved after this request was made. Return or decline it and raise a fresh request."],
                ["Nobody got an alert about a variation", "Texts need the event's Tall Bob connection to be set up and tested. For email, check the person can acknowledge/approve, and that they weren't the one who made the change. Check Communications → SMS history for the Automatic alert."],
                ["A guard doesn't appear at the Sign-in desk", "They may already be signed on (see On post now) or belong to another provider. Check the provider shown against their name in Guards → Directory."],
                ["A position doesn't appear at the desk", "It may be filled, finished, outside the Starting within window, hidden by the zone filter or belong to another provider."],
                ["A shift's time is wrong", "Raise an Extend / reduce variation. Times can't be edited directly."],
                ["Texts can't be sent for an event", "Check Settings → Events → SMS integration for that event: credentials and sender ID saved, SMS enabled, and **Test connection** passed."],
                ["A text shows Failed", "Click it in SMS history to see the error for each recipient — for example an invalid mobile, no Tall Bob credit, a sender ID Tall Bob doesn't accept, or the event's SMS not being set up."],
                ["I replaced the roster by mistake", "Replace can't be undone. Upload the correct file again with Replace. Variations tied to the old roster will need re-entering."],
              ],
            },
          ],
        },
      ],
    },
    liveMapSection,
  ],
};
