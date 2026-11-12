# OTG Security Management

> **Setting up or running this copy?** See [SETUP.md](SETUP.md). Below is the original product brief.

Create a full-stack security company management system for managing security guards, shifts, live location tracking, incidents, and site operations.

The system should have two main interfaces:

1. Mobile Guard Portal

2. Admin / Control Room Dashboard

Core concept:

Each security guard must create a unique profile by scanning a QR code. Once registered, the guard uses their mobile device to log in to assigned shifts, receive their shift briefing, confirm their role and location, and be tracked live throughout the shift.

Mobile Guard Portal requirements:

- QR code onboarding:

  - Each guard scans a unique QR code to create their profile.

  - Profile fields should include name, phone, email, employee ID, licence number, emergency contact, photo, and password/PIN.

  - QR code should link the guard to the correct company, site, or event.

- Shift log in:

  - Guards log in from their mobile device at the start of their shift.

  - Capture exact log-on time.

  - Request location permission before allowing shift start.

  - Confirm the guard is within the approved geo-fenced area before allowing log in.

  - Show a clear “Start Shift” button.

- Shift briefing:

  - After logging in, show the guard:

    - Assigned role

    - Site name

    - Exact location or zone

    - Shift start and finish time

    - Supervisor contact

    - Key instructions

    - Emergency procedures

    - Notes or special requirements

  - Require the guard to acknowledge the briefing before beginning the shift.

- Live geo tracking:

  - Track the guard’s mobile phone location during the active shift.

  - Record GPS coordinates at regular intervals.

  - Show whether the guard is at their allocated location, outside the zone, or moving.

  - Send alerts if the guard leaves their assigned geo-fenced area.

  - Stop tracking automatically when the guard logs off.

- Shift log off:

  - Guards can end their shift from their phone.

  - Capture exact log-off time and location.

  - Require a final check-out confirmation.

  - Optional end-of-shift notes.

- Incident reporting:

  - Guards can log incidents from their mobile device.

  - Incident fields:

    - Incident type

    - Severity

    - Date and time

    - GPS location

    - Description

    - Persons involved

    - Action taken

    - Photos

    - Videos

    - Witness notes

  - Incidents should be stored in the backend and linked to the guard, shift, site, and location.

  - Allow incidents to be marked as draft, submitted, reviewed, or closed.

Admin / Control Room Dashboard requirements:

- Master site map:

  - Display a live map showing all active security personnel.

  - Each guard should appear as a marker on the map.

  - Marker colours should indicate status:

    - Green: on shift and in assigned zone

    - Orange: moving or away from post

    - Red: outside geo-fence or alert

    - Grey: offline or logged off

  - Clicking a guard marker should show:

    - Name

    - Photo

    - Role

    - Site

    - Shift time

    - Current location

    - Last update time

    - Incident count

    - Contact button

- Guard management:

  - Create, edit, suspend, and view guards.

  - Generate unique QR codes for guard onboarding.

  - View guard profile, licence details, and shift history.

- Shift management:

  - Create and assign shifts.

  - Assign guards to roles, zones, and locations.

  - Add shift briefings.

  - Set geo-fenced zones on a map.

  - View log-on and log-off times.

  - View attendance history.

- Tracking and audit trail:

  - Store historical movement data for each guard during each shift.

  - Allow admins to replay a guard’s movement path on the map.

  - Keep timestamped logs of:

    - Shift start

    - Shift end

    - Location updates

    - Geo-fence breaches

    - Incidents

    - Admin changes

- Incident backend:

  - View all incident reports in a searchable table.

  - Filter by site, guard, incident type, severity, date, and status.

  - Open incident detail pages with photos and videos.

  - Add admin notes.

  - Change incident status.

  - Export incident reports as PDF or CSV.

- Alerts:

  - Alert admins when:

    - Guard fails to log in on time

    - Guard leaves their assigned zone

    - Guard stops sharing location

    - Guard submits a high-severity incident

    - Guard fails to log off

  - Show alerts in a dashboard notification panel.

Recommended pages:

Mobile:

- QR onboarding page

- Guard profile setup page

- Guard login page

- Start shift page

- Shift briefing page

- Active shift page

- Incident report page

- End shift page

Admin:

- Dashboard overview

- Live master site map

- Guards

- Sites

- Shifts

- Incidents

- Alerts

- Reports

- Settings

Data models:

Guard:

- id

- name

- phone

- email

- employee_id

- licence_number

- profile_photo

- emergency_contact

- status

- created_at

Site:

- id

- name

- address

- geo_fence_coordinates

- map_reference

- supervisor_name

- supervisor_phone

Shift:

- id

- guard_id

- site_id

- role

- zone

- start_time

- end_time

- briefing

- status

- logged_on_at

- logged_off_at

- log_on_location

- log_off_location

LocationUpdate:

- id

- guard_id

- shift_id

- latitude

- longitude

- timestamp

- accuracy

- status

Incident:

- id

- guard_id

- shift_id

- site_id

- incident_type

- severity

- description

- action_taken

- latitude

- longitude

- media_files

- status

- created_at

Alert:

- id

- guard_id

- shift_id

- alert_type

- message

- severity

- status

- created_at

User roles:

- Super Admin

- Operations Manager

- Site Supervisor

- Security Guard

Important requirements:

- Mobile-first design for guards.

- Clean professional dashboard for admins.

- Real-time updates for the map and alerts.

- Secure authentication.

- Role-based permissions.

- Location tracking must only run during an active shift.

- Ask for user consent before location tracking begins.

- Store a full audit trail.

- Make the UI modern, simple, and suitable for a professional security company.

Design style:

Use a dark navy, charcoal, white, and safety yellow colour palette. The interface should feel professional, operational, and control-room ready. Use clean cards, clear status indicators, map-first layouts, and large mobile buttons for guards in the field.

Build this as a working prototype with sample data, realistic screens, navigation, forms, tables, map placeholders, QR onboarding flow, incident upload UI, and live tracking simulation.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://watchpost-roster-command.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/25f2a753-d099-4257-a083-69068bdc2f0b).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
