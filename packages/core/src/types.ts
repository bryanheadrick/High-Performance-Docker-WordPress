export type Result<T> =
  | { success: true; data: T }
  | { success: false; error: { message: string; code: string } };

export function ok<T>(data: T): Result<T> {
  return { success: true, data };
}

export function fail<T = never>(message: string, code: string): Result<T> {
  return { success: false, error: { message, code } };
}
