import type { GuideBlock, GuideSection, GuideTopic } from "./types";

/** Content that reads the same in both guides. */

export const GUIDE_UPDATED = "October 2026";

export const shiftStatuses: GuideTopic = {
  id: "shift-statuses",
  title: "Shift statuses",
  blocks: [
    { t: "p", text: "Every position shows one of four statuses on the Dashboard and Roster:" },
    {
      t: "table",
      head: ["Status", "What it means"],
      rows: [
        ["**Upcoming**", "The shift hasn't started yet."],
        ["**Filled**", "The shift is running and a guard is signed on to it."],
        ["**Missing**", "The shift is running but nobody is signed on. These are your gaps to fill."],
        ["**Completed**", "The shift's finish time has passed."],
      ],
    },
  ],
};

export const variationStatuses: GuideBlock = {
  t: "table",
  head: ["Status label", "What it means", "What happens next"],
  rows: [
    ["**Awaiting contractor acknowledgement**", "A new request. Every new request starts here.", "The security provider's Security Manager acknowledges it — or an approver approves it directly."],
    ["**Awaiting approval**", "The security provider has acknowledged the change.", "Senior Management or a Super Admin approves or declines it."],
    ["**Approved**", "The change has been applied to the current approved roster.", "Nothing — the roster, costs and automatic sign-off times have already updated."],
    ["**Declined**", "The request was rejected.", "Nothing changes on the roster."],
    ["**Returned for clarification**", "Someone has asked for more information. The request is still open.", "It can still be acknowledged, approved or declined. It can't be edited — decline it and raise a new one if the change itself must be different."],
  ],
};

export const guardRegistering: GuideTopic = {
  id: "guard-registering",
  title: "Registering",
  blocks: [
    { t: "p", text: "A guard scans the sign-up QR code (on the poster or the Register guard page). They tap **Create guard profile**, choose their **Security provider** (already filled in if the poster was made for one provider), then fill in **Full name, Phone, Email, Employee ID, Licence number, Emergency contact** and a **Password** (at least 6 characters), and tap **Save profile**." },
    { t: "p", text: "Choosing a provider is required, so every self-registered guard appears straight away in that provider's Directory and at their Sign-in desk. A guard registered before this was required can pick their provider later under **Profile**." },
    { t: "p", text: "**Deleting an account:** a guard can delete their own account under **Profile → Delete my account** by typing DELETE to confirm. It isn't available while they're signed on. Their login, contact and licence details, photo and location data are deleted; their name and employee ID stay on past sign-ons, and the guard shows as **Suspended** in the Directory. To work again they register as a new guard." },
  ],
};

export const guardTabs: GuideTopic = {
  id: "guard-tabs",
  title: "The five tabs",
  blocks: [
    {
      t: "table",
      head: ["Tab", "What the guard sees"],
      rows: [
        ["**My shift**", "Before sign-on: “You're not on a position yet” and a button to show their guard pass. Once the desk signs them on: the position, event, time, role, location, contractor and any instructions or notes. If they are on a temporary redeployment, it shows the temporary position and when it ends."],
        ["**Sign-on**", "Before sign-on: their guard pass QR code with “Show this at the sign-in desk to be signed on”. After: since when, which position and their **Automatic sign-off** time. There is no sign-on or sign-off button."],
        ["**Changes**", "Changes made to their shift by approved variations, newest first."],
        ["**Messages**", "Messages saved for them in Communications, including automatic shift-change texts."],
        ["**Profile**", "Their personal guard pass QR code, their Security provider, plus phone, email, licence and emergency contact they can update."],
      ],
    },
  ],
};

export const guardShiftChanged: GuideTopic = {
  id: "guard-shift-changed",
  title: "When their shift changes",
  blocks: [
    { t: "note", tone: "new", text: "New in this update." },
    { t: "p", text: "When a variation is approved that changes the **time** or **location** of a shift a guard is currently signed on to:" },
    {
      t: "list",
      items: [
        "Their phone updates straight away — no refresh needed. A yellow **Your shift has changed** banner appears at the top with a short summary, and the phone vibrates. Tapping **Got it** takes them to My shift with the new details.",
        "An automatic text is queued to them with the new time and automatic sign-off, or where to report for a redeployment (temporary moves say when they return). It also appears in their **Messages** tab.",
        "The text goes out through the event's Tall Bob account once the event's SMS is set up; the banner and Messages tab work regardless.",
      ],
    },
  ],
};

