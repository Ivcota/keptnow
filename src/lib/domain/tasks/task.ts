export interface Task {
	id: number;
	title: string;
	priority: number;
	completedAt: Date | null;
}

export interface CreateTaskInput {
	title: string;
	priority: number;
}

export interface CompleteTaskInput {
	id: number;
}

export interface RemoveTaskInput {
	id: number;
}
