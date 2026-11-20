import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Issue, IssueId, IssuePriority, IssueStatus } from '../../models/issue.model';
import { map, of, switchMap, timer } from 'rxjs';
import { IssueStore } from '../../services/issue-store';
import { IssueDetailPanel } from '../issue-detail-panel/issue-detail-panel';
import { IssueCard } from '../issue-card/issue-card';
import { NewIssueForm } from '../new-issue-form/new-issue-form';
import { SummaryBar } from '../summary-bar/summary-bar';

type AssigneeFilter =
  | { readonly kind: 'all' }
  | { readonly kind: 'unassigned' }
  | { readonly kind: 'member'; readonly memberId: string };

type PriorityFilter = IssuePriority | 'all';

interface SearchRequest {
  readonly query: string;
  readonly revision: number;
  readonly immediate: boolean;
}

interface BoardCard {
  readonly issue: Issue;
  readonly assigneeName: string;
  readonly overdue: boolean;
}

interface BoardColumn {
  readonly status: IssueStatus;
  readonly cards: readonly BoardCard[];
  readonly issueCount: number;
  readonly storyPointTotal: number;
}

const COLUMN_STATUSES: readonly IssueStatus[] = ['To Do', 'In Progress', 'In Review', 'Done'];

const PRIORITY_ORDER: Readonly<Record<Issue['priority'], number>> = {
  Critical: 0,
  High: 1,
  Medium: 2,
  Low: 3,
};

