import appIcon from "@/assets/app-icon-sm.png";
import { Children, isValidElement, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { z } from "zod";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { OpsProvider, useOps } from "@/features/ops/OpsContext";
import { DashboardPage as OpsDashboard } from "@/features/ops/Dashboard";
import { RosterPage as OpsRoster } from "@/features/ops/Roster";
import { VariationsPage as OpsVariations } from "@/features/ops/Variations";
import { GuardsPage as OpsGuards } from "@/features/ops/Guards";
import { CommunicationsPage as OpsComms } from "@/features/ops/Communications";
import { SettingsPage as OpsSettings } from "@/features/ops/Settings";
import { GuardPortal, useSignupProviders } from "@/features/ops/GuardPortal";
import { SignInPage as OpsSignIn } from "@/features/ops/SignIn";
import { GuidesPage as OpsGuides } from "@/features/ops/Guides";
import { stopSharingOnLogout } from "@/features/ops/GuardLocation";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Bell,
  CalendarClock,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Contact,
  Download,
  FileText,
  FileSignature,
  Filter,
  Fingerprint,
  Gauge,
  History,
  IdCard,
  Lock,
  LogOut,
  MapPin,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  MessageSquare,
  Navigation,
  Phone,
  QrCode,
  Radio,
  Route,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  Smartphone,
  Upload,
  UploadCloud,
  UserCog,
  UserCheck,
  Users,
  X,
} from "lucide-react";

const navItems = [
  { path: "/admin", label: "Dashboard", icon: Gauge, perm: "view_dashboard" },
  { path: "/admin/roster", label: "Roster", icon: ClipboardCheck, perm: "view_roster" },
  { path: "/admin/sign-in", label: "Sign-in desk", icon: UserCheck, perm: "view_sign_in" },
  { path: "/admin/variations", label: "Variations", icon: FileSignature, perm: "view_variations" },
  { path: "/admin/guards", label: "Guards", icon: Users, perm: "view_guards" },
  { path: "/admin/communications", label: "Communications", icon: MessageSquare, perm: "view_communications" },
  { path: "/admin/settings", label: "Settings", icon: Settings, perm: "view_settings", alt: "add_provider_users" },
  { path: "/admin/guides", label: "User guides", icon: BookOpen, perm: null },
] as const;

/** A page is open if its permission is ticked; Settings also opens (Users only) for people who may add provider users. */
const canOpen = (can: (p: any) => boolean, n: (typeof navItems)[number]) => n.perm === null || can(n.perm) || ("alt" in n && can(n.alt));

const guardSteps = [
  { path: "/mobile/onboarding", label: "QR", icon: QrCode },
  { path: "/mobile/profile", label: "Profile", icon: IdCard },
  { path: "/mobile/login", label: "Login", icon: Lock },
  { path: "/mobile/start-shift", label: "Start", icon: Smartphone },
  { path: "/mobile/briefing", label: "Briefing", icon: ClipboardCheck },
  { path: "/mobile/active-shift", label: "Active", icon: Radio },
  { path: "/mobile/incident", label: "Incident", icon: AlertTriangle },
  { path: "/mobile/end-shift", label: "End", icon: LogOut },
];

const guards = [
  {
    id: "g-101",
    name: "Maya Collins",
    phone: "+44 7700 900128",
    email: "maya.collins@outtheregroup.test",
    employeeId: "SG-1048",
    licence: "SIA-7842-9921",
    role: "Main Gate Officer",
    site: "Harbour Logistics Park",
    zone: "Gate A / Yard 2",
    status: "in_zone",
    shift: "18:00–06:00",
    lastUpdate: "18 sec ago",
    coords: "51.5078, -0.0844",
    lat: 51.5078,
    lng: -0.0844,
    accuracy: 8,
    incidents: 1,
    photo: "MC",
  },
  {
    id: "g-102",
    name: "Noah Bennett",
    phone: "+44 7700 900413",
    email: "noah.bennett@outtheregroup.test",
    employeeId: "SG-1082",
    licence: "SIA-2910-4428",
    role: "Perimeter Patrol",
    site: "Northbank Arena",
    zone: "North Stand",
    status: "moving",
    shift: "17:30–01:30",
    lastUpdate: "41 sec ago",
    coords: "51.5091, -0.0871",
    lat: 51.5091,
    lng: -0.0871,
    accuracy: 12,
    incidents: 0,
    photo: "NB",
  },
  {
    id: "g-103",
    name: "Aisha Khan",
    phone: "+44 7700 900611",
    email: "aisha.khan@outtheregroup.test",
    employeeId: "SG-1164",
    licence: "SIA-5581-0137",
    role: "VIP Entrance",
    site: "Northbank Arena",
    zone: "VIP Lobby",
    status: "alert",
    shift: "16:00–00:00",
    lastUpdate: "2 min ago",
    coords: "51.5102, -0.0904",
    lat: 51.5102,
    lng: -0.0904,
    accuracy: 19,
    incidents: 2,
    photo: "AK",
  },
  {
    id: "g-104",
    name: "Leo Morgan",
    phone: "+44 7700 900903",
    email: "leo.morgan@outtheregroup.test",
    employeeId: "SG-1205",
    licence: "SIA-9011-7410",
    role: "Relief Officer",
    site: "City Data Centre",
    zone: "Reception",
    status: "offline",
    shift: "06:00–14:00",
    lastUpdate: "Logged off",
    coords: "51.5051, -0.0818",
    lat: 51.5051,
    lng: -0.0818,
    accuracy: 0,
    incidents: 0,
    photo: "LM",
  },
];

const initialGuardPosts = [
  { id: "post-gate-a", label: "Gate A post", guardId: "g-101", lat: 51.50782, lng: -0.08438, radiusMeters: 45 },
  { id: "post-north-stand", label: "North Stand patrol point", guardId: "g-102", lat: 51.50942, lng: -0.08745, radiusMeters: 55 },
  { id: "post-vip-lobby", label: "VIP Lobby post", guardId: "g-103", lat: 51.50965, lng: -0.08985, radiusMeters: 40 },
  { id: "post-reception", label: "Reception relief post", guardId: "g-104", lat: 51.5051, lng: -0.0818, radiusMeters: 35 },
  { id: "post-yard-3", label: "Yard 3 patrol post", guardId: "", lat: 51.5066, lng: -0.0861, radiusMeters: 45 },
  { id: "post-service-road", label: "Service road post", guardId: "", lat: 51.5087, lng: -0.0912, radiusMeters: 45 },
];

const sites = [
  {
    name: "Harbour Logistics Park",
    address: "18 Dockside Way, London",
    supervisor: "Carla Reed",
    phone: "+44 20 7946 0941",
    reference: "HL-ALPHA",
    fence: "5-point perimeter, 420m radius",
    active: 14,
  },
  {
    name: "Northbank Arena",
    address: "1 Riverside Approach, London",
    supervisor: "Darren Holt",
    phone: "+44 20 7946 0825",
    reference: "NBA-EVENT-12",
    fence: "Event bowl + service road",
    active: 26,
  },
  {
    name: "City Data Centre",
    address: "77 Charterhouse Street, London",
    supervisor: "Priya Shah",
    phone: "+44 20 7946 0708",
    reference: "CDC-SECURE",
    fence: "Building footprint + loading bay",
    active: 6,
  },
];

const incidents = [
  {
    id: "INC-24019",
    guard: "Maya Collins",
    site: "Harbour Logistics Park",
    type: "Unauthorised access attempt",
    severity: "high",
    status: "submitted",
    time: "19:12",
    description: "Vehicle attempted entry without valid consignment record.",
  },
  {
    id: "INC-24020",
    guard: "Aisha Khan",
    site: "Northbank Arena",
    type: "Medical assistance",
    severity: "critical",
    status: "reviewed",
    time: "19:34",
    description: "Guest collapsed near VIP lobby; first aid team called.",
  },
  {
    id: "INC-24021",
    guard: "Noah Bennett",
    site: "Northbank Arena",
    type: "Lost property",
    severity: "low",
    status: "draft",
    time: "20:05",
    description: "Bag found in North Stand concourse and secured.",
  },
];

const alerts = [
  { type: "Geo-fence breach", guard: "Aisha Khan", message: "Outside VIP Lobby zone for 2 minutes", severity: "critical", time: "Now" },
  { type: "High severity incident", guard: "Aisha Khan", message: "Critical medical incident submitted", severity: "critical", time: "4 min" },
  { type: "Late login", guard: "Relief pool", message: "Gate B post not staffed by scheduled time", severity: "warning", time: "11 min" },
  { type: "Location sharing", guard: "Noah Bennett", message: "Accuracy degraded below operational threshold", severity: "warning", time: "18 min" },
];

const shiftExtensions = [
  { id: "EXT-118", guard: "Maya Collins", site: "Harbour Logistics Park", shift: "18:00–06:00", requestedUntil: "07:30", reason: "Late vehicle search and handover required at Gate A", estimatedCost: 48, status: "requested", approver: "Pending system admin" },
  { id: "EXT-117", guard: "Noah Bennett", site: "Northbank Arena", shift: "17:30–01:30", requestedUntil: "02:30", reason: "Post-event crowd dispersal support", estimatedCost: 32, status: "approved", approver: "Ops Manager · Helen Price" },
];

type SecurityRosterRow = {
  id: string;
  guardId: string;
  guardName: string;
  site: string;
  location: string;
  role: string;
  start: string;
  finish: string;
  hours: number;
  cost: number;
  status: "approved" | "pending_signoff" | "rejected";
  signoff: string;
};

type RosterVariation = {
  id: string;
  rosterId: string;
  guardName: string;
  detail: string;
  costDelta: number;
  status: "pending_signoff" | "approved" | "rejected";
  signoff: string;
};

const defaultRosterRows: SecurityRosterRow[] = guards.map((guard, index) => {
  const hours = index === 0 ? 12 : 8;
  const rate = index === 0 ? 32 : index === 2 ? 36 : 30;
  return {
    id: `ROS-${101 + index}`,
    guardId: guard.id,
    guardName: guard.name,
    site: guard.site,
    location: guard.zone,
    role: guard.role,
    start: guard.shift.split("–")[0],
    finish: guard.shift.split("–")[1] ?? "—",
    hours,
    cost: hours * rate,
    status: "approved",
    signoff: "Original roster",
  };
});

const defaultRosterVariations: RosterVariation[] = [
  { id: "RV-204", rosterId: "ROS-101", guardName: "Maya Collins", detail: "Finish moved from 06:00 to 07:00 for late gate handover", costDelta: 32, status: "pending_signoff", signoff: "Awaiting senior leadership" },
  { id: "RV-203", rosterId: "ROS-103", guardName: "Aisha Khan", detail: "Location changed from VIP Lobby to Hospitality Entrance", costDelta: 0, status: "approved", signoff: "Rebecca Lane · Event Director" },
];

const scopeChanges = [
  {
    id: "SC-0241",
    title: "Additional screening lane",
    site: "Northbank Arena",
    requestedBy: "Darren Holt",
    requiredWindow: "20:30–23:30",
    scopeDetail: "Open an extra bag-search lane at VIP Lobby due to late-arriving hospitality guests and queue pressure.",
    operationalReason: "Ingress queue exceeded agreed threshold for 9 minutes and blocked emergency access corridor.",
    resources: "2 guards, 1 supervisor, 2 search tables, 4 radios",
    costItems: [
      ["Security guards", "2 x 3 hrs @ $32", 192],
      ["Supervisor", "1 x 3 hrs @ $45", 135],
      ["Equipment", "Tables, radios, lighting", 85],
    ],
    totalCost: 412,
    status: "pending_leadership_signoff",
    leader: "Awaiting sign-off",
    role: "Senior Leadership",
    signedAt: "—",
  },
  {
    id: "SC-0240",
    title: "Service road closure cover",
    site: "Harbour Logistics Park",
    requestedBy: "Carla Reed",
    requiredWindow: "19:00–01:00",
    scopeDetail: "Add fixed post at service road closure and extend perimeter patrol to Yard 3.",
    operationalReason: "Temporary vehicle diversion created a blind spot outside the approved deployment plan.",
    resources: "1 guard, cones, temporary signage",
    costItems: [
      ["Security guard", "1 x 6 hrs @ $32", 192],
      ["Equipment", "Cones and signage", 40],
    ],
    totalCost: 232,
    status: "approved",
    leader: "Rebecca Lane",
    role: "Event Director",
    signedAt: "19:08",
  },
];

const audit = [
  ["20:08:41", "Location update", "Maya Collins", "In approved zone"],
  ["20:07:12", "Geo-fence breach", "Aisha Khan", "Outside VIP Lobby"],
  ["20:05:28", "Incident draft", "Noah Bennett", "Lost property report opened"],
  ["19:34:02", "Incident reviewed", "CONTROL ROOM", "Medical assistance escalated"],
  ["18:01:14", "Shift start", "Maya Collins", "Briefing acknowledged"],
];

const statusMeta = {
  in_zone: { label: "In zone", className: "status-success", marker: "marker-success" },
  moving: { label: "Moving", className: "status-warning", marker: "marker-warning" },
  alert: { label: "Outside geo-fence", className: "status-danger", marker: "marker-danger" },
  offline: { label: "Offline", className: "status-offline", marker: "marker-offline" },
};