export const guardDeskOnly: GuideBlock = {
  t: "note",
  tone: "important",
  text: "Guards can't sign themselves on from their phone. Every sign-on happens at the Sign-in desk, where the guard shows their pass and is put straight onto a position — so headcounts, vacancies and automatic sign-off are always tied to a real roster position.",
};

export const deskScanner: GuideTopic = {
  id: "desk-scanner",
  title: "Using a desk QR scanner",
  blocks: [
    { t: "note", tone: "new", text: "New: plug-in desk scanners (for example the Netum A5 desktop scanner) now work with the Sign-in desk." },
    { t: "p", text: "A USB or Bluetooth desk scanner is faster than the laptop camera. Guards just hold their phone under it and they're picked in step 1 straight away. You don't need to click anything first, even if your cursor is in a search box." },
    {
      t: "steps",
      items: [
        "**Plug the scanner in** to the laptop (straight into the laptop, not an unpowered hub). No software is needed — the laptop treats it like a keyboard.",
        "**Check it types.** Open Notes (or Notepad) and scan any QR code. The text should appear and jump to a new line. If it doesn't, see the table below.",
        "**Open the Sign-in desk** and leave it open. A green line under the yellow button reads **Desk scanner ready — hold the guard's pass under it**.",
        "**Scan the guard's pass.** The guard appears in step 1. Then pick the position and sign them on as usual.",
      ],
    },
    { t: "p", text: "The yellow **Scan guard QR** button still opens the laptop camera if the scanner isn't available." },
    {
      t: "table",
      head: ["For quick scans", "Why"],
      rows: [
        ["Hold the phone **8–15 cm** from the scanner window", "Too close or too far and the code is blurry or too small."],
        ["**Tilt the phone slightly** (about 15°)", "Stops the scanner's light glaring off the screen."],
        ["**Move the phone in** towards the scanner", "Desktop scanners wake up when they see movement."],
        ["Phone **brightness up**, pass open full screen", "A dim screen is hard to read."],
        ["Wait **2 seconds** before scanning the same pass again", "Scanners ignore the same code scanned twice in a row."],
      ],
    },
    {
      t: "table",
      head: ["Problem", "What to do"],
      rows: [
        ["Scanner beeps but nothing types (even in Notes)", "In the scanner's setup booklet, scan **USB HID / USB Keyboard** mode and turn off any storage or inventory mode. If it's still stuck, scan **Restore default settings**."],
        ["Text types but stays on one line", "Scan the **Enter / CR** end character barcode in the booklet. The desk needs an Enter after each scan."],
        ["No beep, no light", "Unplug and replug it, try another USB port, or charge it if it's wireless."],
        ["Types in Notes but the desk doesn't pick the guard", "Make sure the Sign-in desk page is open and in front. Codes that aren't guard passes are ignored."],
      ],
    },
  ],
};

export const deskMessages: GuideBlock = {
  t: "table",
  head: ["Message", "What to do"],
  rows: [
    ["That QR code isn't a guard pass for this system.", "The code scanned isn't a guard pass. Search for the guard by name instead."],
    ["… belongs to …, not this contractor.", "The guard works for a different provider. Change the contractor drop-down (event staff) or send them to the right desk."],
    ["… is already signed on.", "They're already on post. Check **On post now**."],
    ["Camera unavailable…", "Allow camera access in the browser, or search by name."],
    ["No available guards match.", "The guard isn't registered to this provider, is already signed on, or the spelling differs. Register them if needed."],
    ["No open positions in this window.", "Increase the **Starting within** window or clear the zone filter."],
    ["You can view this desk but not sign guards on", "Your user type doesn't have **Sign guards on to positions** ticked."],
  ],
};

