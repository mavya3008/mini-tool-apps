import test from "node:test";
import assert from "node:assert/strict";
import { colleges, platforms, priorities, initialTracker, scholarshipCount } from "./data.js";

test("all nine listed colleges and their tracking fields are present", () => {
  assert.deepEqual(colleges.map(college => college.name), [
    "UT Austin", "Rice University", "UT Dallas", "Texas A&M (College Station)",
    "University of Houston", "Baylor University", "UCLA", "Vanderbilt University",
    "University of Chicago"
  ]);
  const tracker = initialTracker();
  assert.equal(Object.keys(tracker.colleges).length, 9);
  for (const college of colleges) {
    assert.ok(college.early && college.regular && college.recommendation);
    assert.ok(college.platforms.length && college.rounds.length);
    assert.deepEqual(Object.keys(tracker.colleges[college.id]), [
      "platform", "round", "status", "submittedDate", "confirmation",
      "deadlineVerified", "recCount", "recFrom", "recStatus",
      "visitStatus", "visitDate", "visitNotes",
      "aidApplicationStatus", "aidApplicationDate", "awardReceived",
      "netPrice", "appealFiled", "notes"
    ]);
  }
  assert.equal(colleges.filter(college => college.css).length, 3);
});

test("initial checklist covers platforms, priorities, aid, and recommender planner", () => {
  const tracker = initialTracker();
  assert.equal(priorities.length, 9);
  assert.equal(Object.keys(tracker.priorities).length, 9);
  assert.equal(Object.keys(tracker.platforms).length, platforms.length);
  assert.equal(tracker.recommenders.length, 4);
  assert.deepEqual(Object.keys(tracker.aid), [
    "choice", "fafsaSubmitted", "fafsaDate", "fafsaOptOut", "tasfaSubmitted", "tasfaDate", "tasfaOptOut",
    "optOutCompleted", "cssSubmitted", "cssDate", "notes"
  ]);
  assert.deepEqual(Object.keys(tracker.honors), [
    "program", "deadline", "deadlineVerified", "status", "submittedDate",
    "confirmation", "recommendationRequired", "recommendationRequested",
    "recommendationReceived", "notes"
  ]);
  assert.ok(tracker.recommenders.every(item => !("resumeSent" in item)));
  assert.equal(tracker.ucQuestions, 0);
});

test("scholarship count includes only applications with an applied date", () => {
  const tracker = initialTracker();
  tracker.scholarships.push({ name: "A", appliedDate: "" }, { name: "B", appliedDate: "2026-10-01" });
  assert.equal(scholarshipCount(tracker), 1);
});

test("published deadline reference and CSS priority dates match the checklist", () => {
  assert.deepEqual(colleges.map(({ early, regular }) => [early, regular]), [
    ["EA: Oct 15, 2026", "RD: Dec 1, 2026"],
    ["ED I: Nov 1, 2026", "ED II / RD: Jan 4, 2027"],
    ["Priority: Dec 1, 2026", "Regular: May 1, 2027 (rolling)"],
    ["No early round", "Dec 1, 2026 (documents due Dec 15)"],
    ["Scholarship priority: Nov 2, 2026", "Final: May 31, 2027"],
    ["ED / EA: Nov 1, 2026", "RD: Feb 1, 2027"],
    ["No early round", "Filing window closes Nov 30, 2026"],
    ["ED I: Nov 1, 2026", "ED II / RD: Jan 1, 2027"],
    ["ED I / EA: Nov 2, 2026", "ED II / RD: Jan 4, 2027"]
  ]);
  assert.deepEqual(colleges.filter(college => college.css).map(college => college.css), [
    "ED I: Nov 1, 2026; ED II: Jan 4, 2027; RD: Jan 4, 2027 (confirm on rice.edu)",
    "ED I: Nov 1, 2026; ED II: Jan 1, 2027; RD: Feb 1, 2027",
    "ED I / EA: Nov 2, 2026; ED II / RD: Jan 4, 2027"
  ]);
});
