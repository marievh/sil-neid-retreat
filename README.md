# NEID Global Retreat: breakout planning

A small website for planning breakout sessions at the NEID Global Retreat
(October 19–21, 2026). Drag people between sessions, mark facilitators, and edit
bios, focus areas, and sessions. Admins can also see and edit takeaways from the
participant interviews. Changes save to a shared Google Sheet, so everyone sees the
same board.

- **Site:** https://neid-retreat.solutionsinsightslab.org (also reachable at
  https://marievh.github.io/sil-neid-retreat/, which redirects there)
- **Front end:** `index.html`, hosted on GitHub Pages.
- **Data:** a Google Sheet, read and written by the Apps Script in `apps-script/Code.gs`.

## Who can see what

- **The board** has no sign-in. Anyone with the site link can view and edit sessions,
  assignments, bios, and focus areas.
- **Admin details** (interview takeaways) are for admins only. They load only after
  someone clicks **Admin details** and enters the admin password. The password is
  stored in Apps Script (Script Properties as `ADMIN_PASSWORD`), never in this repository.

If someone makes an unwanted change, use **File > Version history** in the Google Sheet
to restore an earlier version.

This repository holds no attendee data. **Never commit the Sheet data files
(`NEID_Retreat_Site_Data.xlsx`, `NEID_Profiles_Tab.xlsx`) or one-time update scripts here.**

## One-time setup

### 1. Create the Google Sheet
1. Upload `NEID_Retreat_Site_Data.xlsx` to Google Drive.
2. Open it, then choose **File > Save as Google Sheets**. Work in the new Google Sheets
   copy and delete the uploaded .xlsx so there's only one version.
3. Add the interview takeaways: **File > Import > Upload**, choose
   `NEID_Profiles_Tab.xlsx`, and pick **Insert new sheet(s)**. The new tab must be
   named exactly **Profiles**.
4. The app uses six tabs: **Settings, Slots, Sessions, People, Assignments, Profiles**.
   Other tabs (such as Days and Agenda) are left alone.

### 2. Add the Apps Script
1. In the Sheet, open **Extensions > Apps Script**.
2. Replace everything in `Code.gs` with the contents of `apps-script/Code.gs`. Save.
3. **Project Settings (gear icon) > Script Properties > Add script property**:
   name `ADMIN_PASSWORD`, value your chosen password. Save.
4. Choose the `testSetup` function and click **Run**. Approve the permissions prompt.
   The log should list the people, the two breakout slots, the number of interview
   profiles matched, and "Admin password set: true."

### 3. Deploy the web app
1. **Deploy > New deployment**. Click the gear next to "Select type" and choose **Web app**.
2. Execute as: **Me**. Who has access: **Anyone**.
   (If "Anyone" isn't offered, your Google Workspace admin settings restrict it.)
3. Click **Deploy** and copy the **Web app URL** (ends in `/exec`).
4. To check it, open that URL in a browser tab. You should see
   "The breakout planning backend is running."

### 4. Connect the site
1. In `index.html`, find `API_URL: ""` near the top of the script and paste the URL
   between the quotes.
2. Commit and push.

### 5. Turn on GitHub Pages
1. In the repository: **Settings > Pages**.
2. Source: **Deploy from a branch**, branch **main**, folder **/ (root)**. Save.
3. The repository must be public to use Pages on a free GitHub plan.

### 6. Custom domain (optional)
1. In GoDaddy DNS for solutionsinsightslab.org, add a record: type **CNAME**,
   name **neid-retreat**, value **marievh.github.io**.
2. In **Settings > Pages**, enter `neid-retreat.solutionsinsightslab.org` as the
   Custom domain and save. (GitHub commits a `CNAME` file for you.) Tick
   **Enforce HTTPS** once it's available.

### 7. Check it works
1. Open the site. The first visit may show "Loading the board…" for a few seconds.
2. Drag someone into a session. The top right should say "All changes saved," and the
   Assignments tab in the Sheet should update.
3. Click **Admin details**, enter the admin password, and confirm the interview
   details appear on the cards.

## Everyday use

- **Editing the board:** drag cards between sessions, tap the star to mark a
  facilitator, and use the Edit buttons on people and sessions. Changes save automatically.
- **Breakout sessions:** there are two, Breakout Session 1 and Breakout Session 2, named
  in the order the rows appear in the Slots tab. Each tab shows how many people are
  still to be assigned.
- **Focus areas:** shown under each person's bio. Put each focus area on its own line
  to show them as bullet points. In the Sheet, press Cmd+Enter (Mac) or Ctrl+Enter
  (Windows) to start a new line in a cell.
- **Search:** matches names, titles, organizations, and focus areas (and, for admins,
  the interview details).
- **Editing in the Sheet:** fine for bulk changes, such as pasting bios into the People
  tab. Open pages pick up the change within about 30 seconds. To add a person or session
  in the Sheet, leave the id cell blank and the script fills one in.
- **Two people editing at once:** if someone else saved in the meantime, your board
  refreshes and asks you to redo your last change, rather than overwriting theirs.
- **Speed:** after the first visit, the board opens instantly on that device and then
  checks for newer changes.

## Admin details

- **Viewing:** click **Admin details** and enter the admin password. Each device
  remembers it until someone clicks **Hide and lock**. The **Interview details: On/Off**
  switch collapses the details without locking.
- **What's shown:** the same columns as the interview analysis: Interviewee
  characteristics, Focus 1, Focus 2, Focus 3, Strong view, and Issue tags.
- **Highlight by issue:** click a tag above the board, or on a card, to outline everyone
  with that tag and fade everyone else. Click it again (or **Clear**) to reset.
- **Editing:** with admin details showing, click **Edit** on a card. The admin fields
  are at the bottom of the Edit window. Separate issue tags with semicolons. This also
  works for people who don't have a profile yet.
- **In the Sheet:** the Profiles tab holds the same information. When new interviews
  are done, add a row per person. `person_id` can be left blank; the script matches
  rows to people by name.
- **Changing the password:** update `ADMIN_PASSWORD` in Script Properties. No
  redeploy needed. Admins will be asked to sign in again.

## Maintenance

- **Changing the Apps Script code:** **Deploy > Manage deployments > Edit (pencil) >
  Version: New version > Deploy**. The URL stays the same. Until you do this, the old
  code keeps running.
- **Tabs the script rewrites:** Slots, Sessions, People, and Assignments are rewritten
  on every save, so extra columns or notes added to those tabs will be removed. The
  Profiles tab is only updated one row at a time. Keep notes elsewhere.
