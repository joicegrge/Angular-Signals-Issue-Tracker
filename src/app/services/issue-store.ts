import { computed, effect, Injectable, linkedSignal, resource } from '@angular/core';
import {
  Issue,
  IssueId,
  IssuePriority,
  IssueStatus,
  IssueType,
  ISODateString,
  StoryPoints,
  TeamMember,
} from '../models/issue.model';

export const ISSUE_STORE_STORAGE_KEY = 'issue-tracker.saved-state.v1';

export type NewIssueInput = Omit<Issue, 'id' | 'status' | 'assigneeId'> & {
  assigneeId?: string | null;
};

export type IssueUpdate = Partial<
  Pick<Issue, 'title' | 'description' | 'type' | 'priority' | 'storyPoints' | 'dueDate'>
>;

export type IssueStoreResult =
  | { readonly success: true; readonly issue: Issue }
  | { readonly success: false; readonly error: string };

interface LoadedState {
  readonly issues: Issue[];
  readonly teamMembers: TeamMember[];
  readonly reopenedIssueIds: IssueId[];
}

interface PersistedState {
  readonly version: 1;
  readonly issues: Issue[];
  readonly reopenedIssueIds: IssueId[];
}

const ISSUE_TYPES = new Set<IssueType>(['Bug', 'Task', 'Story']);
const PRIORITIES = new Set<IssuePriority>(['Critical', 'High', 'Medium', 'Low']);
const STATUSES = new Set<IssueStatus>(['To Do', 'In Progress', 'In Review', 'Done']);
const STORY_POINTS = new Set<StoryPoints>([1, 2, 3, 5, 8]);

const ALLOWED_TRANSITIONS: Readonly<Record<IssueStatus, readonly IssueStatus[]>> = {
  'To Do': ['In Progress'],
  'In Progress': ['In Review', 'To Do'],
  'In Review': ['Done', 'In Progress'],
  Done: ['To Do'],
};

@Injectable({ providedIn: 'root' })
export class IssueStore {
  private readonly seedResource = resource({
    loader: ({ abortSignal }) => this.loadInitialState(abortSignal),
  });

  private readonly _issues = linkedSignal(() =>
    this.seedResource.hasValue() ? this.seedResource.value().issues : [],
  );

  private readonly _teamMembers = linkedSignal(() =>
    this.seedResource.hasValue() ? this.seedResource.value().teamMembers : [],
  );

  private readonly _reopenedIssueIds = linkedSignal(
    () =>
      new Set(
        this.seedResource.hasValue() ? this.seedResource.value().reopenedIssueIds : [],
      ),
  );

  readonly isReady = computed(
    () => this.seedResource.status() === 'resolved' || this.seedResource.status() === 'local',
  );

  readonly isLoading = computed(() => this.seedResource.isLoading());
  readonly error = computed(() => this.seedResource.error());

  readonly issues = computed<readonly Issue[] | undefined>(() =>
    this.isReady() ? this._issues() : undefined,
  );

  readonly teamMembers = computed<readonly TeamMember[] | undefined>(() =>
    this.isReady() ? this._teamMembers() : undefined,
  );

  readonly overdueIssues = computed<readonly Issue[] | undefined>(() => {
    const issues = this.issues();
    return issues?.filter((issue) => this.isIssueOverdue(issue));
  });

  readonly overdueIssueCount = computed(() => this.overdueIssues()?.length);

  readonly openIssueCount = computed(() =>
    this.issues()?.filter((issue) => issue.status !== 'Done').length,
  );

  readonly completionPercentage = computed(() => {
    const issues = this.issues();
    if (!issues) return undefined;

    const totalPoints = issues.reduce((total, issue) => total + issue.storyPoints, 0);
    if (totalPoints === 0) return 0;

    const completedPoints = issues
      .filter((issue) => issue.status === 'Done')
      .reduce((total, issue) => total + issue.storyPoints, 0);
    return Math.round((completedPoints / totalPoints) * 100);
  });

