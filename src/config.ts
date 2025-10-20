import type { Command, TaskDef, TaskMeta, TaskRunContext } from "./types.js";
import NodePath from "node:path";
import { fileURLToPath } from "node:url";
import { runCommand } from "./run.js";
import { parseArgsStringToArgv } from "string-argv";

export interface TaskConfig {
  name: string;
  description?: string;
  run?: (ctx: TaskRunContext) => Promise<void>;
  command?: string | string[] | { program: string; args?: string[] };
  env?: Record<string, string>;
  cwd?: string;
  inputs?: string[];
  outputs?: string[];
  persistent?: boolean;
  // interactive?: boolean;
  interruptible?: boolean;
  // cache?: boolean;
  dependsOn?: [TaskDef];
}

export interface ConfigAPI {
  defineTask(config: TaskConfig): TaskDef;
}

function normalizeCommand(
  command: string | string[] | { program: string; args?: string[] } | undefined
): Command | undefined {
  if (typeof command === "string") {
    const argv = parseArgsStringToArgv(command);
    return { program: argv[0]!, args: argv.slice(1) };
  }
  if (Array.isArray(command)) {
    return { program: command[0]!, args: command.slice(1) };
  }
  if (command !== undefined) {
    return { program: command.program, args: command.args ?? [] };
  }
  return undefined;
}

export function configInit(importMeta: ImportMeta): ConfigAPI {
  return {
    defineTask: (config: TaskConfig): TaskDef => {
      const command = normalizeCommand(config.command);
      const meta: TaskMeta = {
        name: config.name,
        description: config.description,
        cwd: config.cwd ?? NodePath.dirname(fileURLToPath(importMeta.url)),
        env: config.env ?? {},
        inputs: config.inputs ?? ["**/*"],
        outputs: config.outputs ?? ["**/*"],
        persistent: config.persistent ?? false,
        // interactive: config.interactive ?? false,
        interruptible: config.interruptible ?? false,
      };
      const def: TaskDef = {
        run:
          config.run ??
          (async (ctx: TaskRunContext) => {
            if (command !== undefined) {
              await runCommand(command, meta, ctx);
            }
          }),
        meta: meta,
        deps: new Set(),
        invDeps: new Set(),
      };
      for (const dep of config.dependsOn ?? []) {
        def.deps.add(dep);
        if (dep.meta.persistent && !def.meta.persistent) {
          throw new Error(
            `Task "${def.meta.name}" depends on persistent task "${dep.meta.name}", so it must also be marked as persistent.`
          );
        }
        dep.invDeps.add(def);
      }
      return def;
    },
  };
}
