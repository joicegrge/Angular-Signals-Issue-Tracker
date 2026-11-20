import { ChangeDetectionStrategy, Component } from '@angular/core';
import { IssueBoard } from './components/issue-board/issue-board';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IssueBoard],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {}
