import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Issue, TeamMember } from '../../models/issue.model';
import { IssueStore } from '../../services/issue-store';
import { NewIssueForm } from './new-issue-form';

const teamMembers: TeamMember[] = [
  { id: 'TM-001', name: 'Maya Chen' },
  { id: 'TM-002', name: 'Arjun Patel' },
];

const createdIssue: Issue = {
  id: 'TRK-117',
  title: 'Add retry policy',
  description: 'Retry failed requests safely.',
  type: 'Bug',
  priority: 'High',
  status: 'To Do',
  assigneeId: 'TM-002',
  storyPoints: 3,
  dueDate: '2099-12-10',
};

describe('NewIssueForm', () => {
  let fixture: ComponentFixture<NewIssueForm>;
  let addIssue: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    addIssue = vi.fn(() => ({ success: true, issue: createdIssue }));
    await TestBed.configureTestingModule({
      imports: [NewIssueForm],
      providers: [
        {
          provide: IssueStore,
          useValue: { teamMembers: signal<readonly TeamMember[] | undefined>(teamMembers), addIssue },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(NewIssueForm);
    fixture.detectChanges();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('keeps Save disabled until title and due date are valid', () => {
    const root = fixture.nativeElement as HTMLElement;
    const save = root.querySelector('button[type="submit"]') as HTMLButtonElement;
    const title = root.querySelector('#new-issue-name') as HTMLInputElement;
    const dueDate = root.querySelector('#new-issue-due-date') as HTMLInputElement;

    expect(save.disabled).toBe(true);
    title.value = 'Four';
    title.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(save.disabled).toBe(true);

    title.value = 'Add retry policy';
    title.dispatchEvent(new Event('input'));
    dueDate.value = '2000-01-01';
    dueDate.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(save.disabled).toBe(true);
    expect(root.textContent).toContain('Due date cannot be in the past.');

    dueDate.value = '2099-12-10';
    dueDate.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(save.disabled).toBe(false);
  });

  it('creates a To Do issue through IssueStore and emits the created issue', () => {
    const emitted = vi.fn();
    fixture.componentInstance.created.subscribe(emitted);
    const root = fixture.nativeElement as HTMLElement;
    const title = root.querySelector('#new-issue-name') as HTMLInputElement;
    const description = root.querySelector('#new-issue-description') as HTMLTextAreaElement;
    const type = root.querySelector('#new-issue-type') as HTMLSelectElement;
    const priority = root.querySelector('#new-issue-priority') as HTMLSelectElement;
    const points = root.querySelector('#new-issue-points') as HTMLSelectElement;
    const dueDate = root.querySelector('#new-issue-due-date') as HTMLInputElement;
    const assignee = root.querySelector('#new-issue-assignee') as HTMLSelectElement;

    title.value = 'Add retry policy';
    title.dispatchEvent(new Event('input'));
    description.value = 'Retry failed requests safely.';
    description.dispatchEvent(new Event('input'));
    type.value = 'Bug';
    type.dispatchEvent(new Event('change'));
    priority.value = 'High';
    priority.dispatchEvent(new Event('change'));
    points.value = '3';
    points.dispatchEvent(new Event('change'));
    dueDate.value = '2099-12-10';
    dueDate.dispatchEvent(new Event('input'));
    assignee.value = 'TM-002';
    assignee.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    (root.querySelector('button[type="submit"]') as HTMLButtonElement).click();

    expect(addIssue).toHaveBeenCalledWith({
      title: 'Add retry policy',
      description: 'Retry failed requests safely.',
      type: 'Bug',
      priority: 'High',
      storyPoints: 3,
      dueDate: '2099-12-10',
      assigneeId: 'TM-002',
    });
    expect(emitted).toHaveBeenCalledWith(createdIssue);
  });

  it('shows an IssueStore validation error when creation is rejected', () => {
    addIssue.mockReturnValue({ success: false, error: 'Unknown assignee.' });
    const root = fixture.nativeElement as HTMLElement;
    const title = root.querySelector('#new-issue-name') as HTMLInputElement;
    title.value = 'Valid title';
    title.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (root.querySelector('button[type="submit"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(root.textContent).toContain('Unknown assignee.');
  });
});
