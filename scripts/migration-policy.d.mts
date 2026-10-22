export function migrationEnabled(
  env: Record<string, string | undefined>,
  automatic: boolean,
): boolean;

export function validateMigrationTarget(
  env: Record<string, string | undefined>,
  linkedRef: string,
): string;
