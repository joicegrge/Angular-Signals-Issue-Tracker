export type IssueId = `TRK-${number}`;

export type IssueType = 'Bug' | 'Task' | 'Story';

export type IssuePriority = 'Critical' | 'High' | 'Medium' | 'Low';

export type IssueStatus = 'To Do' | 'In Progress' | 'In Review' | 'Done';

export type StoryPoints = 1 | 2 | 3 | 5 | 8;

export type ISODateString = `${number}-${number}-${number}`;

export interface Issue {
  id: IssueId;
  title: string;
  description: string;
  type: IssueType;
  priority: IssuePriority;
  status: IssueStatus;
  assigneeId: string | null;
  storyPoints: StoryPoints;
  dueDate: ISODateString | null;
}

export interface TeamMember {
  id: string;
  name: string;
}
