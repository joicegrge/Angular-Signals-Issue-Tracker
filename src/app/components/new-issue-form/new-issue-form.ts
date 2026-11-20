import { ChangeDetectionStrategy, Component, computed, inject, model, output, signal } from '@angular/core';
import { Issue, IssuePriority, IssueType, ISODateString, StoryPoints } from '../../models/issue.model';
import { IssueStore, NewIssueInput } from '../../services/issue-store';

@Component({
  selector: 'app-new-issue-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './new-issue-form.html',
  styleUrl: './new-issue-form.css',
})
export class NewIssueForm {
  private readonly issueStore = inject(IssueStore);

  readonly created = output<Issue>();
  readonly open = model(false);

  readonly types: readonly IssueType[] = ['Bug', 'Task', 'Story'];
  readonly priorities: readonly IssuePriority[] = ['Critical', 'High', 'Medium', 'Low'];
  readonly storyPointOptions: readonly StoryPoints[] = [1, 2, 3, 5, 8];
  readonly teamMembers = computed(() => this.issueStore.teamMembers() ?? []);

  readonly title = signal('');
  readonly description = signal('');
  readonly type = signal<IssueType>('Bug');
  readonly priority = signal<IssuePriority>('Medium');
  readonly storyPoints = signal<StoryPoints>(1);
  readonly dueDate = signal('');
  readonly assigneeId = signal('');
  readonly error = signal<string | null>(null);
  readonly today = this.todayAsISODate();

  readonly titleIsValid = computed(() => this.title().trim().length >= 5);
  readonly dueDateIsValid = computed(() => !this.dueDate() || this.dueDate() >= this.today);
  readonly isValid = computed(() => this.titleIsValid() && this.dueDateIsValid());

  onTitleInput(event: Event): void {
    this.title.set((event.target as HTMLInputElement).value);
    this.error.set(null);
  }

  onDescriptionInput(event: Event): void {
    this.description.set((event.target as HTMLTextAreaElement).value);
    this.error.set(null);
  }

  onTypeChange(event: Event): void {
    this.type.set((event.target as HTMLSelectElement).value as IssueType);
  }

  onPriorityChange(event: Event): void {
    this.priority.set((event.target as HTMLSelectElement).value as IssuePriority);
  }

  onStoryPointsChange(event: Event): void {
    this.storyPoints.set(Number((event.target as HTMLSelectElement).value) as StoryPoints);
  }

  onDueDateInput(event: Event): void {
    this.dueDate.set((event.target as HTMLInputElement).value);
    this.error.set(null);
  }

  onAssigneeChange(event: Event): void {
    this.assigneeId.set((event.target as HTMLSelectElement).value);
  }

  submit(): void {
    if (!this.titleIsValid()) {
      this.error.set('Title is required and must contain at least 5 characters.');
      return;
    }
    if (!this.dueDateIsValid()) {
      this.error.set('Due date cannot be in the past.');
      return;
    }

    const input: NewIssueInput = {
      title: this.title().trim(),
      description: this.description().trim(),
      type: this.type(),
      priority: this.priority(),
      storyPoints: this.storyPoints(),
      dueDate: this.dueDate() ? (this.dueDate() as ISODateString) : null,
      assigneeId: this.assigneeId() || null,
    };
    const result = this.issueStore.addIssue(input);
    if (!result.success) {
      this.error.set(result.error);
      return;
    }

    this.error.set(null);
    this.created.emit(result.issue);
    this.open.set(false);
  }

  close(): void {
    this.open.set(false);
  }

  private todayAsISODate(): ISODateString {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}` as ISODateString;
  }
}
