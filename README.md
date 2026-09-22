# NEID Global Retreat: agenda and breakout sessions

A small website for planning and sharing the NEID Global Retreat agenda and breakout
sessions. Editors sign in with a password to drag people between sessions, mark
facilitators, and edit sessions and the agenda. Everyone else sees a read-only view,
and only once an editor turns on the public view.

- **Front end:** `index.html`, hosted on GitHub Pages.
- **Data:** a Google Sheet, read and written by the Apps Script in `apps-script/Code.gs`.
- **Password:** stored in Apps Script Script Properties. It is not in this repository.

This repository holds no attendee data, so it can be public.
**Never commit the Sheet data file (`NEID_Retreat_Site_Data.xlsx`) here.**

## One-time setup

### 1. Create the Google Sheet
1. Upload `NEID_Retreat_Site_Data.xlsx` to Google Drive.
2. Open it, then choose **File > Save as Google Sheets**. Work in the new Google Sheets
   copy and delete the uploaded .xlsx so there's only one version.
3. Check that it has seven tabs: Settings, Days, Agenda, Slots, Sessions, People, Assignments.

### 2. Add the Apps Script
1. In the Sheet, open **Extensions > Apps Script**.
2. Replace everything in `Code.gs` with the contents of `apps-script/Code.gs`. Save.
3. **Project Settings (gear icon) > Script Properties > Add script property**:
   name `EDITOR_PASSWORD`, value your chosen password. Save.
4. Back in the editor, choose the `testSetup` function and click **Run**. Approve the
   permissions prompt. The log should show 40 people, 3 breakout slots, 3 agenda days,
   and `password set: true`.

### 3. Deploy the web app
1. **Deploy > New deployment**. Click the gear next to "Select type" and choose **Web app**.
2. Execute as: **Me**. Who has access: **Anyone**.
   (If "Anyone" isn't offered, your Google Workspace admin settings restrict it.)
3. Click **Deploy** and copy the **Web app URL** (ends in `/exec`).

### 4. Connect the site
1. In `index.html`, find `API_URL: ""` near the top of the script and paste the URL
   between the quotes.
2. Commit and push.

### 5. Turn on GitHub Pages
1. In the repository: **Settings > Pages**.
2. Source: **Deploy from a branch**, branch **main**, folder **/ (root)**. Save.
3. The `CNAME` file sets the custom domain to `neid-retreat.solutionsinsightslab.org`.
   To use a different address, edit that file and the Custom domain field to match.

### 6. Point the domain (GoDaddy)
1. In GoDaddy DNS for solutionsinsightslab.org, add a record:
   type **CNAME**, name **neid-retreat**, value **YOUR-GITHUB-ACCOUNT.github.io**
   (the account or organization that owns this repository).
2. Wait for DNS to update (minutes to a few hours). Then in **Settings > Pages**,
   tick **Enforce HTTPS** once it's available.

### 7. Check it works
1. Open the site. You should see "This site isn't open yet."
2. Sign in with the editor password. Drag someone into a session; the top right
   should say "All changes saved," and the Assignments tab in the Sheet should update.
3. Open the site in a second browser, sign in, and confirm you see the same board.

## Everyday use

- **Editing on the site:** sign in, then drag cards, star facilitators, and use the Edit
  buttons on sessions, people, and agenda items. Changes save automatically.
- **Editing in the Sheet:** fine for bulk changes (for example, pasting bios into the
  People tab). Open editor pages pick up the change within about 30 seconds. To add a
  person, sessions, or agenda item in the Sheet, leave the id cell blank and the script
  fills one in.
- **Two editors at once:** if someone else saved in the meantime, your board refreshes
  and asks you to redo your last change, rather than overwriting theirs.
- **Going public:** when the agenda is ready, sign in and switch **Public view** to On.
  Until then, the web app returns no data to anyone without the password.
- **Changing the password:** update `EDITOR_PASSWORD` in Script Properties. No redeploy needed.
- **Changing the Apps Script code:** **Deploy > Manage deployments > Edit (pencil) >
  Version: New version > Deploy**. The URL stays the same.

Only columns listed in `Code.gs` are kept. The script rewrites each tab on save, so
extra columns or notes added to those tabs will be removed.