  allowedTransitionsFor(status: IssueStatus): readonly IssueStatus[] {
    return ALLOWED_TRANSITIONS[status];
  }

  constructor() {
    effect(() => {
      if (!this.isReady()) return;
      if (typeof localStorage === 'undefined') return;

      const state: PersistedState = {
        version: 1,
        issues: this._issues(),
        reopenedIssueIds: [...this._reopenedIssueIds()],
      };

      try {
        localStorage.setItem(ISSUE_STORE_STORAGE_KEY, JSON.stringify(state));
      } catch {
        // Storage can be unavailable or full; in-memory issue state remains usable.
      }
    });
  }

  addIssue(input: NewIssueInput): IssueStoreResult {
    if (!this.isReady()) return this.notReadyResult();
    if (!this.isValidStoryPoints(input.storyPoints)) {
      return this.failure('Story points must be 1, 2, 3, 5, or 8.');
    }
    if (!this.isValidDueDate(input.dueDate)) {
      return this.failure('Due date must be a valid ISO date or null.');
    }

    const assigneeId = input.assigneeId ?? null;
    if (assigneeId !== null && !this._teamMembers().some((member) => member.id === assigneeId)) {
      return this.failure('The selected assignee is not a team member.');
    }

    const issue: Issue = {
      ...input,
      id: this.nextIssueId(),
      status: 'To Do',
      assigneeId,
    };

    this._issues.update((issues) => [...issues, issue]);
    return { success: true, issue };
  }

  updateIssue(issueId: IssueId, updates: IssueUpdate): IssueStoreResult {
    if (!this.isReady()) return this.notReadyResult();

    const existingIssue = this._issues().find((issue) => issue.id === issueId);
    if (!existingIssue) return this.failure(`Issue ${issueId} was not found.`);
    if (updates.storyPoints !== undefined && !this.isValidStoryPoints(updates.storyPoints)) {
      return this.failure('Story points must be 1, 2, 3, 5, or 8.');
    }
    if (updates.dueDate !== undefined && !this.isValidDueDate(updates.dueDate)) {
      return this.failure('Due date must be a valid ISO date or null.');
    }

    const updatedIssue: Issue = { ...existingIssue, ...updates };
    this._issues.update((issues) =>
      issues.map((issue) => (issue.id === issueId ? updatedIssue : issue)),
    );

    if (updates.dueDate) {
      this._reopenedIssueIds.update((ids) => {
        const next = new Set(ids);
        next.delete(issueId);
        return next;
      });
    }

    return { success: true, issue: updatedIssue };
  }

  changeIssueStatus(issueId: IssueId, nextStatus: IssueStatus): IssueStoreResult {
    if (!this.isReady()) return this.notReadyResult();

    const issue = this._issues().find((candidate) => candidate.id === issueId);
    if (!issue) return this.failure(`Issue ${issueId} was not found.`);
    if (!STATUSES.has(nextStatus) || !ALLOWED_TRANSITIONS[issue.status].includes(nextStatus)) {
      return this.failure(`Cannot move an issue from ${issue.status} to ${nextStatus}.`);
    }

    if (nextStatus === 'In Progress') {
      if (issue.assigneeId === null) {
        return this.failure('Assign this issue to a team member before moving it to In Progress.');
      }
      if (this._reopenedIssueIds().has(issueId) && issue.dueDate === null) {
        return this.failure('Set a new due date before moving this reopened issue to In Progress.');
      }
      if (this.inProgressCountFor(issue.assigneeId, issueId) >= 3) {
        return this.failure('This team member already has 3 issues In Progress.');
      }
    }

    const reopening = issue.status === 'Done' && nextStatus === 'To Do';
    const updatedIssue: Issue = {
      ...issue,
      status: nextStatus,
      ...(reopening ? { dueDate: null } : {}),
    };

    this._issues.update((issues) =>
      issues.map((candidate) => (candidate.id === issueId ? updatedIssue : candidate)),
    );

    if (reopening) {
      this._reopenedIssueIds.update((ids) => new Set(ids).add(issueId));
    }

    return { success: true, issue: updatedIssue };
  }

