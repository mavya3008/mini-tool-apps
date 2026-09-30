import { firebaseConfig, allowedUid } from "./firebase-config.js";
import { colleges, platforms, priorities, initialTracker, scholarshipCount } from "./data.js";

const login = document.querySelector("#login");
const form = document.querySelector("#login-form");
const loginError = document.querySelector("#login-error");
const trackerElement = document.querySelector("#tracker");
const notice = document.querySelector("#notice");
const signOutButton = document.querySelector("#sign-out");
const confirmDialog = document.querySelector("#confirm-dialog");
const confirmDescription = document.querySelector("#confirm-description");
const confirmAccept = document.querySelector("#confirm-accept");
const confirmCancel = document.querySelector("#confirm-cancel");
const collegeTabs = colleges.flatMap(college => college.id === "uta"
  ? [{ id: college.id, name: college.name }, { id: "uta-honors", name: "UT Austin - Honors" }]
  : [{ id: college.id, name: college.name }]);
const configured = !Object.values(firebaseConfig).some(value => value.includes("REPLACE_WITH_"))
  && !allowedUid.includes("REPLACE_WITH_");

let tracker;
let documentRef;
let saveChain = Promise.resolve();
let loadVersion = 0;
let revision = 0;
let savedRevision = 0;
let activeCollege = colleges[0].id;
let saving = false;
let pendingAction = null;
let auth;
let db;
let signInWithEmailAndPassword;
let signOut;
let doc;
let getDoc;
let setDoc;
let serverTimestamp;

function message(text, error = false) {
  notice.textContent = text;
  notice.dataset.error = String(error);
}

function askConfirmation(description, action, label = "Confirm") {
  pendingAction = action;
  confirmDescription.textContent = description;
  confirmAccept.textContent = label;
  confirmDialog.showModal();
  confirmCancel.focus();
}

function closeConfirmation() {
  pendingAction = null;
  confirmDialog.close();
}

confirmCancel.addEventListener("click", closeConfirmation);
confirmDialog.addEventListener("cancel", () => { pendingAction = null; });
confirmAccept.addEventListener("click", () => {
  const action = pendingAction;
  closeConfirmation();
  if (action) action();
});

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function valueAt(path) {
  return path.split(".").reduce((value, key) => value?.[key], tracker);
}

function setAt(path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  const parent = keys.reduce((object, key) => object?.[key], tracker);
  if (parent === undefined || parent === null || !(last in parent)) {
    throw new Error(`Unexpected tracker field: ${path}`);
  }
  parent[last] = value;
}

function field(label, path, type = "text", options = []) {
  const value = valueAt(path);
  const id = `f-${path.replaceAll(".", "-")}`;
  let control;
  if (type === "select") {
    control = `<select id="${id}" data-field="${escapeHTML(path)}">${options.map(option =>
      `<option value="${escapeHTML(option)}" ${value === option ? "selected" : ""}>${escapeHTML(option || "Choose…")}</option>`
    ).join("")}</select>`;
  } else if (type === "textarea") {
    control = `<textarea id="${id}" data-field="${escapeHTML(path)}">${escapeHTML(value)}</textarea>`;
  } else {
    const attrs = type === "number" ? ` min="0"${path === "ucQuestions" ? ' max="4"' : ""}${path.endsWith(".amount") ? ' step="0.01"' : ""}` : "";
    control = `<input id="${id}" data-field="${escapeHTML(path)}" type="${type}" value="${escapeHTML(value)}"${attrs}>`;
  }
  return `<div class="field"><label for="${id}">${escapeHTML(label)}</label>${control}</div>`;
}

function check(label, path, hint = "") {
  return `<label class="check"><input type="checkbox" data-field="${escapeHTML(path)}" ${valueAt(path) ? "checked" : ""}>
    <span>${escapeHTML(label)}${hint ? `<small>${escapeHTML(hint)}</small>` : ""}</span></label>`;
}

function prioritySection() {
  return `<section class="panel"><div class="section-heading"><h2>1. This week's priorities</h2><span class="hint">Target: October 8, 2026</span></div>
    <div class="grid">${priorities.map(([id, label]) => check(label, `priorities.${id}`)).join("")}</div></section>`;
}

