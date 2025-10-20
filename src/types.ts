export interface Command {
  program: string;
  args: string[];
}

export interface TaskRunContext {
  abort: AbortSignal;
}

export interface TaskMeta {
  name: string;
  description: string | undefined;
  cwd: string;
  env: Record<string, string>;
  inputs: string[];
  outputs: string[];
  persistent: boolean;
  // interactive: boolean;
  interruptible: boolean;
}

export interface TaskDef {
  run: (ctx: TaskRunContext) => Promise<void>;
  meta: TaskMeta;
  deps: Set<TaskDef>;
  invDeps: Set<TaskDef>;
}
