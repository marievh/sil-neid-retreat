# NEID Global Retreat: agenda site (version 2)

A mobile-friendly agenda for attendees of the NEID Global Retreat (October 19–21, 2026).
Attendees find themselves by name and see their breakout groups and Funding Spotlights
highlighted in gold, right inside the agenda. The planning team (admins) assign people to
breakout groups and can see bios and interview details.

- **Site:** https://neid.solutionsinsightslab.org
- **Front end:** `index.html`, hosted on GitHub Pages.
- **Data:** a Google Sheet, read and written by the Apps Script in `apps-script/Code.gs`.
- **Version 1** is saved on the `version-1` branch.

## Who can see what

| | Attendees (attendee code) | Admins (admin password) |
|---|---|---|
| Agenda, "Find yourself," breakout groups (names, titles, organizations) | Yes | Yes |
| Bios, focus areas, interview details | No | Yes |
| Assign tabs: drag people into groups, edit sessions and people | No | Yes |

Both codes are stored in Apps Script (Script Properties), never in this repository. The
script checks them on every request: without a valid code it sends no retreat data, and
only the admin password can save changes. Search engines are asked not to index the site.

**Safety choices:** the site doesn't show the venue, hotel, restaurant, or any addresses.
Venue and travel details are shared with attendees by email.

This repository holds no attendee data. **Never commit the Sheet data files or one-time
update scripts (such as `V2Update.gs`) here.**

## Everyday use

- **Signing in:** one box for everyone. Attendees enter the attendee code (not
  case-sensitive); admins enter the admin password. Each device remembers it until someone
  clicks **Log out**.
- **Find yourself:** attendees type their name. The "Hi" card lists their breakout groups
  (and whether they're facilitating) and any Funding Spotlight they're presenting. Gold
  always means "yours."
- **Assigning people (admins):** use the **Assign: Session 1** and **Assign: Session 2**
  tabs. Drag cards from "Not yet placed" into a group, tap the star to mark a facilitator,
  and drag a group's header to reorder groups.
- **Interview details (admins):** shown on cards on the Assign tabs. Click an issue tag to
  highlight everyone with it. Edit them from a person's Edit window.
- **Changing the agenda:** edit the Days and Agenda tabs in the Sheet.
  - In the `description` column, lines starting with `-` become bullet points.
  - A Funding Spotlight line written as `- Talk Title (Presenter Name)` shows the presenter
    under the title and highlights it for that presenter. The name must match the People
    tab exactly.
  - `room` shows under the time. `breakout_slot` (`r1` or `r2`) puts that slot's breakout
    groups inside the agenda item.
  - Use title case for agenda and session titles.
- **Changing a code:** update it in Script Properties. No redeploy needed.

## Maintenance

- **Changing the Apps Script code:** Deploy > Manage deployments > Edit (pencil) >
  Version: New version > Deploy. Until you do this, the old code keeps running.
- **After any update:** ask people to do a hard refresh (Cmd+Shift+R or Ctrl+Shift+R).
- **Tabs in the Sheet:** Settings (just the revision number), Days, Agenda, Slots,
  Sessions, People, Assignments, and Profiles. Any other tab is ignored by the site.
- **Tabs the script rewrites on save:** Slots, Sessions, People, and Assignments. Extra columns
  added to those tabs are removed. Days, Agenda, Settings, and Profiles are never rewritten
  by the site.
- **Rolling back:** in GitHub, Settings > Pages, switch the branch to `version-1`. Restore the
  Sheet from File > Version history if needed.