function platformSection() {
  return `<section class="panel"><h2>2. Application platforms</h2>
    <p class="hint">Choose one platform for each college. Do not apply to the same school on two platforms.</p>
    <div class="grid">${platforms.map(platform => `<div class="subpanel">
      <h3>${escapeHTML(platform.name)}</h3><p class="hint">${escapeHTML(platform.colleges)}</p>
      ${check("Account created", `platforms.${platform.id}.account`)}
      ${check("Shared profile complete", `platforms.${platform.id}.profile`)}
    </div>`).join("")}</div>
    <div class="subpanel"><h3>UCLA Personal Insight Questions</h3>
      <p class="hint">Answer 4 of 8 questions, up to 350 words each.</p>
      <div class="field-row">${field("Completed (out of 4)", "ucQuestions", "number")}</div>
    </div></section>`;
}

function aidSection() {
  return `<section class="panel"><h2>3. Financial aid</h2>
    <p class="hint">For Texas high school graduation, file FAFSA or TASFA, not both, or formally opt out. FAFSA (2027–28) opens approximately Oct 1, 2026; verify at studentaid.gov. TASFA is available Oct 1, 2026, with a state priority deadline around Jan 15, 2027.</p>
    <div class="field-row">${field("Which route applies?", "aid.choice", "select", ["", "FAFSA", "TASFA", "Formal opt-out"])}</div>
    <div class="grid"><div class="subpanel"><h3>FAFSA (2027–28)</h3>
      <p class="hint">For eligible U.S. citizens and eligible non-citizens; federal, state and institutional aid.</p>
      ${check("FAFSA submitted", "aid.fafsaSubmitted")}
      ${check("Opt out of FAFSA (not filing)", "aid.fafsaOptOut", "Not a formal graduation opt-out by itself.")}
      ${field("FAFSA submission date", "aid.fafsaDate", "date")}
    </div><div class="subpanel"><h3>TASFA (2027–28)</h3>
      <p class="hint">For students not eligible for FAFSA; Texas state aid at public universities.</p>
      ${check("TASFA submitted", "aid.tasfaSubmitted")}
      ${check("Opt out of TASFA (not filing)", "aid.tasfaOptOut", "Not a formal graduation opt-out by itself.")}
      ${field("TASFA submission date", "aid.tasfaDate", "date")}
    </div></div>
    <div class="grid"><div class="subpanel"><h3>Formal opt-out</h3>
      <p class="hint">Only if you are not filing FAFSA or TASFA.</p>
      ${check("Opt-out completed", "aid.optOutCompleted")}
    </div><div class="subpanel"><h3>CSS Profile (2027–28)</h3>
      <p class="hint">For institutional need-based aid at Rice, Vanderbilt, and UChicago. Opens October 2026. Confirm Baylor's current policy directly.</p>
      ${check("CSS Profile submitted", "aid.cssSubmitted")}
      ${field("Submission date", "aid.cssDate", "date")}
    </div></div>
    <div class="subpanel"><h3>CSS priority deadlines</h3>
      ${colleges.filter(college => college.css).map(college =>
        `<p><strong>${escapeHTML(college.name)}:</strong> ${escapeHTML(college.css)}</p>`
      ).join("")}</div>
    ${field("Financial aid notes", "aid.notes", "textarea")}
    <p class="hint">Track applying for aid, award letters, net prices, and appeals separately for each college below.</p></section>`;
}

