import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Issue, IssueStatus, TeamMember } from './models/issue.model';
import { IssueStore } from './services/issue-store';
import { App } from './app';
import { IssueBoard } from './components/issue-board/issue-board';

const teamMembers: TeamMember[] = [
  { id: 'TM-001', name: 'Maya Chen' },
  { id: 'TM-002', name: 'Arjun Patel' },
];

function issue(
  id: string,
  status: IssueStatus,
  priority: Issue['priority'],
  dueDate: Issue['dueDate'],
  assigneeId: string | null = 'TM-001',
  storyPoints: Issue['storyPoints'] = 2,
): Issue {
  return {
    id: id as Issue['id'],
    title: `Issue ${id}`,
    description: `Description for ${id}`,
    type: 'Task',
    priority,
    status,
    assigneeId,
    storyPoints,
    dueDate,
  };
}

describe('IssueBoard', () => {
  let fixture: ComponentFixture<IssueBoard>;
  let overduePredicate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    const issues = [
      issue('TRK-101', 'To Do', 'High', '2026-12-05', 'TM-001', 3),
      issue('TRK-102', 'To Do', 'Critical', '2026-12-10', null, 5),
      issue('TRK-103', 'To Do', 'High', '2026-12-02', 'TM-002', 1),
      issue('TRK-104', 'To Do', 'Low', null, 'TM-001', 2),
      issue('TRK-105', 'In Progress', 'Medium', '2026-12-08', 'TM-001', 8),
      issue('TRK-106', 'In Review', 'High', '2026-12-09', 'TM-002', 3),
      issue('TRK-107', 'Done', 'Low', '2026-11-19', 'TM-001', 1),
    ];
    overduePredicate = vi.fn((candidate: Issue) => candidate.id === 'TRK-105');
    const mockStore = {
      issues: signal<readonly Issue[] | undefined>(issues),
      teamMembers: signal<readonly TeamMember[] | undefined>(teamMembers),
      isLoading: signal(false),
      error: signal<Error | undefined>(undefined),
      openIssueCount: signal<number | undefined>(6),
      overdueIssueCount: signal<number | undefined>(1),
      completionPercentage: signal<number | undefined>(4),
      isIssueOverdue: overduePredicate,
      allowedTransitionsFor: vi.fn(() => ['In Progress']),
      addIssue: vi.fn(() => ({ success: true, issue: issues[0] })),
      updateIssue: vi.fn(() => ({ success: true, issue: issues[0] })),
      reassignIssue: vi.fn(() => ({ success: true, issue: issues[0] })),
      changeIssueStatus: vi.fn(() => ({ success: true, issue: issues[0] })),
    };

    await TestBed.configureTestingModule({
      imports: [IssueBoard],
      providers: [{ provide: IssueStore, useValue: mockStore }],
    }).compileComponents();

    fixture = TestBed.createComponent(IssueBoard);
    fixture.detectChanges();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('renders columns in the required order with issue and point totals', () => {
    const columns = Array.from(fixture.nativeElement.querySelectorAll('.board-column')) as HTMLElement[];
    const headings = columns.map((column) => column.querySelector('h2')?.textContent?.trim());

    expect(headings).toEqual(['To Do', 'In Progress', 'In Review', 'Done']);
    expect(columns[0].querySelector('.issue-count')?.textContent?.trim()).toBe('4');
    expect(columns[0].querySelector('.column-points')?.textContent).toContain('11 story points');
    expect(columns[1].querySelector('.issue-count')?.textContent?.trim()).toBe('1');
    expect(columns[1].querySelector('.column-points')?.textContent).toContain('8 story points');
  });

  it('sorts each column by priority, then earliest due date with undated issues last', () => {
    const cards = fixture.nativeElement.querySelectorAll(
      '.board-column:first-child [data-issue-id]',
    ) as NodeListOf<Element>;
    const issueIds = Array.from(cards).map((card) => card.getAttribute('data-issue-id'));

    expect(issueIds).toEqual(['TRK-102', 'TRK-103', 'TRK-101', 'TRK-104']);
  });

  it('shows resolved assignee names, Unassigned, and the store overdue label', () => {
    const root = fixture.nativeElement as HTMLElement;
    const unassignedCard = root.querySelector('[data-issue-id="TRK-102"]');
    const assignedCard = root.querySelector('[data-issue-id="TRK-101"]');
    const overdueCard = root.querySelector('[data-issue-id="TRK-105"]');

    expect(unassignedCard?.textContent).toContain('Unassigned');
    expect(assignedCard?.textContent).toContain('Maya Chen');
    expect(overdueCard?.querySelector('.overdue-label')?.textContent?.trim()).toBe('Overdue');
    expect(overduePredicate).toHaveBeenCalled();
  });

  it('opens the detail panel from a card and the create form from New issue', () => {
    const root = fixture.nativeElement as HTMLElement;
    (root.querySelector('[data-issue-id="TRK-101"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(root.querySelector('app-issue-detail-panel')).toBeTruthy();

    fixture.componentInstance.closeIssueDetail();
    fixture.componentInstance.openNewIssueForm();
    fixture.detectChanges();
    expect(root.querySelector('app-new-issue-form')).toBeTruthy();
    (root.querySelector('app-new-issue-form .secondary-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.componentInstance.isNewIssueFormOpen()).toBe(false);
    expect(root.querySelector('app-new-issue-form')).toBeNull();
  });

  it('closes the create form through its two-way open model and exposes the reset control', () => {
    TestBed.resetTestingModule();
    const resetData = vi.fn();
    const mockStore = {
      issues: signal<readonly Issue[] | undefined>([issue('TRK-101', 'To Do', 'Low', null)]),
      teamMembers: signal<readonly TeamMember[] | undefined>(teamMembers),
      isLoading: signal(false),
      error: signal<Error | undefined>(undefined),
      openIssueCount: signal<number | undefined>(1),
      overdueIssueCount: signal<number | undefined>(0),
      completionPercentage: signal<number | undefined>(0),
      isIssueOverdue: vi.fn(() => false),
      resetData,
    };
    TestBed.configureTestingModule({
      imports: [IssueBoard],
      providers: [{ provide: IssueStore, useValue: mockStore }],
    });
    const controlFixture = TestBed.createComponent(IssueBoard);
    controlFixture.detectChanges();

    const root = controlFixture.nativeElement as HTMLElement;
    (root.querySelector('.reset-button') as HTMLButtonElement).click();
    expect(resetData).toHaveBeenCalledOnce();

    controlFixture.componentInstance.openNewIssueForm();
    controlFixture.detectChanges();
    (root.querySelector('app-new-issue-form .secondary-button') as HTMLButtonElement).click();
    controlFixture.detectChanges();
    expect(controlFixture.componentInstance.isNewIssueFormOpen()).toBe(false);
    expect(root.querySelector('app-new-issue-form')).toBeNull();
  });

  it('combines case-insensitive search, assignee, and priority filters across columns', async () => {
    const root = fixture.nativeElement as HTMLElement;
    const search = root.querySelector('#issue-search') as HTMLInputElement;
    const assignee = root.querySelector('#assignee-filter') as HTMLSelectElement;
    const priority = root.querySelector('#priority-filter') as HTMLSelectElement;

    search.value = 'trK-10';
    search.dispatchEvent(new Event('input'));
    assignee.value = 'member:TM-002';
    assignee.dispatchEvent(new Event('change'));
    priority.value = 'High';
    priority.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    await vi.waitFor(() =>
      expect(root.querySelector('.filter-summary p')?.textContent).toContain('Showing 2 of 7 issues'),
    );
    fixture.detectChanges();

    const visibleIds = Array.from(
      root.querySelectorAll('.board-column [data-issue-id]') as NodeListOf<Element>,
    ).map((card) => card.getAttribute('data-issue-id'));
    expect(visibleIds).toEqual(['TRK-103', 'TRK-106']);
    const columnCounts = Array.from(
      root.querySelectorAll('.board-column .issue-count') as NodeListOf<Element>,
    ).map((count) => count.textContent?.trim());
    expect(columnCounts).toEqual(['1', '0', '1', '0']);
  });

  it('updates search results after 300 ms of inactivity', async () => {
    const root = fixture.nativeElement as HTMLElement;
    const search = root.querySelector('#issue-search') as HTMLInputElement;
    search.value = 'TRK-103';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(root.querySelector('.filter-summary p')?.textContent).toContain('Showing 7 of 7 issues');
    await vi.waitFor(() =>
      expect(root.querySelector('.filter-summary p')?.textContent).toContain('Showing 1 of 7 issues'),
    );
    fixture.detectChanges();
    expect(root.querySelector('[data-issue-id="TRK-103"]')).toBeTruthy();
    expect(root.querySelector('[data-issue-id="TRK-101"]')).toBeNull();
  });

  it('keeps summary metrics based on all issues while filters are active', async () => {
    const root = fixture.nativeElement as HTMLElement;
    const search = root.querySelector('#issue-search') as HTMLInputElement;
    search.value = 'TRK-103';
    search.dispatchEvent(new Event('input'));

    await vi.waitFor(() =>
      expect(root.querySelector('.filter-summary p')?.textContent).toContain('Showing 1 of 7 issues'),
    );
    fixture.detectChanges();

    expect(root.querySelector('[data-metric="open"] .metric-value')?.textContent?.trim()).toBe('6');
    expect(root.querySelector('[data-metric="overdue"] .metric-value')?.textContent?.trim()).toBe('1');
    expect(root.querySelector('[data-metric="completion"] .metric-value')?.textContent?.trim()).toBe('4%');
  });

  it('immediately clears raw and debounced search plus both select filters', async () => {
    const root = fixture.nativeElement as HTMLElement;
    const search = root.querySelector('#issue-search') as HTMLInputElement;
    const assignee = root.querySelector('#assignee-filter') as HTMLSelectElement;
    const priority = root.querySelector('#priority-filter') as HTMLSelectElement;
    search.value = 'no matching issue';
    search.dispatchEvent(new Event('input'));
    assignee.value = 'unassigned';
    assignee.dispatchEvent(new Event('change'));
    priority.value = 'Critical';
    priority.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    await vi.waitFor(() =>
      expect(root.querySelector('.filter-summary p')?.textContent).toContain('Showing 0 of 7 issues'),
    );
    (root.querySelector('.filter-summary button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(search.value).toBe('');
    expect(assignee.value).toBe('all');
    expect(priority.value).toBe('all');
    expect(fixture.componentInstance.debouncedSearch()).toBe('');
    expect(root.querySelector('.filter-summary p')?.textContent).toContain('Showing 7 of 7 issues');
  });

  it('shows loading and error states instead of board columns', async () => {
    TestBed.resetTestingModule();
    const mockStore = {
      issues: signal<readonly Issue[] | undefined>(undefined),
      teamMembers: signal<readonly TeamMember[] | undefined>(undefined),
      isLoading: signal(true),
      error: signal<Error | undefined>(undefined),
      openIssueCount: signal<number | undefined>(undefined),
      overdueIssueCount: signal<number | undefined>(undefined),
      completionPercentage: signal<number | undefined>(undefined),
      isIssueOverdue: vi.fn(() => false),
    };
    await TestBed.configureTestingModule({
      imports: [IssueBoard],
      providers: [{ provide: IssueStore, useValue: mockStore }],
    }).compileComponents();
    const loadingFixture = TestBed.createComponent(IssueBoard);
    loadingFixture.detectChanges();
    expect(loadingFixture.nativeElement.textContent).toContain('Loading your board');
    expect(loadingFixture.nativeElement.querySelector('.board-column')).toBeNull();

    mockStore.isLoading.set(false);
    mockStore.error.set(new Error('Seed load failed'));
    loadingFixture.detectChanges();
    expect(loadingFixture.nativeElement.textContent).toContain('Seed load failed');
    expect(loadingFixture.nativeElement.querySelector('.board-column')).toBeNull();
  });
});

describe('App', () => {
  it('renders the IssueBoard as its root content', async () => {
    const mockStore = {
      issues: signal<readonly Issue[] | undefined>([]),
      teamMembers: signal<readonly TeamMember[] | undefined>(teamMembers),
      isLoading: signal(false),
      error: signal<Error | undefined>(undefined),
      openIssueCount: signal<number | undefined>(6),
      overdueIssueCount: signal<number | undefined>(1),
      completionPercentage: signal<number | undefined>(4),
      isIssueOverdue: vi.fn(() => false),
    };
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [{ provide: IssueStore, useValue: mockStore }],
    }).compileComponents();

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-issue-board')).toBeTruthy();
  });
});