const metricCards = [
  { label: "Active guards", value: "46", delta: "+8 vs last hour", icon: Users, tone: "success" },
  { label: "Open alerts", value: "7", delta: "3 critical", icon: Bell, tone: "danger" },
  { label: "Incidents today", value: "13", delta: "2 awaiting review", icon: ShieldAlert, tone: "warning" },
  { label: "Sites covered", value: "12", delta: "98% attendance", icon: MapPin, tone: "info" },
];

const pathTitles: Record<string, string> = {
  "/": "CONTROL ROOM",
  "/admin": "Live staffing",
  "/admin/roster": "Roster",
  "/admin/sign-in": "Sign-in desk",
  "/admin/guides": "User guides",
  "/admin/variations": "Variations",
  "/admin/live-map": "Live Map",
  "/admin/communications": "Communications",
  "/mobile": "Guard portal",
  "/admin/map": "Live master site map",
  "/admin/guards": "Guards",
  "/admin/sites": "Site operations",
  "/admin/events": "Event details",
  "/admin/shifts": "Roster",
  "/admin/rosters": "Roster",
  "/admin/extensions": "Roster",
  "/admin/plans": "Site plans",
  "/admin/incidents": "Incident backend",
  "/admin/alerts": "Alert centre",
  "/admin/reports": "Reports",
  "/admin/scope": "Roster",
  "/admin/users": "Admin",
  "/admin/settings": "Settings",
  "/mobile/onboarding": "QR onboarding",
  "/mobile/profile": "Profile setup",
  "/mobile/login": "Guard login",
  "/mobile/start-shift": "Start shift",
  "/mobile/briefing": "Shift briefing",
  "/mobile/active-shift": "Active shift",
  "/mobile/incident": "Incident report",
  "/mobile/end-shift": "End shift",
};

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type GuardPosition = (typeof guards)[number] & { lat: number; lng: number; accuracy: number; updatedAt: number };
type GuardPost = (typeof initialGuardPosts)[number];

const LIVE_POSITION_KEY = "sentinel-live-guard-position";
const GUARD_CONTACT_KEY = "sentinel-guard-contact-requests";
const SECURITY_ROSTER_KEY = "sentinel-security-roster";
const ROSTER_VARIATION_KEY = "sentinel-roster-variations";
const ADMIN_SITES_KEY = "outthere-admin-sites";
const REPORT_TYPES_KEY = "outthere-report-types";
const ADMIN_USERS_KEY = "outthere-admin-users";
const ROLE_PERMISSIONS_KEY = "outthere-role-permissions";

const authSchema = z.object({
  email: z.string().trim().email("Enter a valid email address").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(72),
});

const guardProfileSchema = authSchema.extend({
  fullName: z.string().trim().min(2, "Enter your full name").max(100),
  phone: z.string().trim().min(6, "Enter a contact number").max(30),
  employeeId: z.string().trim().min(2, "Enter an employee ID").max(40),
  licenceNumber: z.string().trim().min(4, "Enter your licence number").max(80),
  emergencyContact: z.string().trim().min(3, "Enter an emergency contact").max(140),
  contractorId: z.string().uuid("Choose the security provider you work for"),
});

const defaultEventDetails = {
  eventName: "Northbank Arena Evening Fixture",
  venueName: "Northbank Arena",
  date: "28 Apr 2026",
  time: "16:00–00:00",
  client: "Northbank Events Ltd",
  supervisor: "Carla Reed · +44 20 7946 0941",
  attendance: "18,500 expected attendees",
  status: "Active",
  briefing: "Manage crowd ingress, keep emergency access clear, and escalate medical or safety issues to CONTROL ROOM immediately.",
  entry: "Staff entry via Gate A only. Guards must scan the QR code, complete profile verification, then start their assigned shift.",
  emergency: "Call CONTROL ROOM first unless there is immediate risk to life; then call emergency services and submit an incident report.",
};

type GuardContactRequest = {
  id: string;
  guardId: string;
  guardName: string;
  message: string;
  status: "awaiting_photo" | "photos_received";
  requestedAt: string;
  photoCount: number;
  photoNames: string[];
  notes?: string;
};

function readGuardContactRequests(): GuardContactRequest[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(GUARD_CONTACT_KEY) ?? "[]") as GuardContactRequest[];
  } catch {
    window.localStorage.removeItem(GUARD_CONTACT_KEY);
    return [];
  }
}

function writeGuardContactRequests(requests: GuardContactRequest[]) {
  window.localStorage.setItem(GUARD_CONTACT_KEY, JSON.stringify(requests));
  window.dispatchEvent(new CustomEvent("sentinel-contact-request"));
}

function readSecurityRoster(): SecurityRosterRow[] {
  if (typeof window === "undefined") return defaultRosterRows;
  try {
    return JSON.parse(window.localStorage.getItem(SECURITY_ROSTER_KEY) ?? JSON.stringify(defaultRosterRows)) as SecurityRosterRow[];
  } catch {
    window.localStorage.removeItem(SECURITY_ROSTER_KEY);
    return defaultRosterRows;
  }
}

function writeSecurityRoster(rows: SecurityRosterRow[]) {
  window.localStorage.setItem(SECURITY_ROSTER_KEY, JSON.stringify(rows));
  window.dispatchEvent(new CustomEvent("sentinel-security-roster"));
}

function readRosterVariations(): RosterVariation[] {
  if (typeof window === "undefined") return defaultRosterVariations;
  try {
    return JSON.parse(window.localStorage.getItem(ROSTER_VARIATION_KEY) ?? JSON.stringify(defaultRosterVariations)) as RosterVariation[];
  } catch {
    window.localStorage.removeItem(ROSTER_VARIATION_KEY);
    return defaultRosterVariations;
  }
}

function writeRosterVariations(rows: RosterVariation[]) {
  window.localStorage.setItem(ROSTER_VARIATION_KEY, JSON.stringify(rows));
  window.dispatchEvent(new CustomEvent("sentinel-roster-variations"));
}

function useSecurityRoster() {
  const [rows, setRows] = useState(readSecurityRoster);
  useEffect(() => {
    const sync = () => setRows(readSecurityRoster());
    window.addEventListener("sentinel-security-roster", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("sentinel-security-roster", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return rows;
}

function useRosterVariations() {
  const [rows, setRows] = useState(readRosterVariations);
  useEffect(() => {
    const sync = () => setRows(readRosterVariations());
    window.addEventListener("sentinel-roster-variations", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("sentinel-roster-variations", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return rows;
}

type AdminSite = (typeof sites)[number];
type ReportType = { title: string; desc: string; icon?: "calendar" | "file" | "route" };
type AdminUser = { name: string; email: string; role: string; status: string };
const inviteSchema = z.object({ name: z.string().trim().min(2).max(100), email: z.string().trim().email().max(255) });

function readStored<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { return JSON.parse(window.localStorage.getItem(key) ?? JSON.stringify(fallback)) as T; } catch { window.localStorage.removeItem(key); return fallback; }
}

function writeStored<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent(key));
}

function useGuardContactRequests() {
  const [requests, setRequests] = useState<GuardContactRequest[]>(() => readGuardContactRequests());

  useEffect(() => {
    const refresh = () => setRequests(readGuardContactRequests());
    const storageHandler = (event: StorageEvent) => {
      if (event.key === GUARD_CONTACT_KEY) refresh();
    };
    window.addEventListener("storage", storageHandler);
    window.addEventListener("sentinel-contact-request", refresh);
    return () => {
      window.removeEventListener("storage", storageHandler);
      window.removeEventListener("sentinel-contact-request", refresh);
    };
  }, []);

  return requests;
}

function createPhotoRequest(guard: { id: string; name: string; zone: string }) {
  const requests = readGuardContactRequests();
  const request: GuardContactRequest = {
    id: `REQ-${Date.now()}`,
    guardId: guard.id,
    guardName: guard.name,
    message: `CONTROL ROOM requests current position photos for ${guard.zone}.`,
    status: "awaiting_photo",
    requestedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    photoCount: 0,
    photoNames: [],
  };
  writeGuardContactRequests([request, ...requests.filter((item) => item.guardId !== guard.id).slice(0, 5)]);
}

function formatCoordinate(lat: number, lng: number) {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

function timeAgo(timestamp: number) {
  const seconds = Math.max(1, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) return `${seconds} sec ago`;
  return `${Math.round(seconds / 60)} min ago`;
}

function getMarkerPosition(lat: number, lng: number) {
  const bounds = { north: 51.512, south: 51.503, east: -0.078, west: -0.094 };
  const left = ((lng - bounds.west) / (bounds.east - bounds.west)) * 100;
  const top = ((bounds.north - lat) / (bounds.north - bounds.south)) * 100;
  return { left: `${Math.min(88, Math.max(10, left))}%`, top: `${Math.min(88, Math.max(10, top))}%` };
}

function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const earthRadius = 6371000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const haversine = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function useLiveGuardPositions() {
  const [positions, setPositions] = useState<GuardPosition[]>(() =>
    guards.map((guard) => ({ ...guard, updatedAt: Date.now() - 18000 }))
  );

  useEffect(() => {
    const applyTrackedGuard = () => {
      const raw = window.localStorage.getItem(LIVE_POSITION_KEY);
      if (!raw) return;
      try {
        const tracked = JSON.parse(raw) as { lat: number; lng: number; accuracy?: number; status?: string; updatedAt: number };
        setPositions((current) =>
          current.map((guard) =>
            guard.id === "g-101"
              ? {
                  ...guard,
                  lat: tracked.lat,
                  lng: tracked.lng,
                  accuracy: tracked.accuracy ?? guard.accuracy,
                  status: tracked.status ?? guard.status,
                  coords: formatCoordinate(tracked.lat, tracked.lng),
                  lastUpdate: timeAgo(tracked.updatedAt),
                  updatedAt: tracked.updatedAt,
                }
              : guard
          )
        );
      } catch {
        window.localStorage.removeItem(LIVE_POSITION_KEY);
      }
    };

    applyTrackedGuard();
    const storageHandler = (event: StorageEvent) => {
      if (event.key === LIVE_POSITION_KEY) applyTrackedGuard();
    };
    const customHandler = () => applyTrackedGuard();
    window.addEventListener("storage", storageHandler);
    window.addEventListener("sentinel-position", customHandler);

    const timer = window.setInterval(() => {
      applyTrackedGuard();
      setPositions((current) =>
        current.map((guard) => {
          if (guard.status === "offline" || guard.id === "g-101") return { ...guard, lastUpdate: guard.id === "g-101" ? timeAgo(guard.updatedAt) : guard.lastUpdate };
          const lat = Number((guard.lat + (Math.random() - 0.5) * 0.00035).toFixed(6));
          const lng = Number((guard.lng + (Math.random() - 0.5) * 0.00035).toFixed(6));
          const status = Math.random() > 0.94 ? "alert" : Math.random() > 0.7 ? "moving" : "in_zone";
          const updatedAt = Date.now();
          return { ...guard, lat, lng, status, updatedAt, coords: formatCoordinate(lat, lng), lastUpdate: "Live" };
        })
      );
    }, 2500);

    return () => {
      window.removeEventListener("storage", storageHandler);
      window.removeEventListener("sentinel-position", customHandler);
      window.clearInterval(timer);
    };
  }, []);

  return positions;
}

function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobileFlow = location.pathname.startsWith("/mobile");
  const [session, setSession] = useState<Session | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => typeof window !== "undefined" && window.localStorage.getItem("sidebar-collapsed") === "1");
  const toggleCollapsed = () => setCollapsed((c) => {
    window.localStorage.setItem("sidebar-collapsed", c ? "0" : "1");
    return !c;
  });

  useEffect(() => {
    if (location.pathname === "/") navigate("/admin", { replace: true });
  }, [location.pathname, navigate]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--safety)/0.09),transparent_34%),linear-gradient(135deg,hsl(var(--background)),hsl(var(--navy)))]" />
      {isMobileFlow ? (
        <div className="relative flex min-h-screen"><main className="min-w-0 flex-1"><MobilePortal session={session} /></main></div>
      ) : (
        <OpsProvider session={session}>
          <div className="relative flex min-h-screen">
            {session && <AdminSidebar open={menuOpen} onClose={() => setMenuOpen(false)} collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />}
            <main className={cx("min-w-0 flex-1 transition-[padding]", session && (collapsed ? "lg:pl-20" : "lg:pl-72"))}> 
              <AdminTopbar onMenu={() => setMenuOpen(true)} title={pathTitles[location.pathname] ?? "CONTROL ROOM"} session={session} />
              <AdminPortal session={session} />
            </main>
          </div>
        </OpsProvider>
      )}
    </div>
  );
}