function collegeCard(college) {
  const base = `colleges.${college.id}`;
  const state = tracker.colleges[college.id];
  return `<article class="college"><div class="card-heading"><h3>${escapeHTML(college.name)}</h3>
    <span class="pill" data-status-for="${college.id}">${escapeHTML(state.status)}</span></div>
    <p class="reference"><strong>Deadlines:</strong> ${escapeHTML(college.early)} · ${escapeHTML(college.regular)}</p>
    <p class="reference"><strong>Platforms:</strong> ${escapeHTML(college.platforms.join(" / "))}</p>
    <div class="college-fields">
      <div class="grid three">
        ${field("Application platform", `${base}.platform`, "select", ["", ...college.platforms])}
        ${field("Application round", `${base}.round`, "select", ["", ...college.rounds])}
        ${field("Application status", `${base}.status`, "select", ["Not started", "In progress", "Submitted"])}
        ${field("Date submitted", `${base}.submittedDate`, "date")}
        ${field("Confirmation / portal reference", `${base}.confirmation`)}
        <div>${check("Confirmed deadline on official site", `${base}.deadlineVerified`)}</div>
      </div>
      <div class="subpanel"><h3>Recommendation letters</h3>
        <p class="hint">${escapeHTML(college.recommendation)}</p>
        ${college.recTarget === null
          ? `<p class="hint">No standard application letters to track.</p>`
          : `<div class="grid three">
              ${field(`Submitted so far / ${college.recTarget}`, `${base}.recCount`, "number")}
              ${field("Status", `${base}.recStatus`, "select", ["Not started", "Requested", "Partially received", "Complete", "Not needed"])}
              ${field("Submitted from (recommender names)", `${base}.recFrom`, "textarea")}
            </div>`}
      </div>
      <div class="subpanel"><h3>College visit</h3><div class="grid three">
        ${field("Visit status", `${base}.visitStatus`, "select", ["Pending", "Planned", "Done"])}
        ${field("Visited / planned date", `${base}.visitDate`, "date")}
        ${field("Visit notes", `${base}.visitNotes`, "textarea")}
      </div>${["ucla", "vandy", "uchicago"].includes(college.id) ? '<p class="hint">A virtual tour is an option if travel is not feasible.</p>' : ""}</div>
      <div class="subpanel"><h3>Apply for financial aid</h3>
        <p class="hint">Track sending financial-aid applications or materials to this college, separately from its admission decision and award.</p>
        <div class="grid">
          ${field("Aid application status", `${base}.aidApplicationStatus`, "select", ["Not started", "In progress", "Submitted", "Not applicable"])}
          ${field("Aid application submission date", `${base}.aidApplicationDate`, "date")}
        </div>
      </div>
      <div class="subpanel"><h3>Financial aid outcome</h3><div class="grid three">
        ${check("Award letter received", `${base}.awardReceived`)}
        ${field("Confirmed net price", `${base}.netPrice`)}
        ${check("Appeal filed, if needed", `${base}.appealFiled`)}
      </div></div>
      ${field("College notes", `${base}.notes`, "textarea")}
    </div></article>`;
}

function honorsCard() {
  return `<article class="college"><h3>UT Austin - Honors program</h3>
    <p class="reference">Track this separately from your UT Austin undergraduate application. Honors deadlines and recommendation requirements vary by program; verify them on the official program page.</p>
    <div class="grid three">
      ${field("Honors program name", "honors.program")}
      ${field("Honors deadline", "honors.deadline", "date")}
      ${check("Confirmed Honors requirements and deadline", "honors.deadlineVerified")}
      ${field("Honors application status", "honors.status", "select", ["Not started", "In progress", "Submitted"])}
      ${field("Date submitted", "honors.submittedDate", "date")}
      ${field("Confirmation / portal reference", "honors.confirmation")}
    </div>
    <div class="subpanel"><h3>Honors recommendation</h3>
      <p class="hint">Some UT Austin Honors programs require one recommendation. Check the program's official requirements.</p>
      <div class="grid three">
        ${check("Recommendation required", "honors.recommendationRequired")}
        ${check("Recommendation requested", "honors.recommendationRequested")}
        ${check("Recommendation received", "honors.recommendationReceived")}
      </div>
    </div>
    ${field("Honors requirements and notes", "honors.notes", "textarea")}
  </article>`;
}

