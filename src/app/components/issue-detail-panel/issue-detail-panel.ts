import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, output, signal } from '@angular/core';
import { Issue, IssuePriority, IssueStatus, StoryPoints, TeamMember } from '../../models/issue.model';
import { IssueStore } from '../../services/issue-store';
import { inject } from '@angular/core';

interface IssueDraft {
  readonly title: string;
  readonly priority: IssuePriority;
  readonly assigneeId: string | null;
  readonly storyPoints: StoryPoints;
}

@Component({
  selector: 'app-issue-detail-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './issue-detail-panel.html',
  styleUrl: './issue-detail-panel.css',
})
export class IssueDetailPanel {
  private readonly issueStore = inject(IssueStore);

  readonly issue = input.required<Issue>();
  readonly teamMembers = input.required<readonly TeamMember[]>();
  readonly closed = output<void>();

  readonly priorities: readonly IssuePriority[] = ['Critical', 'High', 'Medium', 'Low'];
  readonly storyPointOptions: readonly StoryPoints[] = [1, 2, 3, 5, 8];
  readonly draft = linkedSignal<Issue, IssueDraft>({
    source: this.issue,
    computation: (issue) => ({
      title: issue.title,
      priority: issue.priority,
      assigneeId: issue.assigneeId,
      storyPoints: issue.storyPoints,
    }),
  });
  readonly error = signal<string | null>(null);
  readonly hasValidTitle = computed(() => this.draft().title.trim().length >= 5);
  readonly allowedTransitions = computed(() =>
    this.issueStore.allowedTransitionsFor(this.issue().status),
  );
  readonly assigneeName = computed(() => {
    const assigneeId = this.issue().assigneeId;
    return this.teamMembers().find((member) => member.id === assigneeId)?.name ?? 'Unassigned';
  });

  onTitleInput(event: Event): void {
    const title = (event.target as HTMLInputElement).value;
    this.draft.update((draft) => ({ ...draft, title }));
    this.error.set(null);
  }

  onPriorityChange(event: Event): void {
    const priority = (event.target as HTMLSelectElement).value as IssuePriority;
    this.draft.update((draft) => ({ ...draft, priority }));
    this.error.set(null);
  }

  onAssigneeChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.draft.update((draft) => ({ ...draft, assigneeId: value || null }));
    this.error.set(null);
  }

  onStoryPointsChange(event: Event): void {
    const storyPoints = Number((event.target as HTMLSelectElement).value) as StoryPoints;
    this.draft.update((draft) => ({ ...draft, storyPoints }));
    this.error.set(null);
  }

  save(): void {
    const issue = this.issue();
    const draft = this.draft();
    const title = draft.title.trim();
    if (title.length < 5) {
      this.error.set('Title must contain at least 5 characters.');
      return;
    }

    if (draft.assigneeId !== issue.assigneeId) {
      const reassignment = this.issueStore.reassignIssue(issue.id, draft.assigneeId);
      if (!reassignment.success) {
        this.error.set(reassignment.error);
        return;
      }
    }

    const update = this.issueStore.updateIssue(issue.id, {
      title,
      priority: draft.priority,
      storyPoints: draft.storyPoints,
    });
    if (!update.success) {
      this.error.set(update.error);
      return;
    }

    this.error.set(null);
    this.closed.emit();
  }

  changeStatus(status: IssueStatus): void {
    const result = this.issueStore.changeIssueStatus(this.issue().id, status);
    this.error.set(result.success ? null : result.error);
  }

  cancel(): void {
    this.draft.set({
      title: this.issue().title,
      priority: this.issue().priority,
      assigneeId: this.issue().assigneeId,
      storyPoints: this.issue().storyPoints,
    });
    this.error.set(null);
    this.closed.emit();
  }

  close(): void {
    this.closed.emit();
  }
}
