import type { Guide } from "./types";
import { GUIDE_UPDATED, deskMessages, deskScanner, liveMapSection, guardDeskOnly, guardRegistering, guardShiftChanged, guardTabs, shiftStatuses, signingIn, userGuidesTopic, variationStatuses } from "./shared";

export const securityManagerGuide: Guide = {
  id: "security",
  title: "Security Manager Guide",
  audience: "Security Managers of a contracted security provider — also useful for Security Zone Manager and Security Sign In users",
  updated: GUIDE_UPDATED,
  intro: "For security providers working an event run by Out There Group: what each part of the app does for you, how to set your team up and how to use it on the day — especially the Sign-in desk and variations. You only ever see your own company's positions, guards and requests. Costs and rates are never shown to security providers.",
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
                "**You're alerted when a variation needs you** — new requests for your company send you a text and an email with a link straight to it. (Section 8.2)",
                "**Email invitations for your team** — Add user now emails people a link to create their own password. (Section 10)",
                "**Mobile numbers** — add your team's mobiles so they get variation texts. (Section 10)",
                "**Guards told about shift changes** — when an approved variation changes a signed-on guard's time or location, their phone shows a “Your shift has changed” banner and a text is queued. (Section 11)",
                "**Export all variations** — download every variation for your company as a spreadsheet. (Section 8.4)",
                "**Remove team members** — a Remove button deletes the login of someone who has left. (Section 10)",
                "**Searchable user guides** — this guide now lives inside the app.",
              ],
            },
            { t: "note", tone: "info", text: "**Real texts** — Communications now sends real texts through the event's own Tall Bob account and shows whether each was delivered. Emails start once the event's email domain finishes verifying." },
          ],
        },
      ],
    },
    {
      id: "what-you-can-do",
      title: "1. What you can do",
      intro: "Your access comes from your user type. These are the usual settings — the event's Super Admin can change them.",
      topics: [
        {
          id: "can-cant",
          title: "As a Security Manager",
          blocks: [
            {
              t: "table",
              head: ["You can…", "You can't…"],
              rows: [
                ["See the Dashboard, Roster, Variations, Guards, Sign-in desk and Communications for your company", "See other providers' positions, guards or requests"],
                ["Sign your guards on to positions at the Sign-in desk", "Sign guards off — they're signed off automatically at the end of their shift"],
                ["Acknowledge, return or decline variations for your company", "Approve variations — Senior Management or a Super Admin does that"],
                ["Request variations (extend/reduce, redeploy, add guards)", "See hourly rates or costs"],
                ["Register guards and create SMS groups", "Upload or replace the roster"],
                ["Add logins for your own team", "Change what each user type can access"],
              ],
            },
          ],
        },
        {
          id: "other-types",
          title: "Other security user types",
          blocks: [
            {
              t: "table",
              head: ["User type", "Usual access"],
              rows: [
                ["**Security Manager**", "Everything in the left column above. Receives acknowledgement alerts."],
                ["**Security Zone Manager**", "Views the Dashboard, Roster, Variations and Guards, and can request variations. Can't sign guards on or acknowledge."],
                ["**Security Sign In**", "Only the Sign-in desk: finds guards and signs them on."],
              ],
            },
          ],
        },
      ],
    },
    {
      id: "key-ideas",
      title: "2. Key ideas",
      intro: "A few ideas explain how everything fits together.",
      topics: [
        {
          id: "ideas",
          title: "How it fits together",
          blocks: [
            {
              t: "table",
              head: ["Idea", "What it means for you"],
              rows: [
                ["**Position (shift)**", "One guard-sized slot in the roster, with a Shift ID, role, position, zone and times. The roster lists roles only, never names."],
                ["**Linking guards to positions**", "You link a guard to a position when they arrive, at the Sign-in desk. That's the only way guards are linked to positions."],
                ["**Current approved roster**", "The roster everyone works from. It only changes when a variation is approved, and every change is recorded."],
                ["**Variation**", "A request to change the roster. You acknowledge that your company has received it; the event approves it; then the roster updates automatically."],
                ["**Automatic sign-off**", "Guards are signed off automatically at their shift's current approved finish time. If an approved variation changes the finish, the sign-off time moves too. Nobody needs to sign guards off."],
                ["**Guard pass**", "Each registered guard has a personal QR code in the Guard portal (Profile → My guard pass). Scanning it at the desk — with a desk scanner or the laptop camera — finds them instantly."],
              ],
            },
          ],
        },
        shiftStatuses,
      ],
    },
    {
      id: "getting-started",
      title: "3. Getting started",
      intro: "Signing in and finding your way around.",
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
                ["**Left menu**", "The pages you can open, plus User guides. Collapse menu at the bottom shrinks it to icons."],
                ["**Event picker**", "The drop-down at the top left. Choose the event you're working (shown when there's more than one)."],
                ["**Account menu**", "Your initials, top right: who you're signed in as, User guides, Guard portal and Log out."],
              ],
            },
            { t: "note", tone: "info", text: "Pages update by themselves as guards sign on and variations move along — no need to refresh." },
          ],
        },
        userGuidesTopic,
        {
          id: "setup-checklist",
          title: "Before the event: setup checklist",
          blocks: [
            {
              t: "steps",
              items: [
                "**Add your team** — Settings → Add user for each supervisor and sign-in desk operator, with their mobile number. (Section 10)",
                "**Add your own mobile** in Settings so you're texted when a variation needs acknowledging. (Section 10)",
                "**Register your guards** — Guards → Register guard, choosing your company as the contractor. (Section 7.2)",
                "**Print the sign-up poster** if you want guards to set up their own Guard portal and pass. (Section 7.4)",
                "**Check the roster** — Roster page, filtered to your positions. Report any errors to the event so they can raise a variation. (Section 5)",
                "**Create SMS groups** for teams you'll message often. (Section 7.3)",
                "**Test the Sign-in desk** on the device you'll use, including the desk scanner or camera for scanning passes. (Section 6)",
              ],
            },
          ],
        },
      ],
    },
    {
      id: "dashboard",
      title: "4. Dashboard",
      intro: "A live picture of your company's staffing for the selected event.",
      link: { to: "/admin", label: "Open Dashboard" },
      topics: [
        {
          id: "tiles",
          title: "Boxes and tiles",
          blocks: [
            {
              t: "table",
              head: ["Box / tile", "What it shows", "Click it to…"],
              rows: [
                ["**Guards rostered**", "Your positions on shift right now.", "—"],
                ["**Guards signed on**", "How many of those have a guard signed on.", "—"],
                ["**Missing guards**", "Your positions on shift right now with nobody signed on (red when above zero).", "—"],
                ["**Starting within 1 hour**", "Positions starting in the next hour.", "Open the Roster on that list."],
                ["**Finishing within 1 hour**", "Positions finishing in the next hour.", "Open the Roster on that list."],
                ["**Vacant positions**", "Positions that have started with nobody signed on.", "Open the Roster on Vacant now."],
                ["**Variations**", "Requests awaiting acknowledgement, awaiting approval and the pending total.", "Open the register filtered to that status."],
              ],
            },
            { t: "p", text: "Click a single line in a tile to open that shift on the Roster. The **Live staffing table** lists positions with time, position, location, signed-on guard and status — missing positions first. Switch between On now, Missing, Filled, Upcoming and Completed, or search by position, zone or role." },
            { t: "note", tone: "tip", text: "Keep the Dashboard open on a screen at your desk. When Missing guards goes red, click Vacant positions to see exactly which posts are empty." },
          ],
        },
      ],
    },
    {
      id: "roster",
      title: "5. Roster",
      intro: "Your company's positions in the current approved roster — who is on post, what's vacant and what has changed.",
      link: { to: "/admin/roster", label: "Open Roster" },
      topics: [
        {
          id: "quick-tabs",
          title: "Quick-filter tabs",
          blocks: [
            {
              t: "table",
              head: ["Tab", "Shows"],
              rows: [
                ["**All shifts**", "All your positions."],
                ["**Live now**", "Positions on shift right now."],
                ["**Vacant now**", "On shift right now with nobody signed on."],
                ["**Starting in 1h / Finishing in 1h**", "Positions starting or finishing within the hour."],
                ["**Change pending**", "Positions with a variation waiting."],
                ["**Changed**", "Positions changed by an approved variation, or added by one."],
                ["**Finished**", "Positions whose finish time has passed."],
              ],
            },
          ],
        },
        {
          id: "finding",
          title: "Finding positions",
          blocks: [{ t: "list", items: [
            "Search by Shift ID, position, zone, role or the name of the guard on post.",
            "Filter by day, zone, role and status. **Clear filters** resets them.",
            "Group by zone (default), start time or role. Click a group heading to fold it; each heading shows vacant, on post and change pending counts.",
            "Clicking the staffing boxes at the top jumps to the matching tab.",
          ] }],
        },
        {
          id: "reading-row",
          title: "Reading a row",
          blocks: [{ t: "list", items: [
            "The guard's name appears under the status when someone is on post.",
            "**(temp)** means a temporary redeployment; a small dot means the shift was changed by a variation; **Change pending** means a variation is waiting.",
            "A yellow **Sign on →** button on vacant (or soon-starting empty) positions opens the Sign-in desk with that position ready.",
          ] }],
        },
        {
          id: "shift-details",
          title: "Shift details and downloads",
          blocks: [
            { t: "p", text: "Click a row to open its details. From there you can **Sign a guard on to this position** or **Request variation**, see who is on post and their automatic sign-off time, compare Current approved with the Original roster, open any variations for the shift and see its **Change history**." },
            { t: "p", text: "**Download CSV** saves your filtered positions. **Versions & downloads** lets you download the original roster (v1) and the current approved roster, and lists every roster version." },
            { t: "note", tone: "info", text: "Shift times and deployment can't be edited directly. If something is wrong, raise a variation (section 8)." },
          ],
        },
      ],
    },
    {
      id: "sign-in-desk",
      title: "6. Sign-in desk",
      intro: "Your main job on the day: link each arriving guard to a position in three steps.",
      link: { to: "/admin/sign-in", label: "Open Sign-in desk" },
      topics: [
        {
          id: "desk-sign-on",
          title: "Signing a guard on",
          blocks: [
            {
              t: "steps",
              items: [
                "**Scan or look up the guard.** Hold the guard's pass under the desk scanner (see Using a desk QR scanner), or click the big yellow **Scan guard QR** button and point the laptop camera at it. Or type their name, employee ID or licence under **Or search name, employee ID or licence** and click them. Their details appear in a card — click **Change** if it's the wrong person.",
                "**Allocate to a position.** Choose an open position from the list on the right. Search by position, role or Shift ID, or use **All zones** at the top to show one zone. Positions already running show **· started** in red — fill those first.",
                "**Sign the guard on.** Check the button reads correctly — e.g. Sign Alex Martin on to Gate 9 Access Control — and click it.",
              ],
            },
            { t: "p", text: "The guard moves to **On post now**, the position shows them as on post across the app, their phone shows the shift on **My shift**, and their automatic sign-off time is set to the shift's finish." },
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
                ["**All zones**", "Show positions in one zone or location only."],
                ["**Contractor**", "Set to your company automatically. If you work for more than one provider, choose one or All my contractors."],
                ["**Starting within 2h**", "How far ahead positions are listed: 1, 2, 4, 8 or 24 hours. Positions already running are always listed."],
              ],
            },
          ],
        },
        {
          id: "on-post",
          title: "On post now",
          blocks: [
            { t: "p", text: "Lists every guard currently signed on with their Position, Zone, Signed on time and Auto sign-off time. Click a position to open it on the Roster. There are no sign-off buttons: guards are signed off automatically when their shift ends, and if an approved variation extends the shift, their sign-off time moves too." },
          ],
        },
        {
          id: "desk-rules",
          title: "Rules the desk enforces",
          blocks: [
            { t: "list", items: [
              "Only your company's guards and positions are shown.",
              "A guard can't be signed on twice, and a position can only hold one guard.",
              "Scanning a pass for another company's guard is rejected.",
              "A guard marked **Signed on · needs a position** (from before phone sign-on was removed) can still be picked and placed on a position.",
            ] },
            { t: "note", tone: "info", text: "Guards can't sign themselves on from their phone — every sign-on happens at your desk. Their phone shows their guard pass on the Sign-on tab, ready to scan." },
          ],
        },
        deskScanner,
        {
          id: "desk-messages",
          title: "Messages you might see",
          blocks: [
            deskMessages,
            { t: "p", text: "**Your account isn't linked to a contractor yet.** — ask the event's Super Admin to link your login to your company." },
          ],
        },
      ],
    },
    {
      id: "guards",
      title: "7. Guards",
      intro: "Your guard directory, registering guards, SMS groups and the sign-up poster. Guards get into the app two ways only: registered by you (Register guard) or registering themselves on their phone. There's no bulk upload.",
      link: { to: "/admin/guards", label: "Open Guards" },
      topics: [
        {
          id: "directory",
          title: "7.1 Directory",
          blocks: [{ t: "p", text: "Your guards with Name, Employee ID, Phone (tap to call), Licence and whether they're Signed on. Search by name, employee ID, phone or licence." }],
        },
        {
          id: "register-guard",
          title: "7.2 Register guard",
          blocks: [
            { t: "steps", items: [
              "Fill in **Full name**, **Employee ID** and **Mobile** (required), plus Email, Security licence and Emergency contact.",
              "Under **Contractor**, always choose your company.",
              "Click **Add guard**. The guard can now be found at your Sign-in desk.",
            ] },
            { t: "note", tone: "info", text: "Guards who register themselves pick their security provider during sign-up. Once they choose your company they appear in your Directory and at your Sign-in desk straight away. To have your company filled in for them, make your own poster with your company chosen as the Security provider (section 7.4)." },
          ],
        },
        {
          id: "sms-groups",
          title: "7.3 SMS groups",
          blocks: [{ t: "steps", items: [
            "Open **SMS groups** and enter a group **Name** (e.g. Gate 1 team).",
            "Search for guards, or tick **Signed on now** to show only guards on post.",
            "Tick each guard or use **Select all shown**. Guards marked **No mobile** can't be added.",
            "Click **Create group**. Use View, Edit or Delete on saved groups.",
          ] }],
        },
        {
          id: "poster",
          title: "7.4 Sign-up QR poster",
          blocks: [{ t: "p", text: "Make a printable poster that guards scan to register and get their guard pass. Your company is already chosen as the **Security provider**, so guards who scan it are registered to you automatically. Add your **Logo**, change the **Headline**, **Subtitle**, **Event / venue name** and **Footer note**, pick a **Brand colour** and a Light (print) or Dark (screens) background. Then **Print / save as PDF**, **Download QR code (PNG)** or **Copy registration link**." }],
        },
      ],
    },
    {
      id: "variations",
      title: "8. Variations",
      intro: "Acknowledging changes the event asks for, and requesting changes yourself.",
      link: { to: "/admin/variations", label: "Open Variations" },
      topics: [
        {
          id: "variation-flow",
          title: "8.1 How a variation moves through",
          blocks: [
            { t: "p", text: "Request → you acknowledge (confirming your company has received the change — this is not approval) → the event approves (Senior Management or Super Admin) → the roster updates automatically. The event can approve without waiting for your acknowledgement if it's urgent." },
            variationStatuses,
          ],
        },
        {
          id: "acknowledging",
          title: "8.2 Acknowledging a request",
          blocks: [
            { t: "note", tone: "new", text: "Updated: you're now alerted by text and email." },
            { t: "p", text: "When a new request comes in for your company, every Security Manager at your company gets a **text** and an **email** saying “Variation VAR-… needs your acknowledgement”, with the number of shifts, the type of change, who requested it and a link straight to it. You won't be alerted about a request you made yourself." },
            { t: "steps", items: [
              "Tap the link in the text or **Review and acknowledge** in the email — or open Variations → Variation register, or click Awaiting acknowledgement on the Dashboard.",
              "Open the request. Check the shift, reason, and the Original vs Proposed details. For multi-shift requests every shift is listed.",
              "Add **Comments** (optional).",
              "Click **Acknowledge as contractor** if your company can cover it. Click **Return for clarification** if you need more information, or **Decline** if it can't go ahead.",
            ] },
            { t: "p", text: "Once acknowledged, the request moves to **Awaiting approval** and the event's approvers are alerted automatically. When it's approved, the roster, your guards' shift times and their automatic sign-off times update by themselves — and any guard on post is told on their phone." },
            { t: "note", tone: "info", text: "Texts go to the mobile number saved against your login in Settings. Texts go out once the event's SMS is set up by the event control room; emails start once the event's email domain is verified." },
          ],
        },
        {
          id: "requesting",
          title: "8.3 Requesting a variation",
          blocks: [
            { t: "p", text: "Start from **Variations → New request**, or open a shift on the Roster and click **Request variation** (the shift is ticked for you)." },
            { t: "steps", items: [
              "Choose the kind of change: **Extend / reduce shift**, **Change scope / redeploy** or **Add guards / shifts**.",
              "Tick the shifts (search by Shift ID, position, zone or time; finished shifts can be included). For time changes, enter a **New start** and **New finish** for each shift — every ticked shift must change. For redeployments, enter the new role, position and zone (or pick a vacant position to move a guard to) and whether it's for the remainder of the shift or temporary. For extra guards, enter how many, role, position, zone, start and finish.",
              "Enter a **Reason for change** (required) and any notes, then click **Review**.",
              "Check the original and proposed details and click **Submit variation**.",
            ] },
            { t: "p", text: "The request appears in the register as **Awaiting contractor acknowledgement**." },
          ],
        },
        {
          id: "register",
          title: "8.4 The register and export",
          blocks: [
            { t: "p", text: "Filter by status (**All pending** shows everything waiting), type and contractor. Columns show the ID (with 3 shifts for multi-shift requests), type, who requested it, reason, acknowledgement and approval progress (e.g. 2 of 3) and status." },
            { t: "p", text: "**Export all** downloads every variation for your company as a spreadsheet (CSV): one row per shift, with original and new details, reason, who requested, acknowledged and decided it, and when. Costs are never included for security providers." },
            { t: "note", tone: "tip", text: "A returned request can't be edited. If the change needs to be different, ask for the old request to be declined and submit a new one." },
          ],
        },
      ],
    },
    {
      id: "communications",
      title: "9. Communications",
      intro: "Writing messages to your guards and keeping a record.",
      link: { to: "/admin/communications", label: "Open Communications" },
      topics: [
        {
          id: "send-message",
          title: "Sending a message",
          blocks: [
            { t: "note", tone: "new", text: "New: texts are sent for real through the event's own Tall Bob account. You never choose an account — the event decides. If the banner is red, the event's SMS isn't ready yet; ask the event control room." },
            { t: "steps", items: [
              "Under **Send to**, choose: Individual / selected guards, A guard group, All guards at this event, Everyone on a shift time, Everyone signed on in a zone, All guards of a security contractor, Everyone currently signed on, or Guards affected by an approved variation. You only ever see and text your own company's guards.",
              "Pick a template (**Shift extension**, **Shift reduction**, **Change of position**, **Change of location**, **Redeployment**, **Additional shift**, **Shift cancellation**, **General roster update**) or write your own. With a variation chosen, details are filled in from it — check and edit anything in [brackets].",
              "Check the recipient count (guards without a valid mobile are skipped; each number is texted once), then click **Send SMS to … guards**. Clicking twice won't send it twice.",
            ] },
            { t: "note", tone: "tip", text: "{name} becomes each guard's first name." },
          ],
        },
        {
          id: "history",
          title: "SMS history",
          blocks: [
            { t: "p", text: "Lists recent messages with date, event, Tall Bob account and sender ID, sender, audience, recipients, message and status. Click one to see each recipient's delivery status (Pending, Submitted, Queued, Sent, Delivered or Failed) and any error. Texts the app sends by itself show **Automatic alert** as the sender — for example the shift-change texts your guards get when an approved variation changes their time or location, and acknowledgement alerts sent to your Security Managers." },
          ],
        },
      ],
    },
    {
      id: "team",
      title: "10. Adding your team (Settings)",
      intro: "Create logins for your own supervisors and sign-in desk staff. Your Users page shows your company's logins only.",
      link: { to: "/admin/settings", label: "Open Settings" },
      topics: [
        {
          id: "add-user",
          title: "Adding a user",
          blocks: [
            { t: "note", tone: "new", text: "Updated: email invitations and mobile numbers." },
            { t: "steps", items: [
              "Open **Settings** and click **Add user**.",
              "Enter the person's **Full name** and **Email**.",
              "Enter their **Mobile (optional)** — Security Managers need one to be texted about variations.",
              "Choose **Email invitation** (default — they're emailed a link to create their own password) or **Temporary password** (you set one, at least 8 characters).",
              "Choose the **User type**: Security Manager, Security Zone Manager or Security Sign In.",
              "Choose your company under **Security provider**.",
              "Click **Send invitation** (or **Add user** for a temporary password). With a temporary password, click **Copy login details** and send them to the person yourself.",
            ] },
            { t: "note", tone: "info", text: "You can only add these three user types, and only for your own company. What each type can see and do is set by the event's Super Admin." },
          ],
        },
        {
          id: "remove-user",
          title: "Removing someone from your team",
          blocks: [
            { t: "p", text: "When someone leaves, click **Remove** next to them in the Users table and confirm. Their login is deleted straight away, so they can no longer sign in or receive alerts. Their name stays on past sign-ons and variations. You can only remove people from your own company, and not yourself. It can't be undone — add them again as a new user if needed." },
          ],
        },
        {
          id: "mobiles",
          title: "Mobile numbers",
          blocks: [
            { t: "p", text: "The Users table has a **Mobile** column. Click **Edit** (or **Add** where it says No mobile), type the number and click **Save**. You can update your own number and your team's." },
          ],
        },
      ],
    },
    {
      id: "guard-portal",
      title: "11. What guards see (Guard portal)",
      intro: "Guards use the Guard portal on their own phone. It's useful to know what they see so you can help them.",
      topics: [guardRegistering, guardTabs, guardShiftChanged, { id: "guard-desk-only", title: "Signing on", blocks: [guardDeskOnly] }],
    },
    {
      id: "event-day",
      title: "12. Event day routine",
      intro: "A suggested running order for your team.",
      topics: [
        { id: "before-first", title: "Before your first shift starts", blocks: [{ t: "list", items: [
          "Sign in on the desk device, choose the event and open the Sign-in desk. Test the desk scanner (or camera) with one guard pass.",
          "Check **Starting in 1h** on the Roster so you know which posts open first.",
          "Clear any variations awaiting your acknowledgement.",
        ] }] },
        { id: "as-arrive", title: "As guards arrive", blocks: [{ t: "list", items: [
          "Scan the pass → pick the position → sign on. Fill positions marked started first.",
          "Keep an eye on **Missing guards** and **Vacant positions** on the Dashboard.",
        ] }] },
        { id: "during", title: "During the event", blocks: [{ t: "list", items: [
          "Acknowledge variations promptly when you get the alert — the event can't plan around them until you do.",
          "If you need to move or extend guards, raise a variation from the shift on the Roster.",
          "After an approved change, guards on post are told on their phone automatically. Message them from Communications if they need more detail.",
        ] }] },
        { id: "end", title: "At the end", blocks: [{ t: "list", items: ["Nothing to do — guards are signed off automatically at their approved finish time."] }] },
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
                ["I never got my invitation email", "Check spam/junk. If it's still missing, ask the event's Super Admin or your company's Security Manager to add you with a temporary password."],
                ["I'm not getting variation alerts", "Check your mobile number in Settings. Texts need the event's SMS to be set up by the event control room. You're not alerted about requests you made yourself."],
                ["“Your account has no access role yet”", "Ask the event's Super Admin to set your user type, then refresh."],
                ["“You don't have access to this page”", "Your user type doesn't include that page. Ask the event's Super Admin."],
                ["A guard isn't found at the desk", "They may be signed on already, or registered with another company. If they picked the wrong provider at sign-up, ask the event control room to correct it, or register them with Register guard."],
                ["A position isn't listed at the desk", "It may already be filled, have finished, fall outside the Starting within window or be hidden by the zone filter."],
                ["I can't approve a variation", "Security providers acknowledge; the event approves. Once you've acknowledged, it's with them — they're alerted automatically."],
                ["A shift time is wrong", "Raise an Extend / reduce variation — times can't be edited directly."],
                ["How do I sign a guard off?", "You don't. Guards are signed off automatically at their approved finish time."],
                ["Texts can't be sent (red banner)", "The event's Tall Bob SMS isn't set up or tested yet. Ask the event control room."],
                ["A text shows Failed", "Click it in SMS history to see why — often a guard's mobile number is wrong."],
              ],
            },
          ],
        },
      ],
    },
    liveMapSection,
  ],
};
