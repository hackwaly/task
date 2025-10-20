import { Command } from "commander";
import process from "node:process";
import type { TaskDef } from "./types.ts";
import { start } from "./scheduler.ts";
import { ReplaySubject } from "rxjs";
import chokidar from "chokidar";
import micromatch from "micromatch";
import NodePath from "node:path";

export async function cliMain(): Promise<void> {
  const program = new Command()
    .name("task")
    .version("0.1.0")
    .description("Just another task runner");
  const runCommand = new Command()
    .name("run")
    .option("-w, --watch", "Watch mode")
    .argument("<tasks...>", "Task(s) to run")
    .action(async (taskNames: string[], options: { watch: boolean }) => {
      const path = process.cwd();
      const allTaskDefs = await import(NodePath.join(path, "taskfile.ts"));
      const topTaskSet = new Set<TaskDef>();
      for (const name of taskNames) {
        const taskDef = allTaskDefs[name];
        if (!taskDef) {
          throw new Error(`Task "${name}" not found.`);
        }
        topTaskSet.add(taskDef);
      }
      const aborter = new AbortController();
      const taskChan = new ReplaySubject<Set<TaskDef>>();
      const loop = start(taskChan, {
        abort: aborter.signal,
      });
      if (options.watch) {
        const watchTargets = new Set<string>();
        const watchSet = new Set<TaskDef>();
        const addWatchDir = (task: TaskDef) => {
          for (const dep of task.deps) {
            addWatchDir(dep);
          }
          if (!task.meta.persistent || task.meta.interruptible) {
            watchSet.add(task);
            watchTargets.add(task.meta.cwd);
          }
        };
        for (const task of topTaskSet) {
          addWatchDir(task);
        }
        const watcher = chokidar.watch([...watchTargets], {
          ignoreInitial: true,
          ignored: (path) => /\bnode_modules\b/.test(path),
        });
        const dirtySeedSet = new Set<TaskDef>();
        const flush = () => {
          const dirtySet = new Set<TaskDef>();
          const process = (task: TaskDef, buffer: TaskDef[]) => {
            if (topTaskSet.has(task)) {
              for (const t of buffer) {
                dirtySet.add(t);
              }
              buffer.length = 0;
            }
            for (const invDep of task.invDeps) {
              process(
                invDep,
                !invDep.meta.persistent || invDep.meta.interruptible
                  ? [...buffer, invDep]
                  : buffer
              );
            }
          };
          for (const task of dirtySeedSet) {
            process(task, [task]);
          }
          dirtySeedSet.clear();
          if (dirtySet.size > 0) {
            taskChan.next(dirtySet);
          }
        };
        watcher.on("all", (event, path) => {
          for (const task of watchSet) {
            const relPath = NodePath.relative(task.meta.cwd, path);
            if (micromatch.isMatch(relPath, task.meta.inputs)) {
              dirtySeedSet.add(task);
            }
          }
          if (dirtySeedSet.size > 0) {
            flush();
          }
        });
        process.on("SIGINT", async () => {
          aborter.abort();
          watcher.close();
          await loop;
          process.exit(0);
        });
        taskChan.next(topTaskSet);
      } else {
        process.on("SIGINT", async () => {
          aborter.abort();
          await loop;
          process.exit(0);
        });
        taskChan.next(topTaskSet);
        taskChan.complete();
      }
      await loop;
    });
  const listCommand = new Command()
    .name("list")
    .alias("ls")
    .description("List all available tasks")
    .action(async () => {
      const path = process.cwd();
      const allTaskDefs = await import(NodePath.join(path, "taskfile.ts"));

      // Get all exported tasks
      const tasks: Array<{ name: string; description?: string }> = [];
      for (const [exportName, taskDef] of Object.entries(allTaskDefs)) {
        if (
          exportName !== "default" &&
          taskDef &&
          typeof taskDef === "object" &&
          "meta" in taskDef
        ) {
          const task = taskDef as TaskDef;
          tasks.push({
            name: task.meta.name,
            description: task.meta.description,
          });
        }
      }

      if (tasks.length === 0) {
        process.stdout.write("No tasks found in taskfile.ts\n");
        return;
      }

      // Sort tasks by name
      tasks.sort((a, b) => a.name.localeCompare(b.name));

      // Find the longest task name for formatting
      const maxNameLength = Math.max(...tasks.map((t) => t.name.length));

      process.stdout.write("Available tasks:\n");
      for (const task of tasks) {
        const paddedName = task.name.padEnd(maxNameLength);
        const description = task.description || "No description";
        process.stdout.write(`  ${paddedName}  ${description}\n`);
      }
    });

  program.addCommand(runCommand);
  program.addCommand(listCommand);
  await program.parseAsync();
}
