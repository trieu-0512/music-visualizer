/**
 * A minimal, dependency-free `Result` type used by the shared validators and
 * other areas to return either a success value or a structured error without
 * throwing (Req 15.4).
 *
 * Consumers narrow on the `ok` discriminant:
 *
 * ```ts
 * const r = validateLyrics(data);
 * if (r.ok) {
 *   useLyrics(r.value);
 * } else {
 *   reportErrors(r.error);
 * }
 * ```
 */

/** Successful result carrying a value of type `T`. */
export interface Ok<T> {
  ok: true;
  value: T;
}

/** Failed result carrying an error of type `E`. */
export interface Err<E> {
  ok: false;
  error: E;
}

/** Either a success (`Ok<T>`) or a failure (`Err<E>`). */
export type Result<T, E> = Ok<T> | Err<E>;

/** Construct a successful {@link Result}. */
export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

/** Construct a failed {@link Result}. */
export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

/** Type guard narrowing a {@link Result} to its {@link Ok} branch. */
export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.ok;
}

/** Type guard narrowing a {@link Result} to its {@link Err} branch. */
export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return !result.ok;
}
