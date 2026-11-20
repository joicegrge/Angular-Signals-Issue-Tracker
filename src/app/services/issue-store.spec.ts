import { TestBed } from '@angular/core/testing';
import { Issue, IssueId, IssueStatus, TeamMember } from '../models/issue.model';
import { ISSUE_STORE_STORAGE_KEY, IssueStore } from './issue-store';

const team: TeamMember[] = [
  { id: 'TM-001', name: 'Maya Chen' },
  { id: 'TM-002', name: 'Arjun Patel' },
  { id: 'TM-003', name: 'Sofia Martinez' },
  { id: 'TM-004', name: 'Noah Williams' },
];

function makeIssue(
  id: IssueId,
  status: IssueStatus = 'To Do',
  assigneeId: string | null = 'TM-001',
  dueDate: Issue['dueDate'] = '2099-12-31',
): Issue {
  return {
    id,
    title: `Issue ${id}`,
    description: `Description for ${id}`,
    type: 'Task',
    priority: 'Medium',
    status,
    assigneeId,
    storyPoints: 2,
    dueDate,
  };
}

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
  } as Response;
}

function installSeedFetch(issues: Issue[]): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    return Promise.resolve(jsonResponse(url.endsWith('/issues.json') ? issues : team));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function createStore(issues: Issue[]): Promise<IssueStore> {
  installSeedFetch(issues);
  const store = TestBed.inject(IssueStore);
  await vi.waitFor(() => expect(store.isReady()).toBe(true));
  return store;
}