export const signingIn: GuideTopic = {
  id: "signing-in",
  title: "Signing in and setting your password",
  blocks: [
    { t: "note", tone: "new", text: "Updated: new users can now be invited by email." },
    { t: "p", text: "There are two ways you'll get your login:" },
    {
      t: "list",
      items: [
        "**Email invitation (usual)** — you receive an email from Out There Group with a **Set your password** button. It opens the **Create your password** page: choose a password, confirm it, and you're signed in. From then on sign in with your email and that password.",
        "**Temporary password** — the person who set you up gives you an email and temporary password directly. Sign in with those.",
      ],
    },
    { t: "p", text: "Emails come from **notify.security.outthereadmin.com.au**. If you can't find the invitation, check your spam or junk folder — new sending domains can land there for the first few weeks." },
    { t: "p", text: "If you see “Your account has no access role yet”, a Super Admin needs to give you a user type in **Settings → Users & roles**; then refresh the page." },
  ],
};

export const userGuidesTopic: GuideTopic = {
  id: "user-guides",
  title: "These user guides",
  blocks: [
    { t: "note", tone: "new", text: "New in this update." },
    { t: "p", text: "Open **User guides** from the left menu or from the account menu (your initials, top right). Type in the search box to find any topic — results update as you type and matching words are highlighted. Use the contents list to jump between sections, and **Print / save as PDF** to keep a copy." },
  ],
};

/** Live Map and guard location sharing (same rules for every user type). */
export const liveMapSection: GuideSection = {
  id: "live-map",
  title: "Live Map (guard locations)",
  intro: "Shows where signed-on guards' phones are, for guards who choose to share their location. Location is separate from sign-on: a guard without a location is still signed on and still counted. It never marks anyone missing, changes a shift, signs anyone off or affects pay.",
  link: { to: "/admin#live-map", label: "Open Live Map on the Dashboard" },
  topics: [
    { id: "map-read", title: "Reading the map", blocks: [
      { t: "table", head: ["Marker", "Meaning"], rows: [
        ["**● Fresh** (green)", "Captured within the last 90 seconds."],
        ["**◐ Delayed** (amber)", "Captured 90 seconds to 5 minutes ago."],
        ["**○ Stale** (faded grey)", "Older than 5 minutes. Tick **Hide stale** to remove them."],
        ["**Red ring**", "Low accuracy (worse than 100 m)."],
        ["**Numbered circle**", "Several guards close together — click to zoom in."],
      ] },
      { t: "p", text: "Click a marker or a name in the list to see the guard, provider, assigned post and zone, shift end, when the location was captured, its age and accuracy (shown as a circle). Dots are the phone's measured location — never the assigned post." },
      { t: "p", text: "The list on the right shows **everyone signed on**, including guards marked **Location unavailable**. Filter by contractor, zone, role or freshness, or search." },
      { t: "note", tone: "important", text: "If the red **Live updates are unavailable** bar shows, what's on the map may be out of date. No update from a phone only means its location is unavailable — not why." },
    ] },
    { id: "map-guard", title: "What guards do", blocks: [
      { t: "steps", items: [
        "After the desk signs them on to a position, the guard opens **My shift** on their own phone.",
        "They tap **Start sharing location**, read the notice (why, who sees it, when it stops, what's kept) and agree.",
        "Their phone asks for location permission. While sharing, they can **Update my location**, **Stop sharing** or **Withdraw my consent**.",
      ] },
      { t: "list", items: [
        "Sharing stops automatically at sign-off, at the approved shift end (approved extensions/reductions move this; pending ones don't), on log out, or if it's started on another phone.",
        "Browser sharing only works while the screen is open — it pauses when the phone locks or they switch apps, and markers then go Delayed/Stale.",
        "Only the latest location is kept, and it's deleted as soon as sharing stops. Signing a guard on at the desk never records the desk computer's location.",
      ] },
    ] },
    { id: "map-access", title: "Who can see it", blocks: [
      { t: "p", text: "Needs **Live Map (guard locations)** ticked for the user type (on by default for Senior Management, Event Manager, Event Control Assistant, Security Manager and Security Zone Manager). Security provider users only see their own company's guards." },
    ] },
  ],
};
