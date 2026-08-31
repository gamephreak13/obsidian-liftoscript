import { App, TFile } from "obsidian";

/*
 * atomicWrite.ts
 *
 * P19: serialize file writes into discrete, atomic operations so rapid writes
 * to the same note from concurrent hands (phone/laptop/computer) cannot
 * interleave and corrupt each other for background sync (LiveSync / Obsidian
 * Git). Each edit is performed with Obsidian's atomic Vault.process() (a
 * single serialized read-modify-write), and calls to the same file are queued
 * so transforms build on each other's result in FIFO order.
 */

const queues = new Map<string, Promise<void>>();

/** Serialized, atomic read-modify-write; `fn` sees every prior write to the file. */
export async function atomicModify(
  app: App,
  file: TFile,
  fn: (data: string) => string
): Promise<void> {
  const run = async (): Promise<void> => {
    await app.vault.process(file, fn);
  };

  const previous = queues.get(file.path) ?? Promise.resolve();
  // Chain after the previous write for this file; a rejected previous write
  // must not strand this one, so both branches proceed.
  const tail = previous.then(run, run);
  queues.set(file.path, tail);
  try {
    await tail;
  } finally {
    // Drop the slot only when this is the last queued write for the path.
    if (queues.get(file.path) === tail) {
      queues.delete(file.path);
    }
  }
}