@Component({
  selector: 'app-issue-board',
  standalone: true,
  imports: [IssueCard, IssueDetailPanel, NewIssueForm, SummaryBar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './issue-board.html',
  styleUrl: './issue-board.css',
})
export class IssueBoard {
  private readonly issueStore = inject(IssueStore);

  readonly isLoading = this.issueStore.isLoading;
  readonly error = this.issueStore.error;
  readonly teamMembers = computed(() => this.issueStore.teamMembers() ?? []);
  readonly openIssueCount = this.issueStore.openIssueCount;
  readonly overdueIssueCount = this.issueStore.overdueIssueCount;
  readonly completionPercentage = this.issueStore.completionPercentage;
  readonly totalIssueCount = computed(() => this.issueStore.issues()?.length ?? 0);
  readonly priorities: readonly IssuePriority[] = ['Critical', 'High', 'Medium', 'Low'];
  readonly selectedIssueId = signal<IssueId | null>(null);
  readonly selectedIssue = computed(() => {
    const selectedId = this.selectedIssueId();
    return selectedId ? this.issueStore.issues()?.find((issue) => issue.id === selectedId) : undefined;
  });
  readonly isNewIssueFormOpen = signal(false);

  readonly searchText = signal('');
  readonly assigneeFilter = signal<AssigneeFilter>({ kind: 'all' });
  readonly priorityFilter = signal<PriorityFilter>('all');

  private readonly searchRequest = signal<SearchRequest>({
    query: '',
    revision: 0,
    immediate: true,
  });
  private readonly clearRevision = signal(0);
  private readonly appliedSearch = toSignal(
    toObservable(this.searchRequest).pipe(
      switchMap((request) =>
        request.immediate ? of(request) : timer(300).pipe(map(() => request)),
      ),
    ),
    { initialValue: { query: '', revision: 0, immediate: true } },
  );

  readonly debouncedSearch = computed(() => {
    const applied = this.appliedSearch();
    return applied.revision < this.clearRevision() ? '' : applied.query;
  });

  readonly assigneeFilterValue = computed(() => {
    const filter = this.assigneeFilter();
    if (filter.kind === 'member') return `member:${filter.memberId}`;
    return filter.kind;
  });

  readonly hasActiveFilters = computed(
    () =>
      this.searchText().trim().length > 0 ||
      this.assigneeFilter().kind !== 'all' ||
      this.priorityFilter() !== 'all',
  );

  readonly filteredIssues = computed<readonly Issue[] | undefined>(() => {
    const issues = this.issueStore.issues();
    if (!issues) return undefined;

    const query = this.debouncedSearch().trim().toLocaleLowerCase();
    const assigneeFilter = this.assigneeFilter();
    const priorityFilter = this.priorityFilter();

    return issues.filter((issue) => {
      const matchesQuery =
        query.length === 0 ||
        issue.id.toLocaleLowerCase().includes(query) ||
        issue.title.toLocaleLowerCase().includes(query);
      const matchesAssignee =
        assigneeFilter.kind === 'all' ||
        (assigneeFilter.kind === 'unassigned' && issue.assigneeId === null) ||
        (assigneeFilter.kind === 'member' && issue.assigneeId === assigneeFilter.memberId);
      const matchesPriority = priorityFilter === 'all' || issue.priority === priorityFilter;

      return matchesQuery && matchesAssignee && matchesPriority;
    });
  });

  readonly filteredIssueCount = computed(() => this.filteredIssues()?.length ?? 0);

  readonly columns = computed<readonly BoardColumn[] | undefined>(() => {
    const issues = this.filteredIssues();
    const teamMembers = this.issueStore.teamMembers();
    if (!issues || !teamMembers) return undefined;

    const memberNames = new Map(teamMembers.map((member) => [member.id, member.name]));

    return COLUMN_STATUSES.map((status) => {
      const cards = issues
        .filter((issue) => issue.status === status)
        .slice()
        .sort((left, right) => this.compareIssues(left, right))
        .map((issue) => ({
          issue,
          assigneeName: issue.assigneeId
            ? (memberNames.get(issue.assigneeId) ?? 'Unassigned')
            : 'Unassigned',
          overdue: this.issueStore.isIssueOverdue(issue),
        }));

      return {
        status,
        cards,
        issueCount: cards.length,
        storyPointTotal: cards.reduce((total, card) => total + card.issue.storyPoints, 0),
      };
    });
  });

  onSearchInput(event: Event): void {
    const query = (event.target as HTMLInputElement).value;
    this.searchText.set(query);
    this.searchRequest.update((request) => ({
      query,
      revision: request.revision + 1,
      immediate: false,
    }));
  }

  onAssigneeFilterChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (value === 'all' || value === 'unassigned') {
      this.assigneeFilter.set({ kind: value });
    } else if (value.startsWith('member:')) {
      this.assigneeFilter.set({ kind: 'member', memberId: value.slice('member:'.length) });
    }
  }

  onPriorityFilterChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (value === 'all' || this.priorities.includes(value as IssuePriority)) {
      this.priorityFilter.set(value as PriorityFilter);
    }
  }

  clearFilters(): void {
    const revision = this.searchRequest().revision + 1;
    this.searchText.set('');
    this.assigneeFilter.set({ kind: 'all' });
    this.priorityFilter.set('all');
    this.clearRevision.set(revision);
    this.searchRequest.set({ query: '', revision, immediate: true });
  }

  selectIssue(issue: Issue): void {
    this.isNewIssueFormOpen.set(false);
    this.selectedIssueId.set(issue.id);
  }

  openNewIssueForm(): void {
    this.selectedIssueId.set(null);
    this.isNewIssueFormOpen.set(true);
  }

  closeIssueDetail(): void {
    this.selectedIssueId.set(null);
  }

  closeNewIssueForm(): void {
    this.isNewIssueFormOpen.set(false);
  }

  resetData(): void {
    this.issueStore.resetData();
  }

  private compareIssues(left: Issue, right: Issue): number {
    const priorityDifference = PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority];
    if (priorityDifference !== 0) return priorityDifference;

    if (left.dueDate === null && right.dueDate !== null) return 1;
    if (left.dueDate !== null && right.dueDate === null) return -1;
    if (left.dueDate !== null && right.dueDate !== null) {
      const dueDateDifference = left.dueDate.localeCompare(right.dueDate);
      if (dueDateDifference !== 0) return dueDateDifference;
    }

    return left.id.localeCompare(right.id);
  }
}
