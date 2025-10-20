import type { Command, TaskMeta, TaskRunContext } from "./types.ts";
import { execa } from "execa";
import process from "node:process";
import styles from "ansi-styles";

export async function runCommand(
  command: Command,
  meta: TaskMeta,
  ctx: TaskRunContext
): Promise<void> {
  const { abort } = ctx;
  const { name, cwd, env } = meta;

  const transform = function* (line: string) {
    const lastCR = line.lastIndexOf("\r");
    const line2 = lastCR >= 0 ? line.substring(lastCR + 1, line.length) : line;
    const line3 = line2.replace(/\x1bc|\x1b\[2J(?:\x1b\[H)?/g, "");
    yield `${name} | ${line3}`;
  };

  process.stdout.write(`▪▪▪▪ ${styles.bold.open}${name}${styles.bold.close}\n`);
  await execa({
    // @ts-expect-error
    cwd: cwd,
    env: env,
    preferLocal: true,
    stdout: [transform, "inherit"],
    stderr: [transform, "inherit"],
    cancelSignal: abort,
    reject: false,
  })`${command.program} ${command.args}`;
}
