# 🚀 Angular Signals Issue Tracker

A modern, Kanban-style **Issue Tracker** built using **Angular 22** and its latest signal-based APIs. The application helps teams organize, track, prioritize, and manage bugs, tasks, and stories through a clean, dark-themed project board.

🔗 **GitHub Repository:** [Angular-Signals-Issue-Tracker](https://github.com/joicegrge/Angular-Signals-Issue-Tracker)

---

## 📌 Project Overview

The Angular Signals Issue Tracker is a single-page application designed to simplify team issue management.

It provides a Kanban board with four workflow stages, allowing users to create issues, assign team members, update priorities, monitor deadlines, and track project progress.

The application follows a signal-driven state management architecture using Angular's built-in APIs. Business rules are centralized in an `IssueStore` service to maintain consistent application behavior.

### ✨ Key Highlights

- Built with Angular 22 and standalone components.
- Signal-based state management using Angular Signals.
- Four-column Kanban board.
- Issue creation, editing, assignment, and workflow management.
- Search and combined filtering.
- Work-in-progress (WIP) limits and workflow validation.
- Automatic overdue detection and completion tracking.
- Persistent data using browser localStorage.
- Responsive, dark-themed user interface.

---

## 🖥️ Application Features

### 1. Kanban Issue Board

The main dashboard organizes issues into four workflow columns:

| Column | Description |
|---|---|
| To Do | Issues waiting to be started |
| In Progress | Issues currently being worked on |
| In Review | Issues awaiting review |
| Done | Completed issues |

Each column displays:
- Total number of issues.
- Combined story points.
- Issue cards sorted by priority and due date.

Each issue card displays its ID, title, type, priority, assignee, and due date. Overdue issues are highlighted with an overdue indicator.

### 2. Dashboard Summary

A summary section provides an overview of project progress:

- **Open Issues:** Total issues that are not completed.
- **Overdue Issues:** Issues with deadlines earlier than today that are not completed.
- **Completion Percentage:** Calculated using completed story points against total story points.

The summary always reflects all issues, even when board filters are active.

### 3. Search and Filters

Users can quickly locate issues using:

- Search by issue ID or title.
- Case-insensitive search.
- Debounced search with a 300 ms delay.
- Filter by assignee.
- Filter by priority.
- Combined filtering across all Kanban columns.
- Clear filters option.

The board also displays the number of matching issues against the total number of issues.

### 4. Issue Details and Editing

Selecting an issue opens a separate detail panel containing its information.

Users can:
- View all issue details.
- Edit the issue title.
- Change priority.
- Reassign the issue.
- Update story points.
- Save or cancel modifications.
- Change status using only permitted workflow transitions.

Unsaved changes are discarded when the user cancels or selects another issue.

### 5. Create New Issues

The application provides a New Issue form with the following fields:

- Title
- Description
- Issue type (Bug, Task, Story)
- Priority (Critical, High, Medium, Low)
- Story points (1, 2, 3, 5, 8)
- Due date
- Assignee (optional)

**Form validation includes:**
- Title is mandatory.
- Title must contain at least five characters.
- Due date cannot be in the past.
- Save remains disabled while the form is invalid.
- New issues receive the next sequential issue ID.
- Newly created issues start in the To Do status.

### 6. Data Persistence and Reset

- Initial issue and team data are loaded from JSON files.
- Changes are saved in browser localStorage.
- Data remains available after refreshing the page.
- Reset Data clears saved modifications and restores the original seed data.
- Loading and error states are handled when retrieving initial data.

---

## ⚙️ Business Rules and Validation

The application enforces the following business rules centrally through the IssueStore service.

| Rule | Implementation |
|---|---|
| BR-1: Workflow | Only permitted status transitions are allowed. |
| BR-2: Assignee validation | An issue cannot enter In Progress without an assignee or be unassigned while In Progress. |
| BR-3: WIP limit | Each team member can have a maximum of three In Progress issues. |
| BR-4: Story points | Only 1, 2, 3, 5, and 8 are accepted. |
| BR-5: Reopening | Reopening a completed issue clears its due date. A new due date is required before moving it to In Progress. |
| BR-6: Overdue detection | An issue is overdue when its due date is before today and its status is not Done. |
| BR-7: Completion percentage | Completed story points divided by total story points, multiplied by 100 and rounded to the nearest whole number. |
| BR-8: Summary calculations | Summary metrics use all issues, while board counts and filtered issue totals use the filtered list. |

### Allowed Workflow Transitions

```text
To Do
  └── In Progress
        ├── In Review
        │     ├── Done
        │     └── In Progress
        └── To Do

Done
  └── To Do (Reopen)
```

Invalid transitions are prevented by the application.

---

## 🛠️ Technology Stack

| Technology | Purpose |
|---|---|
| Angular 22 | Frontend framework |
| TypeScript | Application development |
| Angular Signals | Reactive state management |
| HTML5 | Application structure |
| CSS3 | Styling and layout |
| JSON | Initial issue and team data |
| Browser localStorage | Client-side data persistence |
| Angular Testing | Unit testing |

### Angular Concepts Used

This project demonstrates the use of modern Angular APIs:

- `signal()` – Private writable state.
- `computed()` – Derived and reactive values.
- `linkedSignal()` – State linked to other reactive values.
- `input()` and `input.required()` – Component inputs.
- `output()` – Component event communication.
- `model()` – Two-way component model binding.
- `resource()` – Asynchronous JSON data loading.
- `effect()` – Persistence side effects.

Additional implementation practices:

- Standalone components.
- OnPush change detection.
- Immutable state updates.
- Reusable components.
- Centralized business logic.
- Modern Angular control flow using `@if` and `@for`.

---

## 📂 Project Structure

```text
Issue Tracker/
│
├── public/
│   ├── issues.json
│   └── team.json
│
├── src/
│   ├── app/
│   │   ├── components/
│   │   │   ├── issue-board/
│   │   │   ├── issue-card/
│   │   │   ├── issue-detail-panel/
│   │   │   ├── new-issue-form/
│   │   │   └── summary-bar/
│   │   │
│   │   ├── models/
│   │   │   └── issue.model.ts
│   │   │
│   │   ├── services/
│   │   │   ├── issue-store.ts
│   │   │   └── issue-store.spec.ts
│   │   │
│   │   ├── app.config.ts
│   │   ├── app.html
│   │   ├── app.ts
│   │   └── app.css
│   │
│   ├── index.html
│   ├── main.ts
│   └── styles.css
│
├── AGENTS.md
├── angular.json
├── package.json
├── tsconfig.json
└── README.md
```

### Component Responsibilities

| Component | Responsibility |
|---|---|
| IssueBoard | Main Kanban board, search, and filters |
| IssueCard | Reusable issue card |
| IssueDetailPanel | Issue details, editing, and status changes |
| NewIssueForm | Creating and validating new issues |
| SummaryBar | Project summary metrics |
| IssueStore | Centralized application state and business rules |

---

## 🚀 Getting Started

### Prerequisites

Make sure you have the following installed:

- [Node.js](https://nodejs.org/)
- npm (included with Node.js)
- [Angular CLI](https://angular.dev/tools/cli)

### 1. Clone the Repository

```bash
git clone https://github.com/joicegrge/Angular-Signals-Issue-Tracker.git
```

### 2. Navigate to the Project

```bash
cd Angular-Signals-Issue-Tracker
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Start the Development Server

```bash
npx ng serve
```

Open your browser and navigate to:

```text
http://localhost:4200
```

---

## 🧪 Testing

The project includes unit tests for the application and its core functionality.

Run the test suite:

```bash
npm test
```

Build the application:

```bash
npm run build
```

---

## 💾 Data Storage

This is a frontend-only application.

- `public/issues.json` contains the initial issue records.
- `public/team.json` contains the team member records.
- The `IssueStore` service manages application state.
- Browser localStorage stores changes made during application usage.

No external backend or database is required to run the application.

---

## 🎯 Project Objective

This project was developed as part of the **Angular Signals Assignment – Issue Tracker (November 20, 2026)**.

The objective was to demonstrate practical knowledge of Angular 22, modern signal-based APIs, reusable standalone components, centralized state management, business-rule enforcement, reactive UI updates, data persistence, and unit testing.

---

## 👨‍💻 Author

**Joice George**

- GitHub: [@joicegrge](https://github.com/joicegrge)
- Project: [Angular Signals Issue Tracker](https://github.com/joicegrge/Angular-Signals-Issue-Tracker)

---

⭐ If you find this project useful, feel free to explore the repository and its implementation.
