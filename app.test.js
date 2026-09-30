import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { colleges, platforms, priorities, initialTracker, scholarshipCount } from "./data.js";

function makePage() {
  const elements = Object.fromEntries([
    "#login", "#login-form", "#login-error", "#tracker", "#notice", "#sign-out",
    "#confirm-dialog", "#confirm-description", "#confirm-accept", "#confirm-cancel"
  ].map(id => [id, {
    hidden: false, disabled: false, dataset: {}, textContent: "", innerHTML: "",
    addEventListener(type, handler) { this[type] = handler; },
    querySelector() { return this.button ??= { disabled: false }; },
    showModal() { this.open = true; },
    close() { this.open = false; },
    focus() {}
  }]));
  const document = {
    querySelector(selector) { return elements[selector] ?? { textContent: "" }; },
    querySelectorAll() { return []; }
  };
  const context = {
    document,
    window: { addEventListener() {} },
    firebaseConfig: { apiKey: "REPLACE_WITH_FIREBASE_API_KEY" },
    allowedUid: "REPLACE_WITH_STUDENT_UID",
    colleges, platforms, priorities, initialTracker, scholarshipCount,
    structuredClone, clearTimeout, setTimeout
  };
  const source = readFileSync(new URL("./app.js", import.meta.url), "utf8")
    .replace(/^import .*;\r?\n/gm, "");
  vm.runInNewContext(`${source}\ntracker = initialTracker(); render();`, context);
  return { elements, context };
}

test("app renders every college and every numbered checklist section", () => {
  const { elements } = makePage();
  const html = elements["#tracker"].innerHTML;
  for (const college of colleges) {
    assert.ok(html.includes(college.name.replaceAll("&", "&amp;")), college.name);
    assert.ok(html.includes(`role="tab" id="tab-${college.id}"`), college.id);
    assert.ok(html.includes(`role="tabpanel" id="panel-${college.id}"`), college.id);
    assert.ok(html.includes(`data-field="colleges.${college.id}.status"`), college.id);
    assert.ok(html.includes(`data-field="colleges.${college.id}.visitStatus"`), college.id);
    assert.ok(html.includes(`data-field="colleges.${college.id}.aidApplicationStatus"`), college.id);
  }
  for (const section of [
    "This week's priorities", "Application platforms", "Financial aid",
    "Recommendation letters", "Recommender assignment planner",
    "Scholarships", "College visit", "College applications"
  ]) assert.ok(html.includes(section), section);
  assert.ok(html.includes("CSS priority deadlines"));
  assert.ok(html.includes("UC Application"));
  assert.ok(html.includes("FAFSA (2027–28)"));
  assert.ok(html.includes("TASFA (2027–28)"));
  assert.ok(!html.includes("Resume shared"));
  assert.ok(html.includes("Changes are not saved until you confirm."));
  assert.equal((html.match(/aria-selected="true"/g) ?? []).length, 1);
  assert.equal((html.match(/<article class="college">/g) ?? []).length, 10);
  assert.ok(html.includes('id="submitted-total">0/9'));
  assert.ok(html.includes('id="tab-uta-honors"'));
  assert.ok(html.includes('data-field="honors.program"'));
  assert.ok(html.includes('data-field="honors.recommendationReceived"'));
  assert.ok(html.includes('data-field="aid.fafsaOptOut"'));
  assert.ok(html.includes('data-field="aid.tasfaOptOut"'));
});

test("rendered student text is escaped and the setup form is disabled without Firebase config", () => {
  const { elements, context } = makePage();
  vm.runInNewContext(`tracker.colleges.uta.notes = '<img src=x onerror=alert(1)>'; render();`, context);
  assert.ok(elements["#tracker"].innerHTML.includes("&lt;img src=x onerror=alert(1)&gt;"));
  assert.ok(!elements["#tracker"].innerHTML.includes("<img src=x"));
  assert.equal(elements["#login-form"].querySelector("button").disabled, true);
  assert.match(elements["#login-error"].textContent, /setup is incomplete/);
});

test("an explicit confirmed save writes to the student's Firestore document", async () => {
  const { elements, context } = makePage();
  let saved;
  context.fakeSetDoc = async (ref, value) => { saved = { ref, value }; };
  vm.runInNewContext(`documentRef = "trackers/student-uid";
    setDoc = fakeSetDoc;
    serverTimestamp = () => "server-time";
    tracker.colleges.uta.status = "Submitted";
    markChanged();`, context);
  assert.equal(elements["#notice"].textContent, "Unsaved changes…");
  vm.runInNewContext("save()", context);
  assert.equal(elements["#confirm-dialog"].open, true);
  assert.match(elements["#confirm-description"].textContent, /Save your changes/);
  assert.equal(saved, undefined);
  elements["#confirm-accept"].click();
  await vm.runInNewContext("saveChain", context);
  assert.equal(saved.ref, "trackers/student-uid");
  assert.equal(saved.value.data.colleges.uta.status, "Submitted");
  assert.equal(saved.value.updatedAt, "server-time");
  assert.equal(elements["#notice"].textContent, "Saved to your private tracker.");
});

