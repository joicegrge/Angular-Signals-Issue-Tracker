import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Issue, TeamMember } from '../../models/issue.model';
import { IssueStore } from '../../services/issue-store';
import { IssueDetailPanel } from './issue-detail-panel';

const teamMembers: TeamMember[] = [
  { id: 'TM-001', name: 'Maya Chen' },
  { id: 'TM-002', name: 'Arjun Patel' },
];

const firstIssue: Issue = {
  id: 'TRK-101',
  title: 'Keyboard navigation',
  description: 'Support keyboard movement between issues.',
  type: 'Story',
  priority: 'Medium',
  status: 'To Do',
  assigneeId: 'TM-001',
  storyPoints: 3,
  dueDate: '2026-12-01',
};

const secondIssue: Issue = {
  ...firstIssue,
  id: 'TRK-102',
  title: 'Search issue IDs',
  priority: 'High',
  assigneeId: 'TM-002',
  storyPoints: 5,
};

describe('IssueDetailPanel', () => {
  let fixture: ComponentFixture<IssueDetailPanel>;
  let store: {
    allowedTransitionsFor: ReturnType<typeof vi.fn>;
    updateIssue: ReturnType<typeof vi.fn>;
    reassignIssue: ReturnType<typeof vi.fn>;
    changeIssueStatus: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    store = {
      allowedTransitionsFor: vi.fn(() => ['In Progress']),
      updateIssue: vi.fn(() => ({ success: true, issue: firstIssue })),
      reassignIssue: vi.fn(() => ({ success: true, issue: firstIssue })),
      changeIssueStatus: vi.fn(() => ({ success: true, issue: firstIssue })),
    };
    await TestBed.configureTestingModule({
      imports: [IssueDetailPanel],
      providers: [{ provide: IssueStore, useValue: store }],
    }).compileComponents();
    fixture = TestBed.createComponent(IssueDetailPanel);
    fixture.componentRef.setInput('issue', firstIssue);
    fixture.componentRef.setInput('teamMembers', teamMembers);
    fixture.detectChanges();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('shows issue fields and only transitions returned by IssueStore', () => {
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('TRK-101');
    expect((root.querySelector('#detail-title-input') as HTMLInputElement).value).toBe('Keyboard navigation');
    expect(root.textContent).toContain('Support keyboard movement between issues.');
    expect(root.textContent).toContain('Maya Chen');
    expect(root.textContent).toContain('3');
    expect(Array.from(root.querySelectorAll('[data-status]')).map((button) => button.getAttribute('data-status')))
      .toEqual(['In Progress']);
  });

  it('saves editable fields through IssueStore and closes after success', () => {
    const closed = vi.fn();
    fixture.componentInstance.closed.subscribe(closed);
    const root = fixture.nativeElement as HTMLElement;
    const title = root.querySelector('#detail-title-input') as HTMLInputElement;
    const assignee = root.querySelector('#detail-assignee') as HTMLSelectElement;
    const points = root.querySelector('#detail-story-points') as HTMLSelectElement;

    title.value = 'Keyboard navigation polish';
    title.dispatchEvent(new Event('input'));
    assignee.value = 'TM-002';
    assignee.dispatchEvent(new Event('change'));
    points.value = '5';
    points.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    (root.querySelector('button[type="submit"]') as HTMLButtonElement).click();

    expect(store.reassignIssue).toHaveBeenCalledWith('TRK-101', 'TM-002');
    expect(store.updateIssue).toHaveBeenCalledWith('TRK-101', {
      title: 'Keyboard navigation polish',
      priority: 'Medium',
      storyPoints: 5,
    });
    expect(closed).toHaveBeenCalledOnce();
  });

  it('discards edits on Cancel without changing the store', () => {
    const closed = vi.fn();
    fixture.componentInstance.closed.subscribe(closed);
    const root = fixture.nativeElement as HTMLElement;
    const title = root.querySelector('#detail-title-input') as HTMLInputElement;
    title.value = 'Unsaved title';
    title.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (root.querySelector('.form-actions button[type="button"]') as HTMLButtonElement).click();

    expect(store.updateIssue).not.toHaveBeenCalled();
    expect(store.reassignIssue).not.toHaveBeenCalled();
    expect(fixture.componentInstance.draft().title).toBe(firstIssue.title);
    expect(closed).toHaveBeenCalledOnce();
  });

  it('resets its local draft when a different issue is selected', () => {
    fixture.componentInstance.draft.update((draft) => ({ ...draft, title: 'Unsaved title' }));
    fixture.componentRef.setInput('issue', secondIssue);
    fixture.detectChanges();

    expect(fixture.componentInstance.draft()).toEqual({
      title: secondIssue.title,
      priority: secondIssue.priority,
      assigneeId: secondIssue.assigneeId,
      storyPoints: secondIssue.storyPoints,
    });
  });

  it('routes status actions to IssueStore and displays its rule message', () => {
    store.changeIssueStatus.mockReturnValue({ success: false, error: 'Assign an owner first.' });
    const root = fixture.nativeElement as HTMLElement;
    (root.querySelector('[data-status="In Progress"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(store.changeIssueStatus).toHaveBeenCalledWith('TRK-101', 'In Progress');
    expect(root.textContent).toContain('Assign an owner first.');
  });
});
