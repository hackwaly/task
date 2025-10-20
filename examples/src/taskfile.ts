import { configInit } from "@hackwaly/task";

const { defineTask } = configInit(import.meta);

export const buildWorld = defineTask({
  name: "build:world",
  command: `node gen_world.js`,
  inputs: ["gen_world.js"],
  outputs: ["world.ts"],
});