  reassignIssue(issueId: IssueId, assigneeId: string | null): IssueStoreResult {
    if (!this.isReady()) return this.notReadyResult();

    const issue = this._issues().find((candidate) => candidate.id === issueId);
    if (!issue) return this.failure(`Issue ${issueId} was not found.`);
    if (assigneeId !== null && !this._teamMembers().some((member) => member.id === assigneeId)) {
      return this.failure('The selected assignee is not a team member.');
    }
    if (issue.status === 'In Progress' && assigneeId === null) {
      return this.failure('An issue In Progress cannot be unassigned.');
    }
    if (
      issue.status === 'In Progress' &&
      assigneeId !== null &&
      this.inProgressCountFor(assigneeId, issueId) >= 3
    ) {
      return this.failure('This team member already has 3 issues In Progress.');
    }

    const updatedIssue = { ...issue, assigneeId };
    this._issues.update((issues) =>
      issues.map((candidate) => (candidate.id === issueId ? updatedIssue : candidate)),
    );
    return { success: true, issue: updatedIssue };
  }

  isIssueOverdue(issue: Issue, today: ISODateString = this.todayAsISODate()): boolean {
    return issue.dueDate !== null && issue.dueDate < today && issue.status !== 'Done';
  }

  resetData(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(ISSUE_STORE_STORAGE_KEY);
      } catch {
        // The resource reload still restores the seed state in memory.
      }
    }
    this.seedResource.reload();
  }

  private async loadInitialState(abortSignal: AbortSignal): Promise<LoadedState> {
    const [issuesResponse, teamResponse] = await Promise.all([
      fetch('/issues.json', { signal: abortSignal }),
      fetch('/team.json', { signal: abortSignal }),
    ]);

    if (!issuesResponse.ok) {
      throw new Error(`Could not load issues.json (${issuesResponse.status}).`);
    }
    if (!teamResponse.ok) {
      throw new Error(`Could not load team.json (${teamResponse.status}).`);
    }

    const [rawIssues, rawTeam] = await Promise.all([issuesResponse.json(), teamResponse.json()]);
    if (!this.isIssueArray(rawIssues)) throw new Error('issues.json has an invalid data format.');
    if (!this.isTeamArray(rawTeam)) throw new Error('team.json has an invalid data format.');
    if (new Set(rawTeam.map((member) => member.id)).size !== rawTeam.length) {
      throw new Error('team.json contains duplicate team member IDs.');
    }

    const teamIds = new Set(rawTeam.map((member) => member.id));
    if (!this.hasValidAssignees(rawIssues, teamIds)) {
      throw new Error('issues.json contains an unknown assignee.');
    }
    if (!this.hasValidWorkInProgressState(rawIssues)) {
      throw new Error('issues.json violates the assignment or WIP limit for In Progress issues.');
    }

    const persistedState = this.readPersistedState(rawIssues, teamIds);
    return {
      issues: persistedState?.issues ?? rawIssues,
      teamMembers: rawTeam,
      reopenedIssueIds: persistedState?.reopenedIssueIds ?? [],
    };
  }

  private readPersistedState(seedIssues: Issue[], teamIds: ReadonlySet<string>): PersistedState | undefined {
    if (typeof localStorage === 'undefined') return undefined;

    try {
      const serialized = localStorage.getItem(ISSUE_STORE_STORAGE_KEY);
      if (!serialized) return undefined;

      const parsed: unknown = JSON.parse(serialized);
      if (
        !this.isRecord(parsed) ||
        parsed['version'] !== 1 ||
        !this.isIssueArray(parsed['issues']) ||
        !Array.isArray(parsed['reopenedIssueIds']) ||
        !parsed['reopenedIssueIds'].every((id) => typeof id === 'string')
      ) {
        return undefined;
      }

      const issues = parsed['issues'];
      const reopenedIssueIds = parsed['reopenedIssueIds'];
      if (
        !this.hasUniqueIssueIds(issues) ||
        !this.hasValidAssignees(issues, teamIds) ||
        !this.hasValidWorkInProgressState(issues) ||
        !reopenedIssueIds.every((id) => issues.some((issue) => issue.id === id))
      ) {
        return undefined;
      }

      return { version: 1, issues, reopenedIssueIds: reopenedIssueIds as IssueId[] };
    } catch {
      return undefined;
    }
  }

  private isIssueArray(value: unknown): value is Issue[] {
    return Array.isArray(value) && value.every((issue) => this.isIssue(issue)) && this.hasUniqueIssueIds(value);
  }

  private isIssue(value: unknown): value is Issue {
    if (!this.isRecord(value)) return false;
    return (
      typeof value['id'] === 'string' && /^TRK-\d+$/.test(value['id']) &&
      typeof value['title'] === 'string' &&
      typeof value['description'] === 'string' &&
      typeof value['type'] === 'string' && ISSUE_TYPES.has(value['type'] as IssueType) &&
      typeof value['priority'] === 'string' && PRIORITIES.has(value['priority'] as IssuePriority) &&
      typeof value['status'] === 'string' && STATUSES.has(value['status'] as IssueStatus) &&
      (value['assigneeId'] === null || typeof value['assigneeId'] === 'string') &&
      typeof value['storyPoints'] === 'number' && STORY_POINTS.has(value['storyPoints'] as StoryPoints) &&
      this.isValidDueDate(value['dueDate'])
    );
  }

  private isTeamArray(value: unknown): value is TeamMember[] {
    return (
      Array.isArray(value) &&
      value.every(
        (member) =>
          this.isRecord(member) &&
          typeof member['id'] === 'string' &&
          member['id'].length > 0 &&
          typeof member['name'] === 'string' &&
          member['name'].length > 0,
      )
    );
  }

  private hasUniqueIssueIds(issues: readonly Issue[]): boolean {
    return new Set(issues.map((issue) => issue.id)).size === issues.length;
  }

  private hasValidAssignees(issues: readonly Issue[], teamIds: ReadonlySet<string>): boolean {
    return issues.every(
      (issue) => issue.assigneeId === null || teamIds.has(issue.assigneeId),
    );
  }

  private hasValidWorkInProgressState(issues: readonly Issue[]): boolean {
    const counts = new Map<string, number>();
    for (const issue of issues) {
      if (issue.status !== 'In Progress') continue;
      if (issue.assigneeId === null) return false;
      const count = (counts.get(issue.assigneeId) ?? 0) + 1;
      if (count > 3) return false;
      counts.set(issue.assigneeId, count);
    }
    return true;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private isValidStoryPoints(value: number): value is StoryPoints {
    return STORY_POINTS.has(value as StoryPoints);
  }

  private isValidDueDate(value: unknown): value is ISODateString | null {
    if (value === null) return true;
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }

  private inProgressCountFor(assigneeId: string, excludingIssueId: IssueId): number {
    return this._issues().filter(
      (issue) =>
        issue.id !== excludingIssueId &&
        issue.status === 'In Progress' &&
        issue.assigneeId === assigneeId,
    ).length;
  }

  private nextIssueId(): IssueId {
    const highestId = this._issues().reduce((highest, issue) => {
      const numericId = Number(issue.id.slice('TRK-'.length));
      return Number.isFinite(numericId) ? Math.max(highest, numericId) : highest;
    }, 0);
    return `TRK-${highestId + 1}`;
  }

  private todayAsISODate(): ISODateString {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}` as ISODateString;
  }

  private notReadyResult(): IssueStoreResult {
    return this.failure('Issue data is not ready yet.');
  }

  private failure(error: string): IssueStoreResult {
    return { success: false, error };
  }
}