function collegeSection() {
  return `<section class="panel"><h2>4, 6 &amp; 7. College applications</h2>
    <p class="hint">Select a university or UT Austin Honors to update its application and requirements.</p>
    <div class="college-tabs" role="tablist" aria-label="Universities">
      ${collegeTabs.map(tab => `<button type="button" role="tab" id="tab-${tab.id}"
        aria-controls="panel-${tab.id}" aria-selected="${tab.id === activeCollege}"
        tabindex="${tab.id === activeCollege ? 0 : -1}" data-college-tab="${tab.id}">${escapeHTML(tab.name)}</button>`).join("")}
    </div>
    ${collegeTabs.map(tab => `<div role="tabpanel" id="panel-${tab.id}"
      aria-labelledby="tab-${tab.id}" tabindex="0" ${tab.id === activeCollege ? "" : "hidden"}>
      ${tab.id === "uta-honors" ? honorsCard() : collegeCard(colleges.find(college => college.id === tab.id))}</div>`).join("")}</section>`;
}

function recommenderSection() {
  return `<section class="panel"><h2>4. Recommender assignment planner</h2>
    <p class="hint">Request letters 4–6 weeks before the earliest deadline. Give each recommender your resume and a note about your goals.</p>
    ${tracker.recommenders.map((_, index) => `<div class="subpanel"><div class="card-heading"><h3>Recommender ${index + 1}</h3>
      <button type="button" class="secondary danger" data-action="remove-recommender" data-index="${index}">Remove</button></div><div class="grid three">
      ${field("Name", `recommenders.${index}.name`)}
      ${field("Subject / role", `recommenders.${index}.role`)}
      ${field("Colleges assigned to", `recommenders.${index}.assigned`, "textarea")}
      ${field("Requested date", `recommenders.${index}.requested`, "date")}
    </div></div>`).join("")}
    <button type="button" class="secondary" data-action="add-recommender">Add recommender</button></section>`;
}

function scholarshipSection() {
  return `<section class="panel"><div class="section-heading"><h2>5. Scholarships</h2>
    <span class="pill">Applied: <span id="scholarship-total">${scholarshipCount(tracker)}</span></span></div>
    <p class="hint">Add one row for each scholarship; enter the application date once submitted.</p>
    ${tracker.scholarships.map((item, index) => `<div class="list-item scholarship ${item.appliedDate ? "submitted" : ""}" data-scholarship="${index}"><div class="card-heading"><h3>Scholarship ${index + 1}</h3>
      <span class="submitted-label" ${item.appliedDate ? "" : "hidden"}>Submitted</span>
      <button type="button" class="secondary danger" data-action="remove-scholarship" data-index="${index}">Remove</button></div>
      <div class="grid three">
        ${field("Scholarship name", `scholarships.${index}.name`)}
        ${field("Amount ($)", `scholarships.${index}.amount`, "number")}
        ${field("Deadline", `scholarships.${index}.deadline`, "date")}
        ${field("Date applied", `scholarships.${index}.appliedDate`, "date")}
        ${field("Notes", `scholarships.${index}.notes`, "textarea")}
      </div></div>`).join("")}
    <div class="actions"><button type="button" class="secondary" data-action="add-scholarship">Add scholarship</button></div></section>`;
}

function render() {
  trackerElement.innerHTML = `<div class="warning">Target checklist completion: October 8, 2026. Dates and requirements are a September 2026 snapshot; verify each official admissions site before submitting.</div>
    <div class="stats"><div class="stat"><strong id="submitted-total">${colleges.filter(college => tracker.colleges[college.id].status === "Submitted").length}/9</strong><span>Applications submitted</span></div>
    <div class="stat"><strong id="priority-total">${Object.values(tracker.priorities).filter(Boolean).length}/${priorities.length}</strong><span>Priority actions done</span></div>
    <div class="stat"><strong id="scholarship-stat">${scholarshipCount(tracker)}</strong><span>Scholarships applied</span></div></div>
    ${prioritySection()}${platformSection()}${aidSection()}${collegeSection()}${recommenderSection()}${scholarshipSection()}
    <div class="actions save-bar"><button type="button" id="save-now" ${saving ? "disabled" : ""}>Save changes</button><span class="hint">Changes are not saved until you confirm.</span></div>`;
}