function AdminSidebar({ open, onClose, collapsed, onToggleCollapsed }: { open: boolean; onClose: () => void; collapsed: boolean; onToggleCollapsed: () => void }) {
  const location = useLocation();
  const { can, roles } = useOps();
  const items = navItems.filter((n) => roles.length > 0 && canOpen(can, n));
  // Collapsing only applies on large screens; on phones/tablets the menu is a slide-out drawer.
  const hide = collapsed ? "lg:hidden" : "";
  return (
    <>
      <aside className={cx("fixed inset-y-0 left-0 z-40 flex w-72 flex-col overflow-y-auto border-r border-border bg-sidebar p-5 transition-[transform,width] lg:translate-x-0", collapsed && "lg:w-20 lg:px-3", open ? "translate-x-0" : "-translate-x-full")}> 
        <div className={cx("mb-8 flex items-center justify-between", collapsed && "lg:justify-center")}>
          <Link to="/admin" className="flex items-center gap-3" onClick={onClose} title="Out There Group – Control room">
            <img src={appIcon} alt="" width={44} height={44} className="h-11 w-11 shrink-0 rounded-md object-contain shadow-control" />
            <span className={hide}>
              <span className="block text-lg font-bold tracking-normal">Out There Group</span>
              <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">CONTROL ROOM</span>
            </span>
          </Link>
          <button className="icon-button lg:hidden" onClick={onClose} aria-label="Close menu"><X className="h-5 w-5" /></button>
        </div>
        <nav className="space-y-1">
          {items.map(({ path, label, icon: Icon }) => (
            <Link key={path} to={path} onClick={onClose} title={collapsed ? label : undefined} aria-label={label} className={cx("nav-link", collapsed && "lg:justify-center lg:px-0", location.pathname === path && "nav-link-active")}> 
              <Icon className="h-5 w-5 shrink-0" />
              <span className={hide}>{label}</span>
            </Link>
          ))}
        </nav>
        <Link to="/mobile" title={collapsed ? "Open Guard Portal" : undefined} className={cx("mt-8 flex items-center justify-between rounded-md border border-primary/30 bg-primary/10 p-4 text-sm font-semibold text-primary", collapsed && "lg:justify-center lg:p-3")}>
          <span className={hide}>Open Guard Portal</span>
          <ArrowRight className="h-4 w-4 shrink-0" />
        </Link>
        <button onClick={onToggleCollapsed} aria-label={collapsed ? "Expand menu" : "Collapse menu"} title={collapsed ? "Expand menu" : "Collapse menu"} className={cx("nav-link mt-auto hidden w-full lg:flex", collapsed && "lg:justify-center lg:px-0")}>
          {collapsed ? <PanelLeftOpen className="h-5 w-5 shrink-0" /> : <PanelLeftClose className="h-5 w-5 shrink-0" />}
          <span className={hide}>Collapse menu</span>
        </button>
      </aside>
      {open && <button className="fixed inset-0 z-30 bg-background/70 backdrop-blur-sm lg:hidden" onClick={onClose} aria-label="Close navigation" />}
    </>
  );
}

function AdminTopbar({ onMenu, title, session }: { onMenu: () => void; title: string; session: Session | null }) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/88 px-4 py-4 backdrop-blur-xl sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button className="icon-button lg:hidden" onClick={onMenu} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{"\n"}</div>
            <h1 className="text-xl font-bold sm:text-2xl">{title}</h1>
          </div>
        </div>
        {session && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card text-sm font-bold uppercase transition-colors hover:border-primary" aria-label="Account menu">
                {(session.user.email ?? "?").slice(0, 2)}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="font-normal">
                <span className="block text-xs text-muted-foreground">Signed in as</span>
                <span className="block truncate text-sm font-semibold">{session.user.email}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild><Link to="/admin/settings"><Settings className="mr-2 h-4 w-4" /> Settings</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link to="/admin/guides"><BookOpen className="mr-2 h-4 w-4" /> User guides</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link to="/mobile"><ArrowRight className="mr-2 h-4 w-4" /> Guard portal</Link></DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={async () => { await stopSharingOnLogout(); await supabase.auth.signOut(); }}><LogOut className="mr-2 h-4 w-4" /> Log out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}

function AdminPortal({ session }: { session: Session | null }) {
  const { pathname } = useLocation();
  if (!session) return <AuthPage />;
  return (
    <>
      <EventPicker />
      <OpsPage pathname={pathname} />
    </>
  );
}

function OpsPage({ pathname }: { pathname: string }) {
  const { can, roles, loading, session } = useOps();
  if (!roles.length) return null;
  const item = navItems.find((n) => n.path === pathname) ?? navItems[0];
  if (!canOpen(can, item)) {
    // A link to a specific page (e.g. a variation alert) opened while signed in as an account without access:
    // say so and offer a switch, rather than silently landing somewhere else.
    if (pathname !== "/admin") {
      return (
        <div className="mx-4 mt-4 space-y-3 rounded-md border border-warning/40 bg-card p-4 text-sm sm:mx-6 lg:mx-8">
          <p className="font-semibold">You're signed in as {session?.user.email}, which can't open {item.label}.</p>
          <p className="text-muted-foreground">If this link was sent to you, sign out and sign in with the account the alert was meant for.</p>
          <button className="primary-button h-11" onClick={async () => { await stopSharingOnLogout(); await supabase.auth.signOut(); }}>Sign out and switch account</button>
        </div>
      );
    }
    if (roles.length === 1 && roles[0] === "security_guard") return <Navigate to="/mobile" replace />;
    const first = navItems.find((n) => canOpen(can, n));
    if (first && pathname !== first.path) return <Navigate to={first.path} replace />;
    return <p className="mx-4 mt-4 rounded-md border border-border bg-card p-4 text-sm text-muted-foreground sm:mx-6 lg:mx-8">{loading ? "Loading…" : "You don't have access to this page. Ask a Super Admin to tick it for you under Settings → Users & roles."}</p>;
  }
  return pathname === "/admin/roster" ? <OpsRoster /> : pathname === "/admin/sign-in" ? <OpsSignIn /> : pathname === "/admin/variations" ? <OpsVariations /> : pathname === "/admin/guards" ? <OpsGuards /> : pathname === "/admin/communications" ? <OpsComms /> : pathname === "/admin/settings" ? <OpsSettings /> : pathname === "/admin/guides" ? <OpsGuides /> : <OpsDashboard />;
}

