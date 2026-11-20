import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Issue } from '../../models/issue.model';

@Component({
  selector: 'app-issue-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './issue-card.html',
  styleUrl: './issue-card.css',
})
export class IssueCard {
  readonly issue = input.required<Issue>();
  readonly assigneeName = input<string>('Unassigned');
  readonly overdue = input.required<boolean>();
  readonly selected = output<Issue>();

  readonly dueDateLabel = computed(() => this.issue().dueDate ?? 'No due date');

  select(): void {
    this.selected.emit(this.issue());
  }
}