function updateTotals() {
  document.querySelector("#submitted-total").textContent = `${colleges.filter(college => tracker.colleges[college.id].status === "Submitted").length}/9`;
  document.querySelector("#priority-total").textContent = `${Object.values(tracker.priorities).filter(Boolean).length}/${priorities.length}`;
  document.querySelector("#scholarship-stat").textContent = scholarshipCount(tracker);
  document.querySelector("#scholarship-total").textContent = scholarshipCount(tracker);
  for (const badge of document.querySelectorAll("[data-status-for]")) {
    badge.textContent = tracker.colleges[badge.dataset.statusFor].status;
  }
}

function selectCollege(id, focus = false) {
  if (!collegeTabs.some(tab => tab.id === id)) return;
  activeCollege = id;
  for (const tab of trackerElement.querySelectorAll("[data-college-tab]")) {
    const selected = tab.dataset.collegeTab === id;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
    if (selected && focus) tab.focus();
  }
  for (const tab of collegeTabs) {
    trackerElement.querySelector(`#panel-${tab.id}`).hidden = tab.id !== id;
  }
}

function save() {
  if (!documentRef || !tracker || saving) return saveChain;
  if (revision === savedRevision) {
    message("No unsaved changes.");
    return saveChain;
  }
  askConfirmation("Save your changes to your private tracker?", () => { void persistChanges().catch(() => {}); }, "Save");
  return saveChain;
}

function persistChanges() {
  if (!documentRef || !tracker || saving || revision === savedRevision) return saveChain;
  const snapshot = structuredClone(tracker);
  const snapshotRevision = revision;
  const target = documentRef;
  saving = true;
  const button = trackerElement.querySelector("#save-now");
  if (button) button.disabled = true;
  message("Saving…");
  saveChain = saveChain.catch(() => {}).then(async () => {
    await setDoc(target, { data: snapshot, updatedAt: serverTimestamp() });
    savedRevision = Math.max(savedRevision, snapshotRevision);
    message(revision === savedRevision ? "Saved to your private tracker." : "New unsaved changes remain. Save again.");
  }).catch(error => {
    message(`Could not save. Your changes are still on this page; try Save now. (${error.code || error.message})`, true);
    throw error;
  }).finally(() => {
    saving = false;
    if (button) button.disabled = false;
  });
  return saveChain;
}

function markChanged() {
  revision += 1;
  message("Unsaved changes…");
}

window.addEventListener("beforeunload", event => {
  if (documentRef && revision > savedRevision) {
    event.preventDefault();
    event.returnValue = "";
  }
});

function mergeSaved(saved) {
  const defaults = initialTracker();
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) throw new Error("Invalid tracker data");
  const aid = { ...defaults.aid, ...saved.aid };
  if (saved.aid?.formSubmitted && saved.aid.choice === "FAFSA") {
    aid.fafsaSubmitted = true;
    aid.fafsaDate ||= saved.aid.formDate || "";
  } else if (saved.aid?.formSubmitted && saved.aid.choice === "TASFA") {
    aid.tasfaSubmitted = true;
    aid.tasfaDate ||= saved.aid.formDate || "";
  } else if (saved.aid?.formSubmitted && saved.aid.choice === "Formal opt-out") {
    aid.optOutCompleted = true;
  }
  delete aid.formSubmitted;
  delete aid.formDate;
  return {
    ...defaults, ...saved,
    priorities: { ...defaults.priorities, ...saved.priorities },
    platforms: Object.fromEntries(platforms.map(({ id }) => [id, { ...defaults.platforms[id], ...saved.platforms?.[id] }])),
    aid,
    honors: { ...defaults.honors, ...saved.honors },
    colleges: Object.fromEntries(colleges.map(({ id }) => [id, { ...defaults.colleges[id], ...saved.colleges?.[id] }])),
    recommenders: Array.isArray(saved.recommenders) ? saved.recommenders.map(({ resumeSent, ...item }) => item) : defaults.recommenders,
    scholarships: Array.isArray(saved.scholarships) ? saved.scholarships : defaults.scholarships
  };
}

