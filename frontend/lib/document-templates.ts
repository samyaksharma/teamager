// Built-in document templates. `build` returns HTML in the shapes the editor understands
// (headings, lists, task lists, tables, blockquotes).

export interface DocumentTemplate {
  id: string
  name: string
  description: string
  defaultTitle: (date: Date) => string
  build: (date: Date) => string
}

const formatDate = (date: Date) =>
  date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

const tasks = (items: string[]) =>
  `<ul data-type="taskList">${items
    .map((text) => `<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>${text}</p></div></li>`)
    .join("")}</ul>`

const bullets = (items: string[]) => `<ul>${items.map((t) => `<li><p>${t}</p></li>`).join("")}</ul>`

const numbered = (items: string[]) => `<ol>${items.map((t) => `<li><p>${t}</p></li>`).join("")}</ol>`

const table = (header: string[], rows: string[][]) =>
  `<table><tbody><tr>${header.map((h) => `<th><p>${h}</p></th>`).join("")}</tr>${rows
    .map((r) => `<tr>${r.map((c) => `<td><p>${c}</p></td>`).join("")}</tr>`)
    .join("")}</tbody></table>`

export const BLANK_TEMPLATE_ID = "blank"

export const DOCUMENT_TEMPLATES: DocumentTemplate[] = [
  {
    id: BLANK_TEMPLATE_ID,
    name: "Blank",
    description: "Start with an empty page.",
    defaultTitle: () => "Untitled",
    build: () => "",
  },
  {
    id: "meeting-notes",
    name: "Meeting notes",
    description: "Agenda, discussion, decisions and action items.",
    defaultTitle: (d) => `Meeting notes - ${formatDate(d)}`,
    build: (d) =>
      [
        `<h1>Meeting notes</h1>`,
        `<p><strong>Date:</strong> ${escapeHtml(formatDate(d))}</p>`,
        `<p><strong>Attendees:</strong> </p>`,
        `<h2>Agenda</h2>`,
        numbered(["Topic one", "Topic two"]),
        `<h2>Discussion</h2>`,
        `<p></p>`,
        `<h2>Decisions</h2>`,
        bullets(["Decision"]),
        `<h2>Action items</h2>`,
        tasks(["Owner - action - due date"]),
      ].join(""),
  },
  {
    id: "design-doc",
    name: "Design doc",
    description: "Context, goals, proposal, alternatives and open questions.",
    defaultTitle: () => "Design doc",
    build: (d) =>
      [
        `<h1>Design doc</h1>`,
        `<p><strong>Author:</strong> &nbsp;&nbsp; <strong>Status:</strong> Draft &nbsp;&nbsp; <strong>Last updated:</strong> ${escapeHtml(formatDate(d))}</p>`,
        `<h2>Context</h2>`,
        `<p>What problem are we solving, and why now?</p>`,
        `<h2>Goals and non-goals</h2>`,
        bullets(["Goal", "Non-goal"]),
        `<h2>Proposal</h2>`,
        `<p>Describe the approach.</p>`,
        `<h2>Alternatives considered</h2>`,
        table(["Option", "Pros", "Cons"], [["Option A", "", ""], ["Option B", "", ""]]),
        `<h2>Risks and open questions</h2>`,
        bullets(["Question"]),
        `<h2>Rollout plan</h2>`,
        tasks(["Step one"]),
      ].join(""),
  },
  {
    id: "sprint-planning",
    name: "Sprint planning",
    description: "Sprint goal, scope, capacity and risks.",
    defaultTitle: (d) => `Sprint planning - ${formatDate(d)}`,
    build: (d) =>
      [
        `<h1>Sprint planning</h1>`,
        `<p><strong>Sprint start:</strong> ${escapeHtml(formatDate(d))} &nbsp;&nbsp; <strong>Sprint end:</strong> </p>`,
        `<h2>Sprint goal</h2>`,
        `<blockquote><p>One sentence describing what this sprint should achieve.</p></blockquote>`,
        `<h2>Capacity</h2>`,
        table(["Person", "Days available", "Notes"], [["", "", ""], ["", "", ""]]),
        `<h2>Committed work</h2>`,
        tasks(["Task - owner - estimate"]),
        `<h2>Stretch</h2>`,
        tasks(["Task"]),
        `<h2>Risks and dependencies</h2>`,
        bullets(["Risk"]),
      ].join(""),
  },
  {
    id: "retrospective",
    name: "Retrospective",
    description: "What went well, what didn't, and what to change.",
    defaultTitle: (d) => `Retrospective - ${formatDate(d)}`,
    build: (d) =>
      [
        `<h1>Retrospective</h1>`,
        `<p><strong>Date:</strong> ${escapeHtml(formatDate(d))}</p>`,
        `<h2>What went well</h2>`,
        bullets([""]),
        `<h2>What didn't go well</h2>`,
        bullets([""]),
        `<h2>What we'll change</h2>`,
        tasks(["Change - owner"]),
      ].join(""),
  },
  {
    id: "project-brief",
    name: "Project brief",
    description: "Overview, objectives, scope, milestones and stakeholders.",
    defaultTitle: () => "Project brief",
    build: () =>
      [
        `<h1>Project brief</h1>`,
        `<h2>Overview</h2>`,
        `<p>A short summary of the project.</p>`,
        `<h2>Objectives</h2>`,
        bullets(["Objective"]),
        `<h2>Scope</h2>`,
        `<p><strong>In scope:</strong> </p><p><strong>Out of scope:</strong> </p>`,
        `<h2>Milestones</h2>`,
        table(["Milestone", "Owner", "Target date"], [["", "", ""], ["", "", ""]]),
        `<h2>Stakeholders</h2>`,
        bullets(["Name - role"]),
      ].join(""),
  },
]

export const getTemplate = (id: string) => DOCUMENT_TEMPLATES.find((t) => t.id === id) ?? DOCUMENT_TEMPLATES[0]
