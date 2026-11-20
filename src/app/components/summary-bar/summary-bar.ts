import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-summary-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './summary-bar.html',
  styleUrl: './summary-bar.css',
})
export class SummaryBar {
  readonly openIssueCount = input.required<number>();
  readonly overdueIssueCount = input.required<number>();
  readonly completionPercentage = input.required<number>();
}