trackerElement.addEventListener("input", event => {
  const control = event.target.closest("[data-field]");
  if (!control) return;
  const value = control.type === "checkbox" ? control.checked
    : control.type === "number" ? (control.value === "" ? 0 : Number(control.value))
      : control.value;
  if (control.dataset.field === "aid.choice" && (
    (tracker.aid.fafsaSubmitted && value !== "FAFSA") ||
    (tracker.aid.tasfaSubmitted && value !== "TASFA") ||
    (tracker.aid.optOutCompleted && value !== "Formal opt-out") ||
    (value === "FAFSA" && tracker.aid.fafsaOptOut) ||
    (value === "TASFA" && tracker.aid.tasfaOptOut) ||
    (value === "Formal opt-out" && (tracker.aid.fafsaSubmitted || tracker.aid.tasfaSubmitted))
  )) {
    control.value = tracker.aid.choice;
    message("The selected aid route conflicts with a completed or not-filing checkbox. Clear the conflicting checkbox first.", true);
    return;
  }
  if (value === true && (
    (control.dataset.field === "aid.fafsaSubmitted" && (tracker.aid.tasfaSubmitted || tracker.aid.fafsaOptOut || tracker.aid.optOutCompleted)) ||
    (control.dataset.field === "aid.tasfaSubmitted" && (tracker.aid.fafsaSubmitted || tracker.aid.tasfaOptOut || tracker.aid.optOutCompleted)) ||
    (control.dataset.field === "aid.optOutCompleted" && (tracker.aid.fafsaSubmitted || tracker.aid.tasfaSubmitted)) ||
    (control.dataset.field === "aid.fafsaOptOut" && tracker.aid.fafsaSubmitted) ||
    (control.dataset.field === "aid.tasfaOptOut" && tracker.aid.tasfaSubmitted)
  )) {
    control.checked = false;
    message("This choice conflicts with an existing aid submission or opt-out. Uncheck the conflicting option first.", true);
    return;
  }
  setAt(control.dataset.field, value);
  if (value === true && (
    (control.dataset.field === "aid.fafsaOptOut" && tracker.aid.choice === "FAFSA") ||
    (control.dataset.field === "aid.tasfaOptOut" && tracker.aid.choice === "TASFA")
  )) {
    tracker.aid.choice = "";
    trackerElement.querySelector('[data-field="aid.choice"]').value = "";
  }
  if (value === true && ["aid.fafsaSubmitted", "aid.tasfaSubmitted", "aid.optOutCompleted"].includes(control.dataset.field)) {
    tracker.aid.choice = { "aid.fafsaSubmitted": "FAFSA", "aid.tasfaSubmitted": "TASFA", "aid.optOutCompleted": "Formal opt-out" }[control.dataset.field];
    trackerElement.querySelector('[data-field="aid.choice"]').value = tracker.aid.choice;
  }
  if (control.dataset.field.endsWith(".appliedDate")) {
    const item = control.closest("[data-scholarship]");
    item.classList.toggle("submitted", Boolean(value));
    item.querySelector(".submitted-label").hidden = !value;
  }
  updateTotals();
  markChanged();
});

trackerElement.addEventListener("click", event => {
  const button = event.target.closest("[data-action], [data-college-tab], #save-now");
  if (!button) return;
  if (button.dataset.collegeTab) { selectCollege(button.dataset.collegeTab); return; }
  if (button.id === "save-now") { save(); return; }
  if (button.dataset.action === "add-scholarship") {
    tracker.scholarships.push({ name: "", amount: 0, deadline: "", appliedDate: "", notes: "" });
  } else if (button.dataset.action === "remove-scholarship") {
    const index = Number(button.dataset.index);
    askConfirmation("Delete this scholarship? It will be removed from Firestore only after you save your changes.", () => {
      tracker.scholarships.splice(index, 1);
      render();
      markChanged();
    }, "Delete");
    return;
  } else if (button.dataset.action === "add-recommender") {
    tracker.recommenders.push({ name: "", role: "", assigned: "", requested: "" });
  } else if (button.dataset.action === "remove-recommender") {
    const index = Number(button.dataset.index);
    askConfirmation("Delete this recommender? It will be removed from Firestore only after you save your changes.", () => {
      tracker.recommenders.splice(index, 1);
      render();
      markChanged();
    }, "Delete");
    return;
  }
  render();
  markChanged();
});

