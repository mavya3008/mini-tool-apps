export const priorities = [
  ["commonApp", "Create Common App account and complete profile"],
  ["applyTexas", "Create ApplyTexas account and complete profile"],
  ["aidForm", "Complete FAFSA or TASFA (whichever applies)"],
  ["cssProfile", "Complete CSS Profile (Rice, Vanderbilt, UChicago)"],
  ["recommendations", "Build per-college recommendation to-do list"],
  ["scholarships", "Apply for scholarships and track submissions"],
  ["visits", "Mark college visits done or pending"],
  ["submitAid", "Submit financial aid applications"],
  ["resume", "Create and finalize student resume"]
];

export const platforms = [
  { id: "common", name: "Common App", colleges: "Rice, Baylor, Vanderbilt, University of Chicago; alternate for UT Austin, UT Dallas, Texas A&M, University of Houston", fields: ["account", "profile"] },
  { id: "texas", name: "ApplyTexas", colleges: "UT Austin, UT Dallas, Texas A&M, University of Houston", fields: ["account", "profile"] },
  { id: "uc", name: "UC Application", colleges: "UCLA (separate portal)", fields: ["account", "profile"] },
  { id: "coalition", name: "Coalition by Scoir (optional)", colleges: "Vanderbilt, University of Chicago; not needed if using Common App", fields: ["account", "profile"] }
];

export const colleges = [
  {
    id: "uta", name: "UT Austin", platforms: ["ApplyTexas", "Common App"],
    early: "EA: Oct 15, 2026", regular: "RD: Dec 1, 2026",
    rounds: ["EA", "RD"], recommendation: "Optional: up to 2, not from family; some Honors programs require 1", recTarget: 2
  },
  {
    id: "rice", name: "Rice University", platforms: ["Common App"],
    early: "ED I: Nov 1, 2026", regular: "ED II / RD: Jan 4, 2027",
    rounds: ["ED I", "ED II", "RD"], recommendation: "Required: 1 school counselor + 2 teachers", recTarget: 3,
    css: "ED I: Nov 1, 2026; ED II: Jan 4, 2027; RD: Jan 4, 2027 (confirm on rice.edu)"
  },
  {
    id: "utd", name: "UT Dallas", platforms: ["ApplyTexas", "Common App"],
    early: "Priority: Dec 1, 2026", regular: "Regular: May 1, 2027 (rolling)",
    rounds: ["Priority", "Regular"], recommendation: "Optional: up to 3 (any combination)", recTarget: 3
  },
  {
    id: "tamu", name: "Texas A&M (College Station)", platforms: ["ApplyTexas", "Common App"],
    early: "No early round", regular: "Dec 1, 2026 (documents due Dec 15)",
    rounds: ["Regular"], recommendation: "Not required for standard admission; Honors or scholarships may ask separately", recTarget: null
  },
  {
    id: "uh", name: "University of Houston", platforms: ["ApplyTexas", "Common App"],
    early: "Scholarship priority: Nov 2, 2026", regular: "Final: May 31, 2027",
    rounds: ["Scholarship priority", "Regular"], recommendation: "Not used for standard review; essay and activities instead", recTarget: null
  },
  {
    id: "baylor", name: "Baylor University", platforms: ["Common App", "Baylor App"],
    early: "ED / EA: Nov 1, 2026", regular: "RD: Feb 1, 2027",
    rounds: ["ED", "EA", "RD"], recommendation: "Optional: about 2 suggested", recTarget: 2
  },
  {
    id: "ucla", name: "UCLA", platforms: ["UC Application"],
    early: "No early round", regular: "Filing window closes Nov 30, 2026",
    rounds: ["Regular"], recommendation: "Not accepted; complete 4 of 8 UC Personal Insight Questions (350 words each)", recTarget: null
  },
  {
    id: "vandy", name: "Vanderbilt University", platforms: ["Common App", "Coalition by Scoir"],
    early: "ED I: Nov 1, 2026", regular: "ED II / RD: Jan 1, 2027",
    rounds: ["ED I", "ED II", "RD"], recommendation: "Required: 1 counselor + 2 teachers; optional fourth allowed", recTarget: 3,
    css: "ED I: Nov 1, 2026; ED II: Jan 1, 2027; RD: Feb 1, 2027"
  },
  {
    id: "uchicago", name: "University of Chicago", platforms: ["Common App", "Coalition by Scoir"],
    early: "ED I / EA: Nov 2, 2026", regular: "ED II / RD: Jan 4, 2027",
    rounds: ["ED I", "EA", "ED II", "RD"], recommendation: "Required: 2 teacher evaluations + secondary school (counselor) report", recTarget: 2,
    css: "ED I / EA: Nov 2, 2026; ED II / RD: Jan 4, 2027"
  }
];

export const recommenderDefaults = [
  { name: "School Counselor", role: "Counselor", assigned: "Rice, Vanderbilt, UChicago", requested: "" },
  { name: "Teacher 1", role: "Core subject", assigned: "", requested: "" },
  { name: "Teacher 2", role: "Core subject", assigned: "", requested: "" },
  { name: "Optional / extra recommender", role: "", assigned: "UT Austin, UT Dallas, Baylor", requested: "" }
];

export function initialTracker() {
  return {
    priorities: Object.fromEntries(priorities.map(([id]) => [id, false])),
    platforms: Object.fromEntries(platforms.map(({ id }) => [id, { account: false, profile: false }])),
    ucQuestions: 0,
    aid: {
      choice: "", fafsaSubmitted: false, fafsaDate: "", fafsaOptOut: false,
      tasfaSubmitted: false, tasfaDate: "", tasfaOptOut: false, optOutCompleted: false,
      cssSubmitted: false, cssDate: "", notes: ""
    },
    honors: {
      program: "", deadline: "", deadlineVerified: false,
      status: "Not started", submittedDate: "", confirmation: "",
      recommendationRequired: false, recommendationRequested: false,
      recommendationReceived: false, notes: ""
    },
    recommenders: recommenderDefaults.map(item => ({ ...item })),
    scholarships: [],
    colleges: Object.fromEntries(colleges.map(({ id }) => [id, {
      platform: "", round: "", status: "Not started", submittedDate: "", confirmation: "",
      deadlineVerified: false, recCount: 0, recFrom: "", recStatus: "Not started",
      visitStatus: "Pending", visitDate: "", visitNotes: "",
      aidApplicationStatus: "Not started", aidApplicationDate: "",
      awardReceived: false, netPrice: "", appealFiled: false, notes: ""
    }]))
  };
}

export function scholarshipCount(tracker) {
  return tracker.scholarships.filter(item => item.appliedDate).length;
}
