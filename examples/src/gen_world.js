import * as NodeFs from "node:fs/promises";
import * as NodePath from "node:path";
await NodeFs.writeFile(NodePath.join(import.meta.dirname, "world.ts"), "export const world = 'World4';\n");