trackerElement.addEventListener("keydown", event => {
  const tab = event.target.closest("[data-college-tab]");
  if (!tab || !["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const index = collegeTabs.findIndex(item => item.id === tab.dataset.collegeTab);
  const next = event.key === "Home" ? 0 : event.key === "End" ? collegeTabs.length - 1
    : (index + (event.key === "ArrowRight" ? 1 : -1) + collegeTabs.length) % collegeTabs.length;
  selectCollege(collegeTabs[next].id, true);
});

form.addEventListener("submit", async event => {
  event.preventDefault();
  if (!auth) return;
  loginError.textContent = "";
  const button = form.querySelector("button");
  button.disabled = true;
  try {
    await signInWithEmailAndPassword(auth, form.elements.email.value.trim(), form.elements.password.value);
    form.elements.password.value = "";
  } catch {
    loginError.textContent = "Sign-in failed. Check the email and password, then try again.";
  } finally {
    button.disabled = false;
  }
});

signOutButton.addEventListener("click", async () => {
  signOutButton.disabled = true;
  try {
    await saveChain;
    if (revision > savedRevision) {
      askConfirmation("You have unsaved changes. Sign out and discard them?", () => {
        void signOut(auth).catch(error => message(`Could not sign out. (${error.code || error.message})`, true));
      }, "Discard and sign out");
      return;
    }
    await signOut(auth);
  } catch (error) {
    message(`Could not sign out. Try again. (${error.code || error.message})`, true);
  } finally {
    signOutButton.disabled = false;
  }
});

if (!configured) {
  form.querySelector("button").disabled = true;
  loginError.textContent = "Tracker setup is incomplete. The owner must configure Firebase before sign-in is available.";
} else {
  async function start() {
    try {
      const [firebase, authentication, firestore] = await Promise.all([
        import("https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js"),
        import("https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js"),
        import("https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js")
      ]);
      ({ signInWithEmailAndPassword, signOut } = authentication);
      ({ doc, getDoc, setDoc, serverTimestamp } = firestore);
      const firebaseApp = firebase.initializeApp(firebaseConfig);
      auth = authentication.getAuth(firebaseApp);
      db = firestore.getFirestore(firebaseApp);
      form.querySelector("button").disabled = false;
      authentication.onAuthStateChanged(auth, handleAuthChange, error => {
        message(`Authentication is unavailable. (${error.code || error.message})`, true);
      });
    } catch (error) {
      form.querySelector("button").disabled = true;
      loginError.textContent = `Unable to load Firebase sign-in. Check your connection and configuration. (${error.message})`;
    }
  }

  async function handleAuthChange(user) {
    const version = ++loadVersion;
    trackerElement.hidden = true;
    signOutButton.hidden = true;
    documentRef = undefined;
    tracker = undefined;
    if (!user) {
      revision = 0;
      savedRevision = 0;
      login.hidden = false;
      message("");
      return;
    }
    if (user.uid !== allowedUid) {
      loginError.textContent = "This account is not permitted to access the tracker.";
      try {
        await signOut(auth);
      } catch (error) {
        message(`Could not sign out the unauthorized account. (${error.code || error.message})`, true);
        signOutButton.hidden = false;
      }
      return;
    }
    login.hidden = true;
    message("Loading your tracker…");
    try {
      const ref = doc(db, "trackers", allowedUid);
      const snapshot = await getDoc(ref);
      if (version !== loadVersion) return;
      tracker = snapshot.exists() ? mergeSaved(snapshot.data().data) : initialTracker();
      documentRef = ref;
      revision = 0;
      savedRevision = 0;
      render();
      trackerElement.hidden = false;
      signOutButton.hidden = false;
      message(snapshot.exists() ? "Tracker loaded." : "Ready. Your first change will create your private tracker.");
    } catch (error) {
      message(`Could not load your tracker. Check Firestore access and retry by signing in again. (${error.code || error.message})`, true);
      signOutButton.hidden = false;
    }
  }

  form.querySelector("button").disabled = true;
  void start();
}
