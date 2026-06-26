import type { Task } from '@/domain/tasks/task.types';

export type FieldOperationSelection = NonNullable<Task['fieldOperationType']>;

let selectedOperation: FieldOperationSelection | null = null;

export function getSelectedFieldOperation(): FieldOperationSelection | null {
  return selectedOperation;
}

export function setSelectedFieldOperation(
  operation: FieldOperationSelection
): void {
  selectedOperation = operation;
}

export function clearSelectedFieldOperation(): void {
  selectedOperation = null;
}
