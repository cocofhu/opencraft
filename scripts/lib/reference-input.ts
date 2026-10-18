import { statSync } from "node:fs";
import { resolve } from "node:path";

/** Reference snapshots are optional developer inputs, never machine defaults. */
export function requireReferenceDirectory(value: string | undefined, setting: string): string {
  if (!value?.trim()) throw new Error(`Set ${setting} to an existing local reference directory; snapshots are not included in OpenCraft.`);
  const root = resolve(value.trim());
  if (!statSync(root, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(`${setting} must name an existing local reference directory.`);
  }
  return root;
}