describe('IssueStore', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [IssueStore] });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
  });

  it('exposes permitted status transitions from the existing workflow rules', async () => {
    const store = await createStore([makeIssue('TRK-101')]);

    expect(store.allowedTransitionsFor('To Do')).toEqual(['In Progress']);
    expect(store.allowedTransitionsFor('In Progress')).toEqual(['In Review', 'To Do']);
    expect(store.allowedTransitionsFor('In Review')).toEqual(['Done', 'In Progress']);
    expect(store.allowedTransitionsFor('Done')).toEqual(['To Do']);
  });

  it('does not expose or persist initial state until both seed files have loaded', async () => {
    const seedIssues = [makeIssue('TRK-101')];
    const savedIssues = [{ ...seedIssues[0], title: 'Saved local title' }];
    localStorage.setItem(
      ISSUE_STORE_STORAGE_KEY,
      JSON.stringify({ version: 1, issues: savedIssues, reopenedIssueIds: [] }),
    );
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const pendingRequests = new Map<string, (response: Response) => void>();
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) =>
        new Promise<Response>((resolve) => pendingRequests.set(String(input), resolve)),
      ),
    );

    const store = TestBed.inject(IssueStore);
    await vi.waitFor(() => expect(pendingRequests.size).toBe(2));

    expect(store.isLoading()).toBe(true);
    expect(store.issues()).toBeUndefined();
    expect(store.teamMembers()).toBeUndefined();
    expect(setItem).not.toHaveBeenCalled();

    pendingRequests.get('/issues.json')?.(jsonResponse(seedIssues));
    await Promise.resolve();
    await Promise.resolve();
    expect(store.issues()).toBeUndefined();
    expect(store.teamMembers()).toBeUndefined();
    expect(setItem).not.toHaveBeenCalled();

    pendingRequests.get('/team.json')?.(jsonResponse(team));
    await vi.waitFor(() => expect(store.isReady()).toBe(true));
    await vi.waitFor(() => expect(setItem).toHaveBeenCalled());

    expect(store.issues()?.[0]?.title).toBe('Saved local title');
    expect(store.teamMembers()).toEqual(team);
  });

  it('blocks reassignment of an In Progress issue when the target member already has three', async () => {
    const issues = [
      makeIssue('TRK-101', 'In Progress', 'TM-001'),
      makeIssue('TRK-102', 'In Progress', 'TM-001'),
      makeIssue('TRK-103', 'In Progress', 'TM-001'),
      makeIssue('TRK-104', 'In Progress', 'TM-002'),
    ];
    const store = await createStore(issues);

    const result = store.reassignIssue('TRK-104', 'TM-001');

    expect(result.success).toBe(false);
    expect(result.success ? '' : result.error).toContain('already has 3 issues In Progress');
    expect(store.issues()?.find((issue) => issue.id === 'TRK-104')?.assigneeId).toBe('TM-002');
  });

  it('blocks moving a fourth issue into In Progress for the same member', async () => {
    const store = await createStore([
      makeIssue('TRK-101', 'In Progress', 'TM-001'),
      makeIssue('TRK-102', 'In Progress', 'TM-001'),
      makeIssue('TRK-103', 'In Progress', 'TM-001'),
      makeIssue('TRK-104', 'To Do', 'TM-001'),
    ]);

    const result = store.changeIssueStatus('TRK-104', 'In Progress');

    expect(result.success).toBe(false);
    expect(result.success ? '' : result.error).toContain('already has 3 issues In Progress');
    expect(store.issues()?.find((issue) => issue.id === 'TRK-104')?.status).toBe('To Do');
  });

  it('rejects invalid story points on add and update', async () => {
    const store = await createStore([makeIssue('TRK-101')]);
    const invalidPoints = 4 as unknown as Issue['storyPoints'];

    const addResult = store.addIssue({
      title: 'Invalid points',
      description: 'This issue uses unsupported story points.',
      type: 'Task',
      priority: 'Low',
      storyPoints: invalidPoints,
      dueDate: null,
    });
    const updateResult = store.updateIssue('TRK-101', { storyPoints: invalidPoints });

    expect(addResult.success).toBe(false);
    expect(updateResult.success).toBe(false);
    expect(store.issues()).toHaveLength(1);
    expect(store.issues()?.[0]?.storyPoints).toBe(2);
  });

  it('generates the next issue ID from the highest existing ID', async () => {
    const store = await createStore([makeIssue('TRK-101'), makeIssue('TRK-110')]);

    const result = store.addIssue({
      title: 'Add another issue',
      description: 'Validate sequential issue IDs.',
      type: 'Story',
      priority: 'Medium',
      storyPoints: 3,
      dueDate: null,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.issue.id).toBe('TRK-111');
      expect(result.issue.status).toBe('To Do');
    }
  });

  it('blocks moving an unassigned issue into In Progress and unassigning one already there', async () => {
    const store = await createStore([
      makeIssue('TRK-101', 'To Do', null),
      makeIssue('TRK-102', 'In Progress', 'TM-001'),
    ]);

    const moveResult = store.changeIssueStatus('TRK-101', 'In Progress');
    const unassignResult = store.reassignIssue('TRK-102', null);

    expect(moveResult.success).toBe(false);
    expect(moveResult.success ? '' : moveResult.error).toContain('Assign this issue');
    expect(unassignResult.success).toBe(false);
    expect(unassignResult.success ? '' : unassignResult.error).toContain('cannot be unassigned');
  });

  it('persists reopening and enforces a new due date after refresh', async () => {
    const seedIssues = [makeIssue('TRK-101', 'Done', 'TM-001', '2026-11-15')];
    const store = await createStore(seedIssues);

    const reopenResult = store.changeIssueStatus('TRK-101', 'To Do');
    expect(reopenResult.success).toBe(true);
    expect(store.issues()?.[0]?.dueDate).toBeNull();
    await vi.waitFor(() => {
      const saved = JSON.parse(localStorage.getItem(ISSUE_STORE_STORAGE_KEY) ?? '{}');
      expect(saved.reopenedIssueIds).toContain('TRK-101');
    });

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [IssueStore] });
    installSeedFetch(seedIssues);
    const refreshedStore = TestBed.inject(IssueStore);
    await vi.waitFor(() => expect(refreshedStore.isReady()).toBe(true));

    expect(refreshedStore.issues()?.[0]?.dueDate).toBeNull();
    const blocked = refreshedStore.changeIssueStatus('TRK-101', 'In Progress');
    expect(blocked.success).toBe(false);
    expect(blocked.success ? '' : blocked.error).toContain('Set a new due date');

    const dateResult = refreshedStore.updateIssue('TRK-101', { dueDate: '2026-12-15' });
    expect(dateResult.success).toBe(true);
    expect(refreshedStore.changeIssueStatus('TRK-101', 'In Progress').success).toBe(true);
  });

  it('clears persisted changes and reloads both seed files on reset', async () => {
    const seedIssues = [makeIssue('TRK-101', 'To Do', 'TM-001')];
    const store = await createStore(seedIssues);
    expect(store.updateIssue('TRK-101', { title: 'Locally changed title' }).success).toBe(true);
    await vi.waitFor(() => {
      expect(JSON.parse(localStorage.getItem(ISSUE_STORE_STORAGE_KEY) ?? '{}').issues[0].title).toBe(
        'Locally changed title',
      );
    });

    store.resetData();
    await vi.waitFor(() => expect(store.isReady()).toBe(true));
    await vi.waitFor(() =>
      expect(store.issues()?.[0]?.title).toBe('Issue TRK-101'),
    );

    expect(localStorage.getItem(ISSUE_STORE_STORAGE_KEY)).not.toContain('Locally changed title');
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(4);
  });

  it('keeps issue and team data unavailable when either seed request fails', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) =>
      Promise.resolve(
        String(input).endsWith('/team.json')
          ? jsonResponse([], false)
          : jsonResponse([makeIssue('TRK-101')]),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const store = TestBed.inject(IssueStore);

    await vi.waitFor(() => expect(store.error()).toBeInstanceOf(Error));

    expect(store.isReady()).toBe(false);
    expect(store.issues()).toBeUndefined();
    expect(store.teamMembers()).toBeUndefined();
  });

  it('computes overdue and completion metrics from all issues', async () => {
    const store = await createStore([
      makeIssue('TRK-101', 'To Do', 'TM-001', '2020-01-01'),
      { ...makeIssue('TRK-102', 'Done', 'TM-001', '2020-01-01'), storyPoints: 3 },
    ]);

    expect(store.overdueIssues()?.map((issue) => issue.id)).toEqual(['TRK-101']);
    expect(store.openIssueCount()).toBe(1);
    expect(store.completionPercentage()).toBe(60);
  });
});
