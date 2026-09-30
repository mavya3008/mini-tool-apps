# Fall 2027 college application tracker

A static, mobile-friendly tracker based on the provided nine-college checklist. It covers priority actions, Common App / ApplyTexas / UC / optional Coalition setup, FAFSA or TASFA and CSS Profile, recommendation letters and assignments, scholarships, visits, individual application submissions, deadlines, and aid outcomes. Optional test-score and essay-supplement sections are intentionally not included.

Each university has its own tab; scholarship entries turn green when an application date is entered. FAFSA and TASFA have separate activity cards, and applying for aid to each university is tracked independently from receiving an award. Changes stay on the page until **Save changes** is clicked and confirmed in the in-page dialog (press **Save** or **Cancel**). Removing a scholarship or recommender requires a separate in-page confirmation, and signing out with unsaved changes warns that they will be discarded.

The **UT Austin - Honors** tab tracks a separate Honors application, program name, verified deadline, submission and recommendation status. It is not counted as a tenth college. Its specific deadline and requirements must be obtained from the selected Honors program. FAFSA and TASFA each have a **Not filing** checkbox; these simply record which form is not being filed. Neither checkbox is a formal Texas graduation opt-out: use **Formal opt-out completed** only when that separate requirement is completed.

## Where data lives

The public GitHub Pages site serves only HTML, CSS, JavaScript, college reference information, and Firebase's **public web configuration**. A single student's progress is stored in Cloud Firestore at `trackers/{studentUid}`. Firebase Authentication handles the email/password form; Firestore security rules allow access only to that one UID. The password is never placed in the repository. Firebase Authentication may remember the sign-in on the student's device; the tracker itself does not store progress in browser local storage.

**Important:** GitHub Pages does not hide its source files or the preloaded college list. The form protects private *progress data*, not the public website. Do not enter Social Security numbers, financial account details, or other sensitive documents into free-text fields.

## Configure Firebase

1. Create a Firebase project and register a **Web app** in its settings. In **Authentication → Sign-in method**, enable **Email/Password**. In **Authentication → Users**, manually create exactly one student account; there is intentionally no public sign-up form.
2. Copy the created user's **UID** from Authentication → Users. Ensure the UID in `firebase-config.js` matches **both** UID comparisons in `firestore.rules` (replace any `REPLACE_WITH_STUDENT_UID` placeholders). The frontend UID check is a convenience only; the Firestore rule is the security boundary.
3. Create a **Cloud Firestore** database in production mode. In **Firestore Database → Rules**, replace the rules with the entire contents of `firestore.rules` and **Publish** them. Do not use test mode or public read/write rules. Rules deny every other document and user, including other accounts registered in the same Firebase project.
4. Copy the Firebase web app's public config values (`apiKey`, `authDomain`, `projectId`, `appId`) into `firebase-config.js`. These web values are intended to be public; **never** paste service-account JSON, private keys, or the student's password. Keep email enumeration protection enabled if offered.
5. In **Authentication → Settings → Authorized domains**, add the GitHub Pages hostname (usually `YOURNAME.github.io`); also add any custom domain you use. Firebase may require `localhost` to be added for local development.

The owner needs a Firebase project and the student's UID to finish setup; the placeholders deliberately disable sign-in until configured.

## Publish on GitHub Pages

This app is published from the `main` branch of [mavya3008/mini-tool-apps](https://github.com/mavya3008/mini-tool-apps), at **https://mavya3008.github.io/mini-tool-apps/**. In **Settings → Pages**, the publishing source is **Deploy from a branch**, `main`, **/(root)**. Keep the repository free of student data. Add `mavya3008.github.io` under Firebase Authentication → Settings → Authorized domains.

For a local preview, run `python -m http.server 8000` in this folder and open `http://localhost:8000`; opening `index.html` directly as a file will not load ES modules reliably. Firebase and the browser need an internet connection. One signed-in device at a time is recommended: this simple tracker saves one complete document per confirmed save, so simultaneous edits on two devices can overwrite each other. Review the confirmation and wait for the “Saved” message before closing the page.

To change the permitted student, update the UID in **both** files, publish the new Firestore rules and site, and decide separately whether to migrate or delete the old Firestore document. There is no account-management or password-reset UI; the owner can reset the account in Firebase Console.

## Checklist reference

The source document reflects published requirements as of late September 2026. Reconfirm every deadline, financial-aid policy, recommendation requirement, and letter count on each college's official website before submission. The target date for completing the initial checklist is October 8, 2026.

Run the offline data-model checks with `node --test` (Node 20+). Live sign-in and persistence require configured Firebase services.
