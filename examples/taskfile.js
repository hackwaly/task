import { configInit } from "@hackwaly/task";
import { buildWorld } from "./src/taskfile.ts";

const { defineTask } = configInit(import.meta);

export const build = defineTask({
  name: "build",
  command: `tsc --build`,
  inputs: ["src/**/*.ts", "tsconfig.json"],
  outputs: ["src/**/*.js"],
  dependsOn: [buildWorld],
});

export const watch = defineTask({
  name: "watch",
  command: `tsc --watch`,
  persistent: true,
  dependsOn: [buildWorld],
});

export default build;
