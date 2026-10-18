import { useEvent } from "react-use-event-hook";

export type EventCallback = (...arguments_: never[]) => unknown;

/**
 * Keeps one command identity for the lifetime of a mounted component while
 * dispatching to the implementation from the latest committed render.
 *
 * Observer and transport consumers keep their subscriptions when the callback
 * changes. The implementation is supplied by the MIT-licensed public library;
 * source/version and distribution notices are recorded in PROVENANCE.md.
 */
export function useStableEvent<TCallback extends EventCallback>(
  callback: TCallback,
): TCallback {
  return useEvent(callback);
}
