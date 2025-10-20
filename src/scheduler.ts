import type { TaskDef } from "./types.ts";
import { InvariantViolation } from "./errors.ts";
import { firstValueFrom, Subject, type Observable } from "rxjs";

export async function start(
  taskChan: Observable<Set<TaskDef>>,
  options: {
    abort: AbortSignal;
  }
): Promise<void> {
  const abort = options.abort;

  // A pending task is dirty, but a dirty task may not be pending
  const dirtySet = new Set<TaskDef>();
  const pendingSet = new Set<TaskDef>();
  const upToDateSet = new Set<TaskDef>();

  const readySignal = new Subject<void>();
  const readySet = new Set<TaskDef>();
  const runningSet = new Map<
    TaskDef,
    {
      promise: Promise<void>;
      aborter: AbortController;
    }
  >();
  const abortedRunningSet = new Map<TaskDef, Promise<void>>();

  const isReady = (task: TaskDef) => {
    if (!dirtySet.has(task)) throw new InvariantViolation();

    if (pendingSet.has(task)) {
      return false;
    }

    for (const dep of task.deps) {
      if (!upToDateSet.has(dep)) {
        return false;
      }
    }
    return true;
  };

  const checkReady = (task: TaskDef) => {
    if (isReady(task)) {
      dirtySet.delete(task);
      readySet.add(task);
      readySignal.next();

      // Mark inverse dependencies as pending, so they won't become ready
      for (const invDep of task.invDeps) {
        if (dirtySet.has(invDep)) {
          pendingSet.add(invDep);
        }
      }
    }
  };

  const cancel = (task: TaskDef) => {
    if (!runningSet.has(task)) throw new InvariantViolation();

    const { promise, aborter } = runningSet.get(task)!;
    runningSet.delete(task);
    abortedRunningSet.set(task, promise);
    aborter.abort();
  };

  const addDirtyAndCheckReady = (task: TaskDef) => {
    if (runningSet.has(task)) {
      cancel(task);
      runningSet.delete(task);
    } else if (readySet.has(task)) {
      readySet.delete(task);
    }

    dirtySet.add(task);

    if (upToDateSet.has(task)) {
      upToDateSet.delete(task);
    } else {
      for (const dep of task.deps) {
        addDirtyAndCheckReady(dep);
      }
    }

    checkReady(task);
  };

  const runTask = async (task: TaskDef, abort: AbortSignal) => {
    if (runningSet.has(task)) {
      const { promise, aborter } = runningSet.get(task)!;
      aborter.abort();
      await Promise.allSettled([promise]);
    }

    await task.run({ abort });
    upToDateSet.add(task);
    for (const invDep of task.invDeps) {
      if (pendingSet.has(invDep)) {
        pendingSet.delete(invDep);
        checkReady(invDep);
      }
    }
  };

  let noMoreTasks = false;
  taskChan.subscribe({
    next: (tasks) => {
      for (const task of tasks) {
        addDirtyAndCheckReady(task);
      }
    },
    complete: () => {
      noMoreTasks = true;
    },
  });

  const runLoop = async () => {
    while (!abort.aborted) {
      if (readySet.size === 0) {
        await firstValueFrom(readySignal);
        continue;
      }
      // TODO: limit the concurrency
      for (const task of readySet) {
        const aborter = new AbortController();
        const promise = runTask(task, aborter.signal).finally(() => {
          // Clean up abortedRunningSet if this was the last run
          const wait = abortedRunningSet.get(task);
          if (wait === promise) {
            abortedRunningSet.delete(task);
          }
          const runningEntry = runningSet.get(task);
          if (runningEntry !== undefined && runningEntry.promise === promise) {
            runningSet.delete(task);
          }
        });
        runningSet.set(task, { promise, aborter });
      }
      readySet.clear();
      if (dirtySet.size === 0 && noMoreTasks) {
        break;
      }
    }
  };

  abort.addEventListener("abort", () => {
    for (const task of runningSet.keys()) {
      cancel(task);
    }
    runningSet.clear();
  });

  await runLoop();
  await Promise.allSettled(abortedRunningSet.values());
}