test("canceling save or removal preserves tracker data", async () => {
  const { elements, context } = makePage();
  let writes = 0;
  context.fakeSetDoc = async () => { writes++; };
  vm.runInNewContext(`documentRef = "trackers/student-uid"; setDoc = fakeSetDoc;
    serverTimestamp = () => "server-time";
    tracker.scholarships.push({name:"Test",appliedDate:"2026-10-01"});
    markChanged();`, context);
  await vm.runInNewContext("save()", context);
  assert.equal(elements["#confirm-dialog"].open, true);
  elements["#confirm-cancel"].click();
  assert.equal(writes, 0);
  assert.equal(elements["#notice"].textContent, "Unsaved changes…");
  elements["#tracker"].click({
    target: { closest: () => ({ dataset: { action: "remove-scholarship", index: "0" } }) }
  });
  assert.equal(elements["#confirm-dialog"].open, true);
  elements["#confirm-cancel"].click();
  assert.equal(vm.runInNewContext("tracker.scholarships.length", context), 1);
});

test("confirming deletion removes a scholarship only from unsaved local state", () => {
  const { elements, context } = makePage();
  vm.runInNewContext(`tracker.scholarships.push({name:"Test",appliedDate:"2026-10-01"});`, context);
  elements["#tracker"].click({
    target: { closest: () => ({ dataset: { action: "remove-scholarship", index: "0" } }) }
  });
  assert.equal(vm.runInNewContext("tracker.scholarships.length", context), 1);
  elements["#confirm-accept"].click();
  assert.equal(vm.runInNewContext("tracker.scholarships.length", context), 0);
  assert.equal(elements["#notice"].textContent, "Unsaved changes…");
});

test("FAFSA and TASFA submissions cannot both be marked completed", () => {
  const { elements, context } = makePage();
  vm.runInNewContext(`tracker.aid.fafsaSubmitted = true; tracker.aid.choice = "FAFSA";`, context);
  const control = { dataset: { field: "aid.tasfaSubmitted" }, type: "checkbox", checked: true };
  control.closest = () => control;
  elements["#tracker"].input({ target: control });
  assert.equal(control.checked, false);
  assert.equal(vm.runInNewContext("tracker.aid.tasfaSubmitted", context), false);
  assert.match(elements["#notice"].textContent, /conflicts/);
});

test("individual aid non-filing flags remain independent and survive merging", () => {
  const { context } = makePage();
  const state = vm.runInNewContext(`mergeSaved({ aid: { fafsaOptOut: true, tasfaOptOut: false },
    honors: { program: "Plan II", status: "In progress" } })`, context);
  assert.equal(state.aid.fafsaOptOut, true);
  assert.equal(state.aid.tasfaOptOut, false);
  assert.equal(state.honors.program, "Plan II");
  assert.equal(state.honors.recommendationReceived, false);
});

test("confirmed save persists Honors progress and separate aid opt-outs", async () => {
  const { context, elements } = makePage();
  let saved;
  context.fakeSetDoc = async (_, payload) => { saved = payload.data; };
  await vm.runInNewContext(`documentRef = "trackers/student-uid"; setDoc = fakeSetDoc;
    serverTimestamp = () => "server-time";
    tracker.honors.program = "Plan II";
    tracker.honors.status = "Submitted";
    tracker.aid.fafsaOptOut = true;
    tracker.aid.tasfaSubmitted = true;
    markChanged(); save();`, context);
  elements["#confirm-accept"].click();
  await vm.runInNewContext("saveChain", context);
  assert.equal(saved.honors.status, "Submitted");
  assert.equal(saved.honors.program, "Plan II");
  assert.equal(saved.aid.fafsaOptOut, true);
  assert.equal(saved.aid.tasfaSubmitted, true);
});

test("saved legacy FAFSA and recommender data survive migration", () => {
  const { context } = makePage();
  const result = vm.runInNewContext(`mergeSaved({
    aid: {choice:"FAFSA",formSubmitted:true,formDate:"2026-10-02"},
    recommenders: [{name:"Counselor",role:"Counselor",assigned:"Rice",requested:"",resumeSent:true}]
  })`, context);
  assert.equal(result.aid.fafsaSubmitted, true);
  assert.equal(result.aid.fafsaDate, "2026-10-02");
  assert.equal(result.aid.tasfaSubmitted, false);
  assert.equal(result.recommenders[0].name, "Counselor");
  assert.ok(!("resumeSent" in result.recommenders[0]));
  assert.equal(result.colleges.uta.aidApplicationStatus, "Not started");
});

test("scholarships with an applied date show green submitted styling", () => {
  const { elements, context } = makePage();
  vm.runInNewContext(`tracker.scholarships.push(
    {name:"Pending",amount:0,deadline:"",appliedDate:"",notes:""},
    {name:"Sent",amount:0,deadline:"",appliedDate:"2026-10-01",notes:""}
  ); render();`, context);
  const html = elements["#tracker"].innerHTML;
  assert.match(html, /class="list-item scholarship submitted" data-scholarship="1"/);
  assert.match(html, /class="list-item scholarship " data-scholarship="0"/);
  assert.ok(!html.includes("Resume shared"));
});