function EventPicker() {
  const { events, event, setEventId, roles, canViewCosts, viewMode, setViewMode } = useOps();
  if (!roles.length) return <p className="mx-4 mt-4 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm sm:mx-6 lg:mx-8">Your account has no access role yet. A Super Admin can grant you access under Settings → Users & roles. Already granted? Refresh the page.</p>;
  if (events.length < 2 && !canViewCosts) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 sm:px-6 lg:px-8">
      {events.length >= 2 ? <select className="control-input h-10 w-auto" value={event?.id ?? ""} onChange={(e) => setEventId(e.target.value)}>{events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select> : <span />}
      {canViewCosts && (
        <div className="flex items-center gap-3">
          {viewMode === "security" && <span className="text-xs text-muted-foreground">Previewing what Security Managers see — costs hidden, no approving</span>}
          <div className="flex gap-1 rounded-md border border-border bg-card p-1" role="group" aria-label="View">
            {([["admin", "Admin view"], ["security", "Security Manager view"]] as const).map(([id, label]) => (
              <button key={id} onClick={() => setViewMode(id)} className={cx("rounded px-3 py-1.5 text-sm font-semibold transition-colors", viewMode === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>{label}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submitAuth = async () => {
    setMessage("");
    const parsed = authSchema.safeParse({ email, password });
    if (!parsed.success) {
      setMessage(Object.values(parsed.error.flatten().fieldErrors).flat()[0] ?? "Check your details.");
      return;
    }
    setSubmitting(true);
    const credentials = parsed.data as { email: string; password: string };
    const result = mode === "login"
      ? await supabase.auth.signInWithPassword(credentials)
      : await supabase.auth.signUp({ ...credentials, options: { emailRedirectTo: window.location.origin } });
    setSubmitting(false);
    if (result.error) setMessage(result.error.message);
    else if (mode === "signup") setMessage("Check your email to verify your account, then log in.");
  };

  return <AdminPage><section className="mx-auto max-w-md panel p-6"><img src={appIcon} alt="OTG Event Security" width={56} height={56} className="mx-auto mb-4 h-14 w-14 rounded-xl" /><PanelHeader title={mode === "login" ? "Log in" : "Create account"} description="Use email and password to access CONTROL ROOM." icon={Lock} /><div className="mt-6 space-y-3"><input className="control-input h-12" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} /><input className="control-input h-12" placeholder="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} /><button className="primary-button h-12 w-full" disabled={submitting} onClick={submitAuth}>{mode === "login" ? "Log in" : "Create account"} <ArrowRight className="h-4 w-4" /></button><button className="secondary-button h-12 w-full" onClick={() => setMode(mode === "login" ? "signup" : "login")}>{mode === "login" ? "Create an account" : "Use existing account"}</button>{message && <p className="rounded-md bg-secondary p-3 text-sm text-muted-foreground">{message}</p>}</div></section></AdminPage>;
}

function OverviewPage() {
  return (
    <AdminPage>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metricCards.map(({ label, value, delta, icon: Icon, tone }) => (
          <div key={label} className="panel p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="mt-2 text-3xl font-bold">{value}</p>
              </div>
              <span className={cx("metric-icon", `metric-${tone}`)}><Icon className="h-5 w-5" /></span>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">{delta}</p>
          </div>
        ))}
      </section>
      <section className="grid gap-5 xl:grid-cols-[1.55fr_0.95fr]">
        <LiveMapCard compact />
        <AlertPanel />
      </section>
      <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <IncidentTable compact />
        <AuditTrail />
      </section>
    </AdminPage>
  );
}

function LiveMapPage() {
  return (
    <AdminPage>
      <LiveMapCard />
      <AuditTrail />
    </AdminPage>
  );
}

function LiveMapCard({ compact = false }: { compact?: boolean }) {
  const liveGuards = useLiveGuardPositions();
  const [selectedId, setSelectedId] = useState(liveGuards[0].id);
  const [detailsCollapsed, setDetailsCollapsed] = useState(false);
  const selected = useMemo(() => liveGuards.find((guard) => guard.id === selectedId) ?? liveGuards[0], [liveGuards, selectedId]);
  const postStates = useMemo(
    () =>
      initialGuardPosts.map((post) => {
        const assignedGuard = liveGuards.find((guard) => guard.id === post.guardId);
        const distance = assignedGuard ? distanceMeters(post, assignedGuard) : Number.POSITIVE_INFINITY;
        return { ...post, assignedGuard, distance, occupied: Boolean(assignedGuard && assignedGuard.status !== "offline" && distance <= post.radiusMeters) };
      }),
    [liveGuards]
  );
  const unfilledPosts = postStates.filter((post) => !post.occupied);
  const mapUrl = "https://maps.google.com/maps?q=51.5078,-0.0844&z=15&output=embed";

  return (
    <section className="panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
        <div>
          <h2 className="text-lg font-bold">Google live site map</h2>
          <p className="text-sm text-muted-foreground">Google Maps base layer with post dots and live guard telemetry</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="status-pill status-danger">{unfilledPosts.length} unfilled positions</span>
          <Legend color="success" label="Guard on post" />
          <Legend color="danger" label="Post vacant" />
          <Legend color="success" label="In zone" />
          <Legend color="warning" label="Moving" />
          <Legend color="offline" label="Offline" />
        </div>
      </div>
      <div className={cx("grid", compact ? detailsCollapsed ? "lg:grid-cols-1" : "lg:grid-cols-[1fr_320px]" : "xl:grid-cols-[1fr_380px]")}> 
        <div className={cx("relative min-h-[420px] overflow-hidden bg-map", !compact && "lg:min-h-[610px]")}> 
          <iframe
            title="Google live security map"
            src={mapUrl}
            className="absolute inset-0 h-full w-full border-0 opacity-75 grayscale invert"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          <div className="absolute inset-0 bg-background/20" />
          <div className="absolute left-[8%] top-[12%] rounded-md border border-border bg-card/80 p-3 text-xs text-muted-foreground backdrop-blur">Northbank Arena</div>
          <div className="absolute bottom-[15%] left-[15%] rounded-md border border-border bg-card/80 p-3 text-xs text-muted-foreground backdrop-blur">Harbour Logistics Park</div>
          <div className="absolute right-[10%] top-[24%] rounded-md border border-border bg-card/80 p-3 text-xs text-muted-foreground backdrop-blur">City Data Centre</div>
          {postStates.map((post) => (
            <button
              key={post.id}
              className={cx("post-dot", post.occupied ? "post-dot-occupied" : "post-dot-vacant")}
              style={getMarkerPosition(post.lat, post.lng)}
              onClick={() => post.assignedGuard && setSelectedId(post.assignedGuard.id)}
              aria-label={`${post.label} is ${post.occupied ? "covered" : "vacant"}`}
            >
              <span>{post.occupied ? "✓" : "!"}</span>
              <b>{post.label}</b>
            </button>
          ))}
          {liveGuards.map((guard) => (
            <button
              key={guard.id}
              onClick={() => setSelectedId(guard.id)}
              className={cx("guard-marker", statusMeta[guard.status as keyof typeof statusMeta].marker, selected.id === guard.id && "marker-selected")}
              style={getMarkerPosition(guard.lat, guard.lng)}
              aria-label={`Open ${guard.name}`}
            >
              <span>{guard.photo}</span>
            </button>
          ))}
          <div className="absolute bottom-5 left-5 rounded-md border border-border bg-card/90 p-4 backdrop-blur">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Radio className="h-4 w-4 text-primary" /> Live tracking feed</div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-success" />
              <span className="text-xs text-muted-foreground">Red post dots turn green when the assigned guard is on position</span>
            </div>
          </div>
          {compact && detailsCollapsed && (
            <button className="secondary-button absolute right-5 top-5" onClick={() => setDetailsCollapsed(false)}>
              <ChevronRight className="h-4 w-4" /> Guard details
            </button>
          )}
        </div>
        {(!compact || !detailsCollapsed) && <GuardDetail guard={selected} posts={postStates} onCollapsePanel={compact ? () => setDetailsCollapsed(true) : undefined} />}
      </div>
    </section>
  );
}

function GuardDetail({ guard, posts, onCollapsePanel }: { guard: GuardPosition; posts?: Array<GuardPost & { distance: number; occupied: boolean }>; onCollapsePanel?: () => void }) {
  const meta = statusMeta[guard.status as keyof typeof statusMeta];
  const assignedPost = posts?.find((post) => post.guardId === guard.id);
  const contactRequests = useGuardContactRequests();
  const latestRequest = contactRequests.find((request) => request.guardId === guard.id);
  const [minimised, setMinimised] = useState(false);
  return (
    <aside className="border-t border-border bg-card p-5 xl:border-l xl:border-t-0">
      <div className="flex items-start gap-4">
        <span className="grid h-16 w-16 place-items-center rounded-md bg-secondary text-lg font-bold">{guard.photo}</span>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-bold">{guard.name}</h3>
          <p className="text-sm text-muted-foreground">{guard.role}</p>
          <span className={cx("status-pill mt-3", meta.className)}>{meta.label}</span>
        </div>
        <button className="icon-button" aria-label={onCollapsePanel ? "Hide guard details panel" : minimised ? "Expand guard details" : "Minimise guard details"} onClick={() => onCollapsePanel ? onCollapsePanel() : setMinimised((current) => !current)}>
          {minimised ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>
      {minimised && <p className="mt-4 text-sm text-muted-foreground">{guard.site} · {guard.shift} · {guard.lastUpdate}</p>}
      {!minimised && <>
      <div className="mt-6 space-y-4 text-sm">
        <InfoRow label="Site" value={guard.site} />
        <InfoRow label="Shift" value={guard.shift} />
        <InfoRow label="Zone" value={guard.zone} />
        <InfoRow label="Current location" value={formatCoordinate(guard.lat, guard.lng)} />
        <InfoRow label="Accuracy" value={guard.accuracy ? `${guard.accuracy}m` : "Unavailable"} />
        <InfoRow label="Last update" value={guard.lastUpdate} />
        {assignedPost && <InfoRow label="Planned position" value={`${assignedPost.label} · ${assignedPost.occupied ? "Filled" : "Unfilled"}`} />}
        {assignedPost && <InfoRow label="Distance to post" value={`${Math.round(assignedPost.distance)}m / ${assignedPost.radiusMeters}m`} />}
        <InfoRow label="Incident count" value={String(guard.incidents)} />
        {latestRequest && <InfoRow label="Photo response" value={`${latestRequest.photoCount} received · ${latestRequest.status === "photos_received" ? "Complete" : "Awaiting guard"}`} />}
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
        <a className="primary-button" href={`tel:${guard.phone.replace(/\s/g, "")}`}><Phone className="h-4 w-4" /> Call</a>
        <a className="secondary-button" href={`sms:${guard.phone.replace(/\s/g, "")}?&body=${encodeURIComponent("CONTROL ROOM check-in: please reply with your current status and any required photos.")}`}><MessageSquare className="h-4 w-4" /> Text</a>
        <button className="secondary-button sm:col-span-2 xl:col-span-1 2xl:col-span-2" onClick={() => createPhotoRequest(guard)}><Camera className="h-4 w-4" /> Request photos</button>
        <button className="secondary-button sm:col-span-2 xl:col-span-1 2xl:col-span-2"><Route className="h-4 w-4" /> Replay</button>
      </div>
      {latestRequest && (
        <div className="mt-4 rounded-md border border-border bg-secondary p-3 text-sm">
          <div className="flex items-center justify-between gap-3"><span className="font-semibold">Latest contact request</span><span className={cx("status-pill", latestRequest.status === "photos_received" ? "status-success" : "status-warning")}>{latestRequest.status === "photos_received" ? "Photos received" : "Awaiting photos"}</span></div>
          <p className="mt-2 text-muted-foreground">{latestRequest.message}</p>
          {latestRequest.photoNames.length > 0 && <p className="mt-2 text-xs text-muted-foreground">{latestRequest.photoNames.join(", ")}</p>}
        </div>
      )}
      </>}
    </aside>
  );
}

function GuardsPage() {
  return (
    <AdminPage>
      <section className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <GuardRoster />
        <div className="space-y-5">
          <PanelHeader title="QR onboarding" description="Generate unique guard invite links" icon={QrCode} />
          <div className="panel p-5">
            <div className="mx-auto grid h-44 w-44 place-items-center rounded-md border border-primary/50 bg-primary/10">
              <QrCode className="h-24 w-24 text-primary" />
            </div>
            <div className="mt-5 rounded-md bg-secondary p-3 text-sm text-muted-foreground break-all">/mobile/onboarding?invite=SG-HARBOUR-A12</div>
            <button className="primary-button mt-4 w-full"><QrCode className="h-4 w-4" /> Generate QR code</button>
          </div>
          <ProfileCard />
        </div>
      </section>
    </AdminPage>
  );
}

function GuardRoster() {
  const contactRequests = useGuardContactRequests();
  return (
    <section className="panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
        <div>
          <h2 className="text-lg font-bold">Guard roster</h2>
          <p className="text-sm text-muted-foreground">Profiles, licences, status and shift history</p>
        </div>
        <button className="primary-button"><UserCheck className="h-4 w-4" /> Create guard</button>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead><tr><th>Guard</th><th>Employee ID</th><th>Licence</th><th>Site</th><th>Status</th><th>Contact</th></tr></thead>
          <tbody>
            {guards.map((guard) => (
              <tr key={guard.id}>
                <td><div className="flex items-center gap-3"><span className="avatar-sm">{guard.photo}</span><span><b>{guard.name}</b><small>{guard.phone}</small></span></div></td>
                <td>{guard.employeeId}</td>
                <td>{guard.licence}</td>
                <td>{guard.site}</td>
                <td><span className={cx("status-pill", statusMeta[guard.status as keyof typeof statusMeta].className)}>{statusMeta[guard.status as keyof typeof statusMeta].label}</span></td>
                <td>
                  <div className="flex flex-wrap gap-2">
                    <a className="table-action" href={`tel:${guard.phone.replace(/\s/g, "")}`}>Call</a>
                    <a className="table-action" href={`sms:${guard.phone.replace(/\s/g, "")}?&body=${encodeURIComponent("CONTROL ROOM check-in: please reply with your current status and attach photos if requested.")}`}>Text</a>
                    <button className="table-action" onClick={() => createPhotoRequest(guard)}>Photos</button>
                  </div>
                  {contactRequests.find((request) => request.guardId === guard.id) && <small>{contactRequests.find((request) => request.guardId === guard.id)?.status === "photos_received" ? "Photos received" : "Photo request pending"}</small>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SitesPage() {
  const [adminSites, setAdminSites] = useState<AdminSite[]>(() => readStored(ADMIN_SITES_KEY, sites));
  const [siteName, setSiteName] = useState("Festival South Gate");
  const [siteAddress, setSiteAddress] = useState("Melbourne Showgrounds");
  const addSite = () => {
    const next = [...adminSites, { name: siteName, address: siteAddress, supervisor: "Unassigned", phone: "TBC", reference: `SITE-${adminSites.length + 1}`, fence: "Pending geo-fence", active: 0 }];
    setAdminSites(next); writeStored(ADMIN_SITES_KEY, next);
  };
  return (
    <AdminPage>
      <section className="panel p-5">
        <PanelHeader title="Add site" description="Manually create a roster location and operational site" icon={MapPin} />
        <div className="mt-5 grid gap-3 md:grid-cols-[1fr_1fr_auto]"><input className="control-input" value={siteName} onChange={(event) => setSiteName(event.target.value)} /><input className="control-input" value={siteAddress} onChange={(event) => setSiteAddress(event.target.value)} /><button className="primary-button" onClick={addSite}><CheckCircle2 className="h-4 w-4" /> Add site</button></div>
      </section>
      <section className="grid gap-5 lg:grid-cols-3">
        {adminSites.map((site) => (
          <div key={site.name} className="panel p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <span className="metric-icon metric-info"><MapPin className="h-5 w-5" /></span>
              <span className="status-pill status-success">{site.active} active</span>
            </div>
            <h2 className="text-xl font-bold">{site.name}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{site.address}</p>
            <div className="mt-5 space-y-3 text-sm">
              <InfoRow label="Supervisor" value={site.supervisor} />
              <InfoRow label="Phone" value={site.phone} />
              <InfoRow label="Map reference" value={site.reference} />
              <InfoRow label="Geo-fence" value={site.fence} />
            </div>
          </div>
        ))}
      </section>
      <section className="panel p-5">
        <PanelHeader title="Geo-fence editor" description="Prototype polygon editor for site zones" icon={Navigation} />
        <div className="mt-5 grid min-h-[360px] place-items-center rounded-md border border-dashed border-border bg-map text-center">
          <div>
            <MapPin className="mx-auto mb-3 h-10 w-10 text-primary" />
            <p className="font-semibold">Draw approved zones and post locations</p>
            <p className="mt-1 text-sm text-muted-foreground">Map provider can replace this placeholder without changing workflows.</p>
          </div>
        </div>
      </section>
    </AdminPage>
  );
}

function EventDetailsPage() {
  const [eventDetails, setEventDetails] = useState(defaultEventDetails);
  return (
    <AdminPage>
      <section className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="panel p-5">
          <PanelHeader title="Event details" description="Core briefing details shown to CONTROL ROOM and guard shift views" icon={CalendarClock} />
          <div className="mt-5 grid gap-3">
            <input className="control-input" value={eventDetails.eventName} onChange={(event) => setEventDetails({ ...eventDetails, eventName: event.target.value.slice(0, 120) })} />
            <input className="control-input" value={eventDetails.venueName} onChange={(event) => setEventDetails({ ...eventDetails, venueName: event.target.value.slice(0, 120) })} />
            <div className="grid gap-3 sm:grid-cols-2"><input className="control-input" value={eventDetails.date} onChange={(event) => setEventDetails({ ...eventDetails, date: event.target.value.slice(0, 40) })} /><input className="control-input" value={eventDetails.time} onChange={(event) => setEventDetails({ ...eventDetails, time: event.target.value.slice(0, 40) })} /></div>
            <input className="control-input" value={eventDetails.client} onChange={(event) => setEventDetails({ ...eventDetails, client: event.target.value.slice(0, 120) })} />
            <input className="control-input" value={eventDetails.supervisor} onChange={(event) => setEventDetails({ ...eventDetails, supervisor: event.target.value.slice(0, 120) })} />
            <input className="control-input" value={eventDetails.attendance} onChange={(event) => setEventDetails({ ...eventDetails, attendance: event.target.value.slice(0, 80) })} />
            <textarea className="control-input min-h-24" value={eventDetails.briefing} onChange={(event) => setEventDetails({ ...eventDetails, briefing: event.target.value.slice(0, 800) })} />
            <textarea className="control-input min-h-20" value={eventDetails.entry} onChange={(event) => setEventDetails({ ...eventDetails, entry: event.target.value.slice(0, 600) })} />
            <textarea className="control-input min-h-20" value={eventDetails.emergency} onChange={(event) => setEventDetails({ ...eventDetails, emergency: event.target.value.slice(0, 600) })} />
            <button className="primary-button h-12 w-full"><CheckCircle2 className="h-4 w-4" /> Save event details</button>
          </div>
        </div>
        <section className="panel p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm text-muted-foreground">{eventDetails.venueName}</p><h2 className="text-2xl font-bold">{eventDetails.eventName}</h2></div><span className="status-pill status-success">{eventDetails.status}</span></div>
          <div className="mt-6 grid gap-4 text-sm sm:grid-cols-2"><InfoRow label="Date" value={eventDetails.date} /><InfoRow label="Time" value={eventDetails.time} /><InfoRow label="Client" value={eventDetails.client} /><InfoRow label="Supervisor" value={eventDetails.supervisor} /><InfoRow label="Attendance" value={eventDetails.attendance} /><InfoRow label="QR onboarding" value="Open to security guards" /></div>
          <div className="mt-6 space-y-4"><div className="rounded-md border border-border bg-card p-4"><h3 className="font-bold">Briefing</h3><p className="mt-2 text-sm text-muted-foreground">{eventDetails.briefing}</p></div><div className="rounded-md border border-border bg-card p-4"><h3 className="font-bold">Entry instructions</h3><p className="mt-2 text-sm text-muted-foreground">{eventDetails.entry}</p></div><div className="rounded-md border border-border bg-card p-4"><h3 className="font-bold">Emergency procedures</h3><p className="mt-2 text-sm text-muted-foreground">{eventDetails.emergency}</p></div></div>
        </section>
      </section>
    </AdminPage>
  );
}

function ShiftsPage() {
  return (
    <AdminPage>
      <section className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="panel p-5">
          <PanelHeader title="Create shift" description="Assign guard, role, zone and briefing" icon={CalendarClock} />
          <div className="mt-5 grid gap-3">
            {[
              "Guard: Maya Collins",
              "Site: Harbour Logistics Park",
              "Role: Main Gate Officer",
              "Zone: Gate A / Yard 2",
              "Start: Today 18:00",
              "Finish: Tomorrow 06:00",
            ].map((item) => <div key={item} className="form-field">{item}</div>)}
            <textarea className="control-input min-h-28" defaultValue="Verify all delivery manifests, challenge unknown vehicles, keep Gate A clear for emergency access, and call supervisor before denying access." />
            <button className="primary-button"><ClipboardCheck className="h-4 w-4" /> Publish shift briefing</button>
          </div>
        </div>
        <div className="panel overflow-hidden">
          <div className="border-b border-border p-5"><h2 className="text-lg font-bold">Attendance history</h2></div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Guard</th><th>Site</th><th>Scheduled</th><th>Log-on</th><th>Log-off</th><th>Status</th></tr></thead>
              <tbody>
                {guards.map((guard, i) => (
                  <tr key={guard.id}>
                    <td>{guard.name}</td><td>{guard.site}</td><td>{guard.shift}</td><td>{i === 3 ? "—" : "On time"}</td><td>{i === 3 ? "06:01" : "Active"}</td><td><span className={cx("status-pill", i === 3 ? "status-offline" : "status-success")}>{i === 3 ? "Completed" : "Active"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </AdminPage>
  );
}

function RostersPage() {
  const rosterRows = useSecurityRoster();
  const variations = useRosterVariations();
  const [fileName, setFileName] = useState("event_security_roster.xlsx");
  const [editingId, setEditingId] = useState(rosterRows[0]?.id ?? "");
  const [editLocation, setEditLocation] = useState(rosterRows[0]?.location ?? "");
  const [editFinish, setEditFinish] = useState(rosterRows[0]?.finish ?? "");
  const [editCost, setEditCost] = useState(String(rosterRows[0]?.cost ?? 0));
  const locations = ["All locations", ...Array.from(new Set(rosterRows.map((row) => row.site)))];
  const [selectedLocation, setSelectedLocation] = useState(locations[0]);
  const filteredRosterRows = selectedLocation === "All locations" ? rosterRows : rosterRows.filter((row) => row.site === selectedLocation);
  const selectedRow = rosterRows.find((row) => row.id === editingId) ?? rosterRows[0];
  const totalCost = filteredRosterRows.reduce((sum, row) => sum + Number(row.cost || 0), 0);
  const pendingCost = variations.filter((variation) => variation.status === "pending_signoff").reduce((sum, variation) => sum + variation.costDelta, 0);

  const uploadRoster = async (file?: File) => {
    if (!file) return;
    setFileName(file.name);
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet).slice(0, 80);
    const imported = rows.map((row, index) => {
      const getValue = (...keys: string[]) => keys.map((key) => row[key]).find((value) => value !== undefined && value !== null && String(value).trim() !== "");
      const guardName = String(getValue("Name", "Guard", "guard", "name") ?? `Imported guard ${index + 1}`);
      const matchedGuard = guards.find((guard) => guard.name.toLowerCase() === guardName.toLowerCase());
      const start = String(getValue("Start", "Start Time", "Shift Start", "start") ?? "TBC");
      const finish = String(getValue("Finish", "End", "End Time", "Shift End", "finish") ?? "TBC");
      const cost = Number(getValue("Cost", "Total Cost", "cost", "total") ?? 0);
      return {
        id: `IMP-${Date.now()}-${index + 1}`,
        guardId: matchedGuard?.id ?? "unlinked",
        guardName,
        site: String(getValue("Site", "site") ?? matchedGuard?.site ?? "Unassigned site"),
        location: String(getValue("Location", "Post", "Zone", "location") ?? matchedGuard?.zone ?? "Unassigned location"),
        role: String(getValue("Role", "Position", "role") ?? matchedGuard?.role ?? "Security Guard"),
        start,
        finish,
        hours: Number(getValue("Hours", "hours") ?? 0),
        cost: Number.isFinite(cost) ? cost : 0,
        status: "approved" as const,
        signoff: matchedGuard ? "Linked to guard profile" : "Needs guard link",
      };
    });
    writeSecurityRoster(imported.length ? imported : defaultRosterRows);
  };

  const createVariation = () => {
    if (!selectedRow) return;
    const proposedCost = Number(editCost || selectedRow.cost);
    const variation: RosterVariation = {
      id: `RV-${Date.now().toString().slice(-5)}`,
      rosterId: selectedRow.id,
      guardName: selectedRow.guardName,
      detail: `Location ${selectedRow.location} → ${editLocation || selectedRow.location}; finish ${selectedRow.finish} → ${editFinish || selectedRow.finish}`,
      costDelta: proposedCost - selectedRow.cost,
      status: "pending_signoff",
      signoff: "Awaiting senior leadership",
    };
    writeRosterVariations([variation, ...readRosterVariations()]);
    writeSecurityRoster(rosterRows.map((row) => row.id === selectedRow.id ? { ...row, location: editLocation || row.location, finish: editFinish || row.finish, cost: proposedCost, status: "pending_signoff", signoff: "Variation pending sign-off" } : row));
  };

  const approveVariation = (variationId: string) => {
    writeRosterVariations(readRosterVariations().map((variation) => variation.id === variationId ? { ...variation, status: "approved", signoff: "Rebecca Lane · Senior Leadership" } : variation));
  };

  return (
    <AdminPage>
      <section className="grid gap-4 md:grid-cols-4">
        <div className="panel p-5"><p className="text-sm text-muted-foreground">Roster rows</p><p className="mt-2 text-3xl font-bold">{filteredRosterRows.length}</p><p className="mt-1 text-sm text-muted-foreground">{fileName}</p></div>
        <div className="panel p-5"><p className="text-sm text-muted-foreground">Roster total cost</p><p className="mt-2 text-3xl font-bold">${totalCost.toLocaleString()}</p><p className="mt-1 text-sm text-muted-foreground">Approved baseline · AUD</p></div>
        <div className="panel p-5"><p className="text-sm text-muted-foreground">Pending variation cost</p><p className="mt-2 text-3xl font-bold text-warning">${pendingCost.toLocaleString()}</p><p className="mt-1 text-sm text-muted-foreground">Requires sign-off</p></div>
        <div className="panel p-5"><p className="text-sm text-muted-foreground">Roster location</p><select className="control-input mt-3" value={selectedLocation} onChange={(event) => setSelectedLocation(event.target.value)}>{locations.map((location) => <option key={location} value={location}>{location}</option>)}</select></div>
      </section>
      <CollapsibleSection title="Upload and edit roster" description="Excel upload, linked guard rows and senior sign-off variations" icon={UploadCloud}>
      <section className="grid gap-5 xl:grid-cols-[0.76fr_1.24fr]">
        <div className="panel p-5">
          <PanelHeader title="Upload security roster" description="Import Excel columns for name, shift times, location and cost" icon={UploadCloud} />
          <label className="mt-5 grid min-h-40 cursor-pointer place-items-center rounded-md border border-dashed border-border bg-secondary p-5 text-center transition hover:border-primary">
            <input className="sr-only" type="file" accept=".xlsx,.xls" onChange={(event) => uploadRoster(event.target.files?.[0])} />
            <span><UploadCloud className="mx-auto mb-3 h-10 w-10 text-primary" /><span className="block font-semibold">Upload Excel roster</span><span className="mt-1 block text-sm text-muted-foreground">Rows auto-link when the name matches a guard profile.</span></span>
          </label>
          <div className="mt-5 grid gap-3">
            <select className="control-input" value={editingId} onChange={(event) => { const row = rosterRows.find((item) => item.id === event.target.value); setEditingId(event.target.value); setEditLocation(row?.location ?? ""); setEditFinish(row?.finish ?? ""); setEditCost(String(row?.cost ?? 0)); }}>
              {rosterRows.map((row) => <option key={row.id} value={row.id}>{row.guardName} · {row.start}–{row.finish}</option>)}
            </select>
            <input className="control-input" value={editLocation} onChange={(event) => setEditLocation(event.target.value)} placeholder="Updated location" />
            <input className="control-input" value={editFinish} onChange={(event) => setEditFinish(event.target.value)} placeholder="Updated finish time" />
            <input className="control-input" value={editCost} onChange={(event) => setEditCost(event.target.value)} inputMode="decimal" placeholder="Updated total cost" />
            <button className="primary-button" onClick={createVariation}><FileSignature className="h-4 w-4" /> Submit roster variation for sign-off</button>
          </div>
        </div>
        <section className="panel overflow-hidden">
          <div className="border-b border-border p-5"><h2 className="text-lg font-bold">Editable roster</h2><p className="text-sm text-muted-foreground">Uploaded shifts link to guard scan-in records by guard profile.</p></div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Guard</th><th>Shift</th><th>Location</th><th>Cost</th><th>Status</th></tr></thead>
              <tbody>{filteredRosterRows.map((row) => <tr key={row.id}><td>{row.guardName}<small>{row.guardId === "unlinked" ? "Needs manual link" : `${row.role} · linked`}</small></td><td>{row.start}–{row.finish}<small>{row.hours || "—"} planned hours</small></td><td>{row.site}<small>{row.location}</small></td><td>${Number(row.cost || 0).toLocaleString()}<small>AUD</small></td><td><span className={cx("status-pill", row.status === "approved" ? "status-success" : "status-warning")}>{row.status.split("_").join(" ")}</span><small>{row.signoff}</small></td></tr>)}</tbody>
            </table>
          </div>
        </section>
      </section>
      </CollapsibleSection>
      <CollapsibleSection title="Roster variation sign-off" description="All time, location and cost changes are held for senior leadership approval." icon={FileSignature}>
        <div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Variation</th><th>Detail</th><th>Cost impact</th><th>Status</th><th>Sign-off</th></tr></thead><tbody>{variations.map((variation) => <tr key={variation.id}><td>{variation.id}<small>{variation.guardName}</small></td><td>{variation.detail}</td><td>{variation.costDelta >= 0 ? "+" : "-"}${Math.abs(variation.costDelta).toLocaleString()}</td><td><span className={cx("status-pill", variation.status === "approved" ? "status-success" : "status-warning")}>{variation.status.split("_").join(" ")}</span></td><td>{variation.signoff}<small>{variation.status === "pending_signoff" && <button className="table-action mt-2" onClick={() => approveVariation(variation.id)}>Approve</button>}</small></td></tr>)}</tbody></table></div>
      </CollapsibleSection>
      <CollapsibleSection title="Attendance history" description="Retained shift attendance record" icon={History}><AttendanceHistory /></CollapsibleSection>
      <CollapsibleSection title="Shift extensions" description="Extension approvals and auto-end policy" icon={UserCog}><ShiftExtensionsContent /></CollapsibleSection>
      <CollapsibleSection title="Event scope changes" description="Create new variations or scope changes with full commercial detail" icon={FileSignature}><ScopeChangesContent /></CollapsibleSection>
    </AdminPage>
  );
}

function ShiftExtensionsPage() {
  const requested = shiftExtensions.filter((extension) => extension.status === "requested");
  return (
    <AdminPage>
      <ShiftExtensionsContent />
    </AdminPage>
  );
}

function ShiftExtensionsContent() {
  const requested = shiftExtensions.filter((extension) => extension.status === "requested");
  return <>
    <section className="grid gap-4 md:grid-cols-3">
      <div className="panel p-5"><p className="text-sm text-muted-foreground">Pending extension approvals</p><p className="mt-2 text-3xl font-bold text-warning">{requested.length}</p></div>
      <div className="panel p-5"><p className="text-sm text-muted-foreground">Auto end policy</p><p className="mt-2 text-3xl font-bold">On</p></div>
      <div className="panel p-5"><p className="text-sm text-muted-foreground">Approved overtime cost</p><p className="mt-2 text-3xl font-bold">$32</p></div>
    </section>
    <section className="grid gap-5 xl:grid-cols-[0.78fr_1.22fr]">
        <div className="panel p-5">
          <PanelHeader title="System admin approval" description="A shift only continues beyond rostered finish when an admin approves an extension" icon={UserCog} />
          <div className="mt-5 space-y-3 text-sm">
            <InfoRow label="Default action" value="Auto end at rostered time" />
            <InfoRow label="Tracking" value="Stops on automatic log-off" />
            <InfoRow label="Exception" value="Approved extension only" />
            <InfoRow label="Audit" value="Auto end and extension decisions logged" />
          </div>
          <button className="primary-button mt-5 w-full"><CheckCircle2 className="h-4 w-4" /> Approve selected extension</button>
        </div>
        <section className="panel overflow-hidden">
          <div className="border-b border-border p-5">
            <h2 className="text-lg font-bold">Shift extension register</h2>
            <p className="text-sm text-muted-foreground">Active shifts auto-complete at finish time unless approved here.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Request</th><th>Shift</th><th>Reason</th><th>Cost</th><th>Status</th><th>Approver</th></tr></thead>
              <tbody>
                {shiftExtensions.map((extension) => (
                  <tr key={extension.id}>
                    <td>{extension.id}<small>{extension.guard}</small></td>
                    <td>{extension.site}<small>{extension.shift} · extend to {extension.requestedUntil}</small></td>
                    <td>{extension.reason}</td>
                    <td>${extension.estimatedCost}</td>
                    <td><span className={cx("status-pill", extension.status === "approved" ? "status-success" : "status-warning")}>{extension.status}</span></td>
                    <td>{extension.approver}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </>;
}

function AttendanceHistory() {
  return <div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Guard</th><th>Site</th><th>Scheduled</th><th>Log-on</th><th>Log-off</th><th>Status</th></tr></thead><tbody>{guards.map((guard, i) => <tr key={guard.id}><td>{guard.name}</td><td>{guard.site}</td><td>{guard.shift}</td><td>{i === 3 ? "—" : "On time"}</td><td>{i === 3 ? "06:01" : "Active"}</td><td><span className={cx("status-pill", i === 3 ? "status-offline" : "status-success")}>{i === 3 ? "Completed" : "Active"}</span></td></tr>)}</tbody></table></div>;
}

function IncidentsPage() {
  return (
    <AdminPage>
      <div className="flex flex-wrap items-center gap-3">
        <button className="secondary-button"><Filter className="h-4 w-4" /> Site</button>
        <button className="secondary-button"><Filter className="h-4 w-4" /> Severity</button>
        <button className="secondary-button"><Filter className="h-4 w-4" /> Status</button>
        <button className="secondary-button"><Download className="h-4 w-4" /> Export CSV</button>
        <button className="secondary-button"><FileText className="h-4 w-4" /> Export PDF</button>
      </div>
      <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <IncidentTable />
        <div className="panel p-5">
          <PanelHeader title="Incident detail" description="INC-24020 · Northbank Arena" icon={ShieldAlert} />
          <div className="mt-5 space-y-4 text-sm">
            <InfoRow label="Type" value="Medical assistance" />
            <InfoRow label="Severity" value="Critical" />
            <InfoRow label="Guard" value="Aisha Khan" />
            <InfoRow label="GPS" value="51.5102, -0.0904" />
            <p className="rounded-md bg-secondary p-4 text-muted-foreground">Guest collapsed near VIP lobby. First aid team attended within 90 seconds. Area cleared and witness statements collected.</p>
            <div className="grid grid-cols-3 gap-3">
              <MediaBox label="Photo" icon={Camera} />
              <MediaBox label="Video" icon={Upload} />
              <MediaBox label="Witness" icon={Contact} />
            </div>
            <textarea className="control-input min-h-24" placeholder="Admin notes" />
            <button className="primary-button w-full"><CheckCircle2 className="h-4 w-4" /> Mark reviewed</button>
          </div>
        </div>
      </section>
    </AdminPage>
  );
}

function IncidentTable({ compact = false }: { compact?: boolean }) {
  return (
    <section className="panel overflow-hidden">
      <div className="border-b border-border p-5"><h2 className="text-lg font-bold">Incident reports</h2></div>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead><tr><th>ID</th><th>Guard</th><th>Type</th><th>Severity</th><th>Status</th>{!compact && <th>Description</th>}</tr></thead>
          <tbody>
            {incidents.map((incident) => (
              <tr key={incident.id}>
                <td>{incident.id}<small>{incident.time}</small></td>
                <td>{incident.guard}<small>{incident.site}</small></td>
                <td>{incident.type}</td>
                <td><span className={cx("status-pill", incident.severity === "critical" ? "status-danger" : incident.severity === "high" ? "status-warning" : "status-success")}>{incident.severity}</span></td>
                <td><span className="status-pill status-info">{incident.status}</span></td>
                {!compact && <td>{incident.description}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AlertsPage() {
  return <AdminPage><AlertPanel full /><AuditTrail /></AdminPage>;
}

function SitePlansPage() {
  const liveGuards = useLiveGuardPositions();
  const positionReport = initialGuardPosts.map((post) => {
    const guard = liveGuards.find((item) => item.id === post.guardId);
    const distance = guard ? distanceMeters(post, guard) : Number.POSITIVE_INFINITY;
    return { ...post, guard, distance, filled: Boolean(guard && guard.status !== "offline" && distance <= post.radiusMeters) };
  });
  const unfilled = positionReport.filter((post) => !post.filled);
  return <AdminPage><section className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]"><div className="panel p-5"><PanelHeader title="Upload planned positions" description="Import CAD, PDF, image, CSV, or XLSX plans" icon={UploadCloud} /><label className="mt-5 grid min-h-44 cursor-pointer place-items-center rounded-md border border-dashed border-border bg-secondary p-5 text-center transition hover:border-primary"><input className="sr-only" type="file" accept=".dwg,.dxf,.pdf,.png,.jpg,.jpeg,.csv,.xlsx" /><span><UploadCloud className="mx-auto mb-3 h-10 w-10 text-primary" /><span className="block font-semibold">Upload CAD or site plan</span><span className="mt-1 block text-sm text-muted-foreground">Extract planned positions into red map dots for review.</span></span></label><div className="mt-4 space-y-3 text-sm"><InfoRow label="Supported" value="DWG, DXF, PDF, image, CSV, XLSX" /><InfoRow label="Last upload" value="northbank_positions.dxf" /><InfoRow label="Extracted posts" value={`${initialGuardPosts.length} planned positions`} /></div></div><section className="panel overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5"><div><h2 className="text-lg font-bold">Unfilled planned positions</h2><p className="text-sm text-muted-foreground">Posts remain unfilled until a physical guard is inside the required radius.</p></div><span className="status-pill status-danger">{unfilled.length} unfilled</span></div><div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Position</th><th>Assigned guard</th><th>Required radius</th><th>Current distance</th><th>Status</th></tr></thead><tbody>{positionReport.map((post) => <tr key={post.id}><td>{post.label}<small>{formatCoordinate(post.lat, post.lng)}</small></td><td>{post.guard?.name ?? "Unassigned"}<small>{post.guard?.role ?? "No physical person assigned"}</small></td><td>{post.radiusMeters}m</td><td>{Number.isFinite(post.distance) ? `${Math.round(post.distance)}m` : "—"}</td><td><span className={cx("status-pill", post.filled ? "status-success" : "status-danger")}>{post.filled ? "Filled" : "Unfilled"}</span></td></tr>)}</tbody></table></div></section></section></AdminPage>;
}

function ReportsPage() {
  const baseReports: ReportType[] = [
    { title: "Attendance report", desc: "Log-on/log-off compliance by site and guard", icon: "calendar" },
    { title: "Incident report", desc: "PDF and CSV incident packs with media register", icon: "file" },
    { title: "Movement audit", desc: "Historical replay and GPS breadcrumb exports", icon: "route" },
  ];
  const reportIcons = { calendar: CalendarClock, file: FileText, route: Route };
  const [reportCards, setReportCards] = useState<ReportType[]>(() => readStored(REPORT_TYPES_KEY, baseReports).map((report) => ({ title: report.title, desc: report.desc, icon: report.icon ?? "file" })));
  const [reportName, setReportName] = useState("Scope variation cost report");
  const addReport = () => { const next = [...reportCards, { title: reportName, desc: "Custom report type available for export", icon: "file" as const }]; setReportCards(next); writeStored(REPORT_TYPES_KEY, next); };

  return (
    <AdminPage>
      <section className="panel p-5">
        <PanelHeader title="Create report type" description="Add a custom report type for operational exports" icon={FileText} />
        <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto]"><input className="control-input" value={reportName} onChange={(event) => setReportName(event.target.value)} /><button className="primary-button" onClick={addReport}><FileText className="h-4 w-4" /> Add report type</button></div>
      </section>
      <section className="grid gap-5 md:grid-cols-3">
        {reportCards.map(({ title, desc, icon }) => {
          const Icon = reportIcons[icon ?? "file"];
          return <div key={title} className="panel p-5">
            <span className="metric-icon metric-info"><Icon className="h-5 w-5" /></span>
            <h2 className="mt-5 text-xl font-bold">{title}</h2>
            <p className="mt-2 min-h-12 text-sm text-muted-foreground">{desc}</p>
            <button className="primary-button mt-5 w-full"><Download className="h-4 w-4" /> Generate</button>
          </div>;
        })}
      </section>
    </AdminPage>
  );
}

function ScopeChangesPage() {
  return <AdminPage><ScopeChangesContent /></AdminPage>;
}

function ScopeChangesContent() {
  const pending = scopeChanges.filter((scope) => scope.status === "pending_leadership_signoff");
  const approved = scopeChanges.filter((scope) => scope.status === "approved");
  return (
    <>
      <section className="grid gap-4 md:grid-cols-3">
        <div className="panel p-5"><p className="text-sm text-muted-foreground">Additional scope items</p><p className="mt-2 text-3xl font-bold">{scopeChanges.length}</p></div>
        <div className="panel p-5"><p className="text-sm text-muted-foreground">Pending senior sign-off</p><p className="mt-2 text-3xl font-bold text-warning">{pending.length}</p></div>
        <div className="panel p-5"><p className="text-sm text-muted-foreground">Approved added cost</p><p className="mt-2 text-3xl font-bold">${approved.reduce((sum, scope) => sum + scope.totalCost, 0).toLocaleString()}</p></div>
      </section>
      <section className="grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
        <div className="panel p-5">
          <PanelHeader title="Add event scope" description="Capture extra work, resources, commercial impact and sign-off requirement" icon={FileSignature} />
          <div className="mt-5 grid gap-3">
            <div className="form-field">Title · Additional search lane</div>
            <div className="form-field">Site · Northbank Arena</div>
            <div className="form-field">Required window · 20:30–23:30</div>
            <textarea className="control-input min-h-24" defaultValue="Scope detail: add guards and supervisor to open a new screening lane at VIP Lobby." />
            <textarea className="control-input min-h-24" defaultValue="Reason: queue build-up exceeded threshold and impacted emergency route." />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="form-field">Additional guards · 2</div>
              <div className="form-field">Supervisors · 1</div>
            </div>
            <div className="form-field">Cost breakdown · Guards $192, Supervisor $135, Equipment $85</div>
            <div className="form-field">Total cost · $412 AUD</div>
            <button className="primary-button h-12"><FileSignature className="h-4 w-4" /> Submit for senior sign-off</button>
          </div>
        </div>
        <section className="panel overflow-hidden">
          <div className="border-b border-border p-5">
            <h2 className="text-lg font-bold">Scope and cost sign-off register</h2>
            <p className="text-sm text-muted-foreground">Formal record of added event scope requiring senior leadership approval.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Scope</th><th>Reason</th><th>Cost</th><th>Status</th><th>Senior sign-off</th></tr></thead>
              <tbody>
                {scopeChanges.map((scope) => (
                  <tr key={scope.id}>
                    <td>{scope.id} · {scope.title}<small>{scope.site} · {scope.requiredWindow}</small></td>
                    <td>{scope.operationalReason}<small>{scope.resources}</small></td>
                    <td>${scope.totalCost.toLocaleString()}<small>{scope.costItems.map((item) => `${item[0]} ${item[2]}`).join(" · ")}</small></td>
                    <td><span className={cx("status-pill", scope.status === "approved" ? "status-success" : "status-warning")}>{scope.status.split("_").join(" ")}</span></td>
                    <td>{scope.leader}<small>{scope.role} · {scope.signedAt}</small></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>
      <section className="panel p-5">
        <PanelHeader title="Formal sign-off detail" description="Senior leadership approval creates the audit-ready cost record" icon={BadgeCheck} />
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {scopeChanges.map((scope) => (
            <div key={scope.id} className="rounded-md border border-border bg-secondary p-4">
              <div className="flex items-start justify-between gap-3">
                <div><h3 className="font-bold">{scope.title}</h3><p className="mt-1 text-sm text-muted-foreground">{scope.scopeDetail}</p></div>
                <span className={cx("status-pill", scope.status === "approved" ? "status-success" : "status-warning")}>{scope.status === "approved" ? "Signed" : "Pending"}</span>
              </div>
              <div className="mt-4 space-y-2 text-sm">
                <InfoRow label="Leader" value={scope.leader} />
                <InfoRow label="Role" value={scope.role} />
                <InfoRow label="Signed at" value={scope.signedAt} />
                <InfoRow label="Cost" value={`$${scope.totalCost.toLocaleString()} AUD`} />
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function AdminUsersPage() {
  const defaultRoles = ["Super Admin", "Operations Manager", "Site Supervisor", "Security Guard"];
  const [roles, setRoles] = useState<string[]>(() => readStored(ROLE_PERMISSIONS_KEY, defaultRoles));
  const [users, setUsers] = useState<AdminUser[]>(() => readStored(ADMIN_USERS_KEY, [{ name: "Rebecca Lane", email: "rebecca.lane@outtheregroup.test", role: "Super Admin", status: "Active" }]));
  const [newRole, setNewRole] = useState("Event Controller");
  const [newUser, setNewUser] = useState("Alex Morgan");
  const [newEmail, setNewEmail] = useState("alex.morgan@outtheregroup.test");
  const [inviteNotice, setInviteNotice] = useState("");
  const addRole = () => { const next = Array.from(new Set([...roles, newRole])); setRoles(next); writeStored(ROLE_PERMISSIONS_KEY, next); };
  const addUser = () => { const parsed = inviteSchema.safeParse({ name: newUser, email: newEmail }); if (!parsed.success) { setInviteNotice("Enter a valid name and email address."); return; } const accessLink = `${window.location.origin}/admin`; const next = [...users, { name: parsed.data.name, email: parsed.data.email, role: roles[0] ?? "Security Guard", status: "Invitation email ready" }]; setUsers(next); writeStored(ADMIN_USERS_KEY, next); window.location.href = `mailto:${encodeURIComponent(parsed.data.email)}?subject=${encodeURIComponent("Out There Group site access")}&body=${encodeURIComponent(`Hi ${parsed.data.name},\n\nYou have been added to Out There Group. Use this link to access the site:\n${accessLink}\n\nRole: ${roles[0] ?? "Security Guard"}`)}`; setInviteNotice(`Invitation prepared for ${parsed.data.email}. Email sending will be automatic after a sender domain is configured.`); };
  const updateUserRole = (email: string, role: string) => { const next = users.map((user) => user.email === email ? { ...user, role } : user); setUsers(next); writeStored(ADMIN_USERS_KEY, next); };
  return <AdminPage><section className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]"><div className="panel p-5"><PanelHeader title="Roles and permissions" description="Super Admin controls role access" icon={Fingerprint} /><div className="mt-5 grid gap-3"><input className="control-input" value={newRole} onChange={(event) => setNewRole(event.target.value)} /><button className="primary-button" onClick={addRole}><UserCog className="h-4 w-4" /> Add role</button>{roles.map((role) => <div key={role} className="form-field"><div className="flex items-center justify-between"><span>{role}</span><BadgeCheck className="h-4 w-4 text-success" /></div><div className="mt-3 grid gap-2 sm:grid-cols-2 text-sm text-muted-foreground"><label><input type="checkbox" defaultChecked /> View roster</label><label><input type="checkbox" defaultChecked={role !== "Security Guard"} /> Approve costs</label><label><input type="checkbox" defaultChecked={role === "Super Admin"} /> Manage users</label><label><input type="checkbox" defaultChecked /> View reports</label></div></div>)}</div></div><section className="panel overflow-hidden"><div className="border-b border-border p-5"><PanelHeader title="Admin users" description="Add users and send them an access link" icon={Users} /></div><div className="p-5"><div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]"><input className="control-input" value={newUser} onChange={(event) => setNewUser(event.target.value)} /><input className="control-input" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} /><button className="primary-button" onClick={addUser}><UserCheck className="h-4 w-4" /> Add & invite</button></div>{inviteNotice && <p className="mt-3 rounded-md bg-secondary p-3 text-sm text-muted-foreground">{inviteNotice}</p>}</div><div className="overflow-x-auto"><table className="data-table"><thead><tr><th>User</th><th>Status</th><th>Role permission</th></tr></thead><tbody>{users.map((user) => <tr key={user.email}><td>{user.name}<small>{user.email}</small></td><td><span className="status-pill status-success">{user.status}</span></td><td><select className="control-input" value={user.role} onChange={(event) => updateUserRole(user.email, event.target.value)}>{roles.map((role) => <option key={role} value={role}>{role}</option>)}</select></td></tr>)}</tbody></table></div></section></section></AdminPage>;
}

function SettingsPage() {
  return (
    <AdminPage>
      <section className="grid gap-5 lg:grid-cols-2">
        <div className="panel p-5">
          <PanelHeader title="Role permissions" description="Separate operational access by role" icon={Fingerprint} />
          <div className="mt-5 space-y-3">
            {["Super Admin", "Operations Manager", "Site Supervisor", "Security Guard"].map((role) => <div key={role} className="form-field flex items-center justify-between"><span>{role}</span><BadgeCheck className="h-4 w-4 text-success" /></div>)}
          </div>
        </div>
        <div className="panel p-5">
          <PanelHeader title="Tracking settings" description="Consent, interval and exception thresholds" icon={Settings} />
          <div className="mt-5 space-y-3">
            <InfoRow label="Location consent" value="Required before shift" />
            <InfoRow label="Tracking interval" value="30 seconds" />
            <InfoRow label="Lost signal alert" value="After 3 minutes" />
            <InfoRow label="Geo-fence tolerance" value="25 metres" />
          </div>
        </div>
      </section>
    </AdminPage>
  );
}

function AlertPanel({ full = false }: { full?: boolean }) {
  return (
    <section className="panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-border p-5">
        <div><h2 className="text-lg font-bold">Alerts</h2><p className="text-sm text-muted-foreground">Operational exceptions requiring attention</p></div>
        <span className="status-pill status-danger">3 critical</span>
      </div>
      <div className={cx("divide-y divide-border", full && "grid lg:grid-cols-2 lg:divide-x lg:divide-y-0")}> 
        {alerts.map((alert) => (
          <div key={`${alert.type}-${alert.guard}`} className="p-5">
            <div className="flex items-start gap-3">
              <span className={cx("mt-1 h-2.5 w-2.5 rounded-full", alert.severity === "critical" ? "bg-danger" : "bg-warning")} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">{alert.type}</h3><span className="text-xs text-muted-foreground">{alert.time}</span></div>
                <p className="mt-1 text-sm text-muted-foreground">{alert.guard} · {alert.message}</p>
                <button className="table-action mt-3">Acknowledge</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function AuditTrail() {
  return (
    <section className="panel overflow-hidden">
      <div className="border-b border-border p-5"><h2 className="text-lg font-bold">Audit trail</h2><p className="text-sm text-muted-foreground">Timestamped operational log</p></div>
      <div className="divide-y divide-border">
        {audit.map(([time, event, actor, details]) => (
          <div key={`${time}-${event}`} className="flex gap-4 p-4">
            <span className="text-sm font-semibold text-primary">{time}</span>
            <div><p className="font-semibold">{event}</p><p className="text-sm text-muted-foreground">{actor} · {details}</p></div>
          </div>
        ))}
      </div>
    </section>
  );
}

function MobilePortal({ session }: { session: Session | null }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [tracking, setTracking] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [coords, setCoords] = useState({ lat: 51.5078, lng: -0.0844, accuracy: 8, status: "in_zone", source: "Simulated GPS" });
  const activeIndex = Math.max(0, guardSteps.findIndex((step) => step.path === pathname));

  useEffect(() => {
    if (!tracking) return;

    const publishPosition = (position: { lat: number; lng: number; accuracy: number; status: string; source: string }) => {
      const payload = { ...position, updatedAt: Date.now() };
      window.localStorage.setItem(LIVE_POSITION_KEY, JSON.stringify(payload));
      window.dispatchEvent(new CustomEvent("sentinel-position"));
    };

    let watchId: number | null = null;
    let timer: number | null = null;

    if ("geolocation" in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const nextPosition = {
            lat: Number(position.coords.latitude.toFixed(6)),
            lng: Number(position.coords.longitude.toFixed(6)),
            accuracy: Math.round(position.coords.accuracy),
            status: position.coords.accuracy > 50 ? "moving" : "in_zone",
            source: "Device GPS",
          };
          setCoords(nextPosition);
          publishPosition(nextPosition);
        },
        () => {
          timer = window.setInterval(() => {
            setCoords((current) => {
              const drift = Math.random() > 0.78;
              const nextPosition = {
                lat: Number((current.lat + (Math.random() - 0.5) * 0.0006).toFixed(6)),
                lng: Number((current.lng + (Math.random() - 0.5) * 0.0006).toFixed(6)),
                accuracy: 10 + Math.round(Math.random() * 16),
                status: drift ? "moving" : Math.random() > 0.92 ? "alert" : "in_zone",
                source: "Simulated GPS",
              };
              publishPosition(nextPosition);
              return nextPosition;
            });
          }, 1800);
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
      );
    } else {
      timer = window.setInterval(() => {
        setCoords((current) => {
          const nextPosition = {
            lat: Number((current.lat + (Math.random() - 0.5) * 0.0006).toFixed(6)),
            lng: Number((current.lng + (Math.random() - 0.5) * 0.0006).toFixed(6)),
            accuracy: 12,
            status: "moving",
            source: "Simulated GPS",
          };
          publishPosition(nextPosition);
          return nextPosition;
        });
      }, 1800);
    }

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      if (timer !== null) window.clearInterval(timer);
    };
  }, [tracking]);

  const next = () => navigate(guardSteps[Math.min(activeIndex + 1, guardSteps.length - 1)].path);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[520px] flex-col bg-background shadow-2xl ring-1 ring-border">
      <header className="sticky top-0 z-20 border-b border-border bg-background/92 p-4 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <Link to="/admin" className="icon-button" aria-label="Open admin"><Shield className="h-5 w-5" /></Link>
          <div className="text-center"><p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Guard Portal</p><h1 className="text-lg font-bold">{pathTitles[pathname] ?? "Mobile"}</h1></div>
          <span className="grid h-10 w-10 place-items-center rounded-md bg-secondary text-sm font-bold">{session?.user.email?.slice(0, 2).toUpperCase() ?? "QR"}</span>
        </div>

      </header>
      <main className="flex-1 p-4">
        {pathname === "/mobile/profile" && <ProfileSetup session={session} onNext={() => navigate("/mobile")} />}
        {pathname === "/mobile/login" && <GuardLogin onNext={() => navigate("/mobile")} />}
        {pathname === "/mobile/onboarding" && <QrOnboarding onNext={() => navigate("/mobile/profile" + window.location.search)} />}
        {!["/mobile/profile", "/mobile/login", "/mobile/onboarding"].includes(pathname) && <GuardPortal session={session} />}
      </main>
    </div>
  );
}

function QrOnboarding({ onNext }: { onNext: () => void }) {
  return (
    <MobileCard icon={QrCode} title="Guard QR scan verified" subtitle={"\n" + " · Self-service security guard registration"}>
      <div className="grid place-items-center rounded-md border border-primary/40 bg-primary/10 p-8"><QrCode className="h-28 w-28 text-primary" /></div>
      <div className="space-y-3 rounded-md bg-secondary p-4 text-sm">
        <InfoRow label="Access" value="No admin invite required" />
        <InfoRow label="Role" value="Security Guard" />
        <InfoRow label="Next" value="Create profile and verify email" />
      </div>
      <button className="primary-button h-14 w-full text-base" onClick={onNext}>Create guard profile <ChevronRight className="h-5 w-5" /></button>
    </MobileCard>
  );
}

function ProfileSetup({ session, onNext }: { session: Session | null; onNext: () => void }) {
  // A sign-up poster made for one provider adds ?provider=<id>, which preselects it here.
  const [form, setForm] = useState({ fullName: "", phone: "", email: session?.user.email ?? "", employeeId: "", licenceNumber: "", emergencyContact: "", password: "", contractorId: new URLSearchParams(window.location.search).get("provider") ?? "" });
  const providers = useSignupProviders();
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const saveProfile = async () => {
    setMessage("");
    const parsed = guardProfileSchema.safeParse(form);
    if (!parsed.success) {
      setMessage(Object.values(parsed.error.flatten().fieldErrors).flat()[0] ?? "Check your details.");
      return;
    }
    setSubmitting(true);
    let activeSession = session;
    if (!activeSession) {
      const { data, error } = await supabase.auth.signUp({ email: parsed.data.email, password: parsed.data.password, options: { emailRedirectTo: window.location.origin + "/mobile/login" } });
      if (error) { setMessage(error.message); setSubmitting(false); return; }
      activeSession = data.session;
    }
    const userId = activeSession?.user.id;
    if (!userId) { setMessage("Check your email to verify your account, then log in to finish your profile."); setSubmitting(false); return; }
    const profile = { user_id: userId, full_name: parsed.data.fullName, phone: parsed.data.phone, email: parsed.data.email };
    const guard = { user_id: userId, name: parsed.data.fullName, phone: parsed.data.phone, email: parsed.data.email, employee_id: parsed.data.employeeId, licence_number: parsed.data.licenceNumber, emergency_contact: parsed.data.emergencyContact, contractor_id: parsed.data.contractorId, status: "active" as const };
    const [{ error: profileError }, { error: guardError }, { error: roleError }] = await Promise.all([
      supabase.from("profiles").upsert(profile, { onConflict: "user_id" }),
      supabase.from("guards").upsert(guard, { onConflict: "user_id" }),
      supabase.from("user_roles").upsert({ user_id: userId, role: "security_guard" }, { onConflict: "user_id,role" }),
    ]);
    setSubmitting(false);
    if (profileError || guardError || roleError) setMessage(profileError?.message ?? guardError?.message ?? roleError?.message ?? "Could not save profile.");
    else onNext();
  };
  return (
    <MobileCard icon={IdCard} title="Complete profile" subtitle="Your QR scan creates a Security Guard profile without an admin invite.">
      <label className="block space-y-1 text-sm">
        <span className="font-semibold">Security provider you work for</span>
        <select className="control-input h-12 w-full" aria-label="Security provider" value={form.contractorId} onChange={(event) => update("contractorId", event.target.value)}>
          <option value="">Choose your provider…</option>
          {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      <input className="control-input h-12" placeholder="Full name" value={form.fullName} onChange={(event) => update("fullName", event.target.value)} />
      <input className="control-input h-12" placeholder="Phone" value={form.phone} onChange={(event) => update("phone", event.target.value)} />
      <input className="control-input h-12" placeholder="Email" value={form.email} onChange={(event) => update("email", event.target.value)} />
      <input className="control-input h-12" placeholder="Employee ID" value={form.employeeId} onChange={(event) => update("employeeId", event.target.value)} />
      <input className="control-input h-12" placeholder="Licence number" value={form.licenceNumber} onChange={(event) => update("licenceNumber", event.target.value)} />
      <input className="control-input h-12" placeholder="Emergency contact" value={form.emergencyContact} onChange={(event) => update("emergencyContact", event.target.value)} />
      <input className="control-input h-12" placeholder="Password" type="password" value={form.password} onChange={(event) => update("password", event.target.value)} />
      <button className="secondary-button h-12 w-full"><Camera className="h-4 w-4" /> Upload profile photo</button>
      <button className="primary-button h-14 w-full text-base" disabled={submitting} onClick={saveProfile}>Save profile <CheckCircle2 className="h-5 w-5" /></button>
      <p className="text-center text-xs text-muted-foreground">By saving you agree to our <a href="/privacy" target="_blank" rel="noreferrer" className="text-primary underline">privacy policy</a>.</p>
      {message && <p className="rounded-md bg-secondary p-3 text-sm text-muted-foreground">{message}</p>}
    </MobileCard>
  );
}

function GuardLogin({ onNext }: { onNext: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const login = async () => {
    setMessage("");
    const parsed = authSchema.safeParse({ email, password });
    if (!parsed.success) {
      setMessage(Object.values(parsed.error.flatten().fieldErrors).flat()[0] ?? "Check your details.");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data as { email: string; password: string });
    setSubmitting(false);
    if (error) setMessage(error.message);
    else onNext();
  };
  return (
    <MobileCard icon={Lock} title="Secure guard login" subtitle="Use email and password/PIN to access assigned shifts.">
      <input className="control-input h-14" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
      <input className="control-input h-14" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} type="password" />
      <button className="primary-button h-14 w-full text-base" disabled={submitting} onClick={login}>Log in <ArrowRight className="h-5 w-5" /></button>
      <p className="text-center text-sm text-muted-foreground">Role detected: Security Guard</p>
      {message && <p className="rounded-md bg-secondary p-3 text-sm text-muted-foreground">{message}</p>}
    </MobileCard>
  );
}

function StartShift({ onStart }: { onStart: () => void }) {
  const [consent, setConsent] = useState(false);
  const rosterShift = useSecurityRoster().find((row) => row.guardId === "g-101") ?? defaultRosterRows[0];
  return (
    <MobileCard icon={Smartphone} title="Ready for shift" subtitle="Your scan-in is linked to the approved security roster.">
      <div className="rounded-md border border-border bg-card p-4">
        <InfoRow label="Guard" value={rosterShift.guardName} />
        <InfoRow label="Site" value={rosterShift.site} />
        <InfoRow label="Role" value={rosterShift.role} />
        <InfoRow label="Time" value={`${rosterShift.start}–${rosterShift.finish}`} />
        <InfoRow label="Location" value={rosterShift.location} />
        <InfoRow label="Roster cost" value={`$${Number(rosterShift.cost || 0).toLocaleString()} AUD`} />
        <InfoRow label="Geo-fence" value={consent ? `Approved · ${rosterShift.location}` : "Awaiting consent"} />
      </div>
      <button className="secondary-button h-14 w-full" onClick={() => setConsent(true)}><MapPin className="h-5 w-5" /> {consent ? "Location confirmed" : "Allow location permission"}</button>
      <button className="primary-button h-16 w-full text-lg" disabled={!consent} onClick={onStart}>Start Shift <Clock className="h-5 w-5" /></button>
    </MobileCard>
  );
}

function Briefing({ acknowledged, onAck, onNext }: { acknowledged: boolean; onAck: () => void; onNext: () => void }) {
  const rosterShift = useSecurityRoster().find((row) => row.guardId === "g-101") ?? defaultRosterRows[0];
  return (
    <MobileCard icon={ClipboardCheck} title="Shift briefing" subtitle="Acknowledge instructions before beginning operational duty.">
      <div className="space-y-3 rounded-md border border-border bg-card p-4 text-sm">
        <InfoRow label="Role" value={rosterShift.role} />
        <InfoRow label="Rostered time" value={`${rosterShift.start}–${rosterShift.finish}`} />
        <InfoRow label="Location" value={rosterShift.location} />
        <InfoRow label="Supervisor" value="Carla Reed · +44 20 7946 0941" />
        <InfoRow label="Instructions" value="Verify manifests, challenge unknown vehicles, keep emergency route clear." />
        <InfoRow label="Emergency" value="Call CONTROL ROOM, then 999 for immediate threat or injury." />
        <InfoRow label="Notes" value="High delivery traffic expected 20:00–22:00." />
      </div>
      <button className="secondary-button h-14 w-full" onClick={onAck}><CheckCircle2 className="h-5 w-5" /> {acknowledged ? "Briefing acknowledged" : "Acknowledge briefing"}</button>
      <button className="primary-button h-14 w-full text-base" disabled={!acknowledged} onClick={onNext}>Begin active shift <Radio className="h-5 w-5" /></button>
    </MobileCard>
  );
}

function ActiveShift({ coords, tracking, onIncident, onEnd }: { coords: { lat: number; lng: number; accuracy: number; status: string; source: string }; tracking: boolean; onIncident: () => void; onEnd: () => void }) {
  const meta = statusMeta[coords.status as keyof typeof statusMeta] ?? statusMeta.in_zone;
  const contactRequests = useGuardContactRequests().filter((request) => request.guardId === "g-101");
  const pendingRequest = contactRequests.find((request) => request.status === "awaiting_photo");
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [responseNotes, setResponseNotes] = useState("Position clear. Photos attached for CONTROL ROOM review.");

  const submitPhotoResponse = () => {
    if (!pendingRequest || selectedPhotos.length === 0) return;
    const updated = readGuardContactRequests().map((request) =>
      request.id === pendingRequest.id
        ? { ...request, status: "photos_received" as const, photoCount: selectedPhotos.length, photoNames: selectedPhotos, notes: responseNotes }
        : request
    );
    writeGuardContactRequests(updated);
    setSelectedPhotos([]);
  };

  return (
    <MobileCard icon={Radio} title="Active shift" subtitle="Live tracking runs only while your shift is active.">
      <div className="rounded-md border border-border bg-card p-5 text-center">
        <span className={cx("status-pill mx-auto", meta.className)}>{meta.label}</span>
        <p className="mt-5 text-3xl font-bold">{tracking ? "Tracking live" : "Tracking stopped"}</p>
        <p className="mt-2 text-sm text-muted-foreground">{formatCoordinate(coords.lat, coords.lng)}</p>
        <p className="mt-1 text-xs text-muted-foreground">Last update: just now · Accuracy {coords.accuracy}m · {coords.source}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button className="secondary-button h-14" onClick={onIncident}><AlertTriangle className="h-5 w-5" /> Incident</button>
        <button className="secondary-button h-14" onClick={onEnd}><LogOut className="h-5 w-5" /> End shift</button>
      </div>
      {pendingRequest && (
        <div className="rounded-md border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <span className="metric-icon metric-warning"><Camera className="h-5 w-5" /></span>
            <div>
              <h3 className="font-bold">Photo response requested</h3>
              <p className="text-sm text-muted-foreground">{pendingRequest.message}</p>
            </div>
          </div>
          <textarea className="control-input mt-4 min-h-20" value={responseNotes} onChange={(event) => setResponseNotes(event.target.value)} />
          <label className="secondary-button mt-3 h-14 w-full cursor-pointer">
            <Camera className="h-5 w-5" /> Attach photos
            <input className="sr-only" type="file" accept="image/*" multiple onChange={(event) => setSelectedPhotos(Array.from(event.target.files ?? []).map((file) => file.name))} />
          </label>
          {selectedPhotos.length > 0 && <p className="mt-3 rounded-md bg-secondary p-3 text-sm text-muted-foreground">{selectedPhotos.length} photo{selectedPhotos.length === 1 ? "" : "s"} ready · {selectedPhotos.join(", ")}</p>}
          <button className="primary-button mt-3 h-14 w-full" disabled={selectedPhotos.length === 0} onClick={submitPhotoResponse}>Send photo response <Upload className="h-5 w-5" /></button>
        </div>
      )}
    </MobileCard>
  );
}

function IncidentForm({ onNext }: { onNext: () => void }) {
  return (
    <MobileCard icon={ShieldAlert} title="Log incident" subtitle="Drafts can be saved before submission to CONTROL ROOM.">
      {[
        "Incident type · Unauthorised access attempt",
        "Severity · High",
        "Date/time · Auto captured",
        "GPS · 51.5078, -0.0844",
        "Persons involved · Vehicle driver, gate officer",
        "Action taken · Entry denied, supervisor notified",
      ].map((field) => <div key={field} className="form-field">{field}</div>)}
      <textarea className="control-input min-h-28" defaultValue="Vehicle attempted entry without a valid consignment record. Registration recorded and supervisor notified." />
      <div className="grid grid-cols-2 gap-3"><button className="secondary-button h-12"><Camera className="h-4 w-4" /> Photos</button><button className="secondary-button h-12"><Upload className="h-4 w-4" /> Videos</button></div>
      <button className="primary-button h-14 w-full text-base" onClick={onNext}>Submit incident <ShieldAlert className="h-5 w-5" /></button>
    </MobileCard>
  );
}

function EndShift({ coords, onEnd }: { coords: { lat: number; lng: number }; onEnd: () => void }) {
  const [ended, setEnded] = useState(false);
  return (
    <MobileCard icon={LogOut} title="End shift" subtitle="Confirm check-out to stop location tracking.">
      <div className="rounded-md border border-border bg-card p-4">
        <InfoRow label="Log-off time" value={ended ? "Captured · 20:12" : "Pending confirmation"} />
        <InfoRow label="Log-off location" value={formatCoordinate(coords.lat, coords.lng)} />
        <InfoRow label="Tracking" value={ended ? "Stopped" : "Active until checkout"} />
      </div>
      <textarea className="control-input min-h-24" placeholder="Optional end-of-shift notes" />
      <button className="primary-button h-14 w-full text-base" onClick={() => { setEnded(true); onEnd(); window.localStorage.removeItem(LIVE_POSITION_KEY); window.dispatchEvent(new CustomEvent("sentinel-position")); }}>Confirm check-out <CheckCircle2 className="h-5 w-5" /></button>
      {ended && <p className="rounded-md bg-success/10 p-3 text-center text-sm text-success">Shift completed and tracking stopped.</p>}
    </MobileCard>
  );
}

function ProfileCard() {
  return (
    <div className="panel p-5">
      <PanelHeader title="Licence profile" description="Maya Collins · SG-1048" icon={IdCard} />
      <div className="mt-5 space-y-3 text-sm">
        <InfoRow label="Phone" value="+44 7700 900128" />
        <InfoRow label="Email" value="maya.collins@sentinel.test" />
        <InfoRow label="Licence" value="SIA-7842-9921" />
        <InfoRow label="Emergency" value="Liam Collins" />
        <InfoRow label="Status" value="Active" />
      </div>
    </div>
  );
}

function AdminPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-5 px-4 py-5 sm:px-6 lg:px-8">
      {Children.map(children, (child, index) => {
        if (!isValidElement(child) || child.type === CollapsibleSection) return child;
        return <PageSectionShell index={index}>{child}</PageSectionShell>;
      })}
    </div>
  );
}

function PageSectionShell({ index, children }: { index: number; children: React.ReactNode }) {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(true);
  const title = `${pathTitles[pathname] ?? "Page"} section ${index + 1}`;
  return (
    <section className="space-y-3">
      <button className="flex w-full items-center justify-between gap-3 rounded-md border border-border bg-card px-4 py-3 text-left shadow-sm" onClick={() => setOpen((current) => !current)}>
        <span className="font-semibold">{title}</span>
        {open ? <ChevronDown className="h-5 w-5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
      </button>
      {open && children}
    </section>
  );
}

function CollapsibleSection({ title, description, icon: Icon, children }: { title: string; description: string; icon: React.ElementType; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <section className="panel overflow-hidden">
      <button className="flex w-full items-center justify-between gap-3 border-b border-border p-5 text-left" onClick={() => setOpen((current) => !current)}>
        <span className="flex items-start gap-3"><span className="metric-icon metric-info"><Icon className="h-5 w-5" /></span><span><span className="block text-lg font-bold">{title}</span><span className="text-sm text-muted-foreground">{description}</span></span></span>
        {open ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
      </button>
      {open && <div className="p-5">{children}</div>}
    </section>
  );
}

function MobileCard({ icon: Icon, title, subtitle, children }: { icon: React.ElementType; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="panel p-5">
        <span className="metric-icon metric-info"><Icon className="h-5 w-5" /></span>
        <h2 className="mt-5 text-2xl font-bold">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function PanelHeader({ title, description, icon: Icon }: { title: string; description: string; icon: React.ElementType }) {
  return <div className="flex items-start gap-3"><span className="metric-icon metric-info"><Icon className="h-5 w-5" /></span><div><h2 className="text-lg font-bold">{title}</h2><p className="text-sm text-muted-foreground">{description}</p></div></div>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-4 border-b border-border/60 py-2 last:border-0"><span className="text-muted-foreground">{label}</span><span className="max-w-[62%] text-right font-semibold">{value}</span></div>;
}

function Legend({ color, label }: { color: string; label: string }) {
  const colorClass = { success: "bg-success", warning: "bg-warning", danger: "bg-danger", offline: "bg-offline" }[color] ?? "bg-info";
  return <span className="flex items-center gap-1.5 rounded-md bg-secondary px-2.5 py-1"><span className={cx("h-2 w-2 rounded-full", colorClass)} /> {label}</span>;
}

function MediaBox({ label, icon: Icon }: { label: string; icon: React.ElementType }) {
  return <div className="grid aspect-square place-items-center rounded-md border border-dashed border-border bg-secondary text-center text-xs text-muted-foreground"><Icon className="mb-1 h-5 w-5" />{label}</div>;
}

export default AppShell;
