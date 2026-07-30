export class WorkspaceIngestValidationError extends Error {
  readonly name = "WorkspaceIngestValidationError";
}

export class WorkspaceIngestConversionError extends Error {
  readonly name = "WorkspaceIngestConversionError";
}

export class WorkspaceValidationError extends Error {
  readonly name = "WorkspaceValidationError";
}

export class WorkspaceNotFoundError extends Error {
  readonly name = "WorkspaceNotFoundError";
}

export class WorkspaceForbiddenError extends Error {
  readonly name = "WorkspaceForbiddenError";
}
