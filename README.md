# @hackwaly/task

A lightweight, TypeScript-native task runner inspired by Turborepo. Define your build pipeline with code, not configuration files.

## Features

- 🚀 **TypeScript-first**: Define tasks in TypeScript with full type safety
- 📦 **Dependency management**: Automatic task dependency resolution and execution
- 👀 **Watch mode**: File watching with intelligent task re-execution
- ⚡ **Parallel execution**: Run independent tasks concurrently
- 🎯 **Persistent tasks**: Support for long-running processes (servers, watchers)
- 🔄 **Interruptible tasks**: Graceful handling of task interruption
- 📁 **Input/Output tracking**: File-based change detection for efficient rebuilds

## Installation

```bash
npm install @hackwaly/task
# or
pnpm add @hackwaly/task
# or
yarn add @hackwaly/task
```

## Quick Start

1. Create a `taskfile.js` in your project root:

```javascript
import { configInit } from "@hackwaly/task";

const { defineTask } = configInit(import.meta);

export const build = defineTask({
  name: "build",
  command: "tsc --build",
  inputs: ["src/**/*.ts", "tsconfig.json"],
  outputs: ["dist/**/*.js"],
});

export const test = defineTask({
  name: "test",
  command: "vitest run",
  dependsOn: [build],
});

export const dev = defineTask({
  name: "dev",
  command: "tsc --watch",
  persistent: true,
});

export default build;
```

2. Run tasks:

```bash
# Run a single task
npx task run build

# Run multiple tasks
npx task run build test

# Run with watch mode
npx task run build --watch

# List available tasks
npx task list
```

## Task Configuration

Tasks are defined using the `defineTask` function with the following options:

```typescript
interface TaskConfig {
  name: string;              // Task name (required)
  description?: string;      // Task description for help text
  command?: string | string[] | { program: string; args?: string[] };
  env?: Record<string, string>;  // Environment variables
  cwd?: string;              // Working directory (defaults to taskfile location)
  inputs?: string[];         // Input file patterns (for change detection)
  outputs?: string[];        // Output file patterns
  persistent?: boolean;      // Whether task runs continuously (like servers)
  interruptible?: boolean;   // Whether task can be interrupted safely
  dependsOn?: TaskDef[];     // Task dependencies
}
```

### Command Formats

Commands can be specified in multiple formats:

```javascript
// String (parsed with shell-like parsing)
command: "tsc --build --verbose"

// Array
command: ["tsc", "--build", "--verbose"]

// Object
command: {
  program: "tsc",
  args: ["--build", "--verbose"]
}
```

### Dependencies

Tasks can depend on other tasks. Dependencies are resolved automatically:

```javascript
export const generateTypes = defineTask({
  name: "generate-types",
  command: "generate-types src/schema.json",
  outputs: ["src/types.ts"],
});

export const build = defineTask({
  name: "build",
  command: "tsc --build",
  inputs: ["src/**/*.ts"],
  dependsOn: [generateTypes],  // Runs generateTypes first
});
```

### Persistent Tasks

For long-running processes like development servers:

```javascript
export const server = defineTask({
  name: "server",
  command: "node server.js",
  persistent: true,        // Runs continuously
  interruptible: true,     // Can be stopped gracefully
});
```

## Watch Mode

Watch mode automatically re-runs tasks when their input files change:

```bash
npx task run build --watch
```

Features:
- Monitors all input patterns defined in tasks
- Ignores `node_modules` by default
- Propagates changes through the dependency graph
- Only reruns tasks that are affected by changes

## Commands

### `run <tasks...>`

Run one or more tasks:

```bash
# Single task
npx task run build

# Multiple tasks
npx task run lint test build

# With watch mode
npx task run build --watch
```

### `list` / `ls`

List all available tasks:

```bash
npx task list
```

Shows task names and descriptions in a formatted table.

## Examples

### Basic Build Pipeline

```javascript
import { configInit } from "@hackwaly/task";

const { defineTask } = configInit(import.meta);

export const lint = defineTask({
  name: "lint",
  description: "Lint TypeScript files",
  command: "eslint src/**/*.ts",
  inputs: ["src/**/*.ts", ".eslintrc.json"],
});

export const typecheck = defineTask({
  name: "typecheck",
  description: "Type check TypeScript files",
  command: "tsc --noEmit",
  inputs: ["src/**/*.ts", "tsconfig.json"],
});

export const build = defineTask({
  name: "build",
  description: "Build the project",
  command: "tsc --build",
  inputs: ["src/**/*.ts", "tsconfig.json"],
  outputs: ["dist/**/*.js"],
  dependsOn: [lint, typecheck],
});

export const test = defineTask({
  name: "test",
  description: "Run tests",
  command: "vitest run",
  dependsOn: [build],
});
```

### Development Workflow

```javascript
export const generateSchema = defineTask({
  name: "generate-schema",
  command: "generate-schema api.yaml",
  inputs: ["api.yaml"],
  outputs: ["src/generated/schema.ts"],
});

export const dev = defineTask({
  name: "dev",
  description: "Start development server",
  command: "vite dev",
  persistent: true,
  interruptible: true,
  dependsOn: [generateSchema],
});

export const buildWatch = defineTask({
  name: "build:watch",
  description: "Build in watch mode",
  command: "tsc --watch",
  persistent: true,
  dependsOn: [generateSchema],
});
```

## Advanced Usage

### Monorepo Support

Each package can have its own `taskfile.js`:

```javascript
// packages/ui/taskfile.js
import { configInit } from "@hackwaly/task";

const { defineTask } = configInit(import.meta);

export const build = defineTask({
  name: "build:ui",
  command: "rollup -c",
  inputs: ["src/**/*", "rollup.config.js"],
  outputs: ["dist/**/*"],
});

// packages/app/taskfile.js
import { build as buildUI } from "../ui/taskfile.js";

export const build = defineTask({
  name: "build:app",
  command: "vite build",
  dependsOn: [buildUI],  // Cross-package dependency
});
```

### Custom Task Logic

For complex tasks, you can provide custom logic:

```javascript
export const customTask = defineTask({
  name: "custom",
  async run(ctx) {
    // Custom async logic
    console.log("Running custom task...");

    // Check if aborted
    if (ctx.abort.aborted) {
      return;
    }

    // Your custom logic here
  },
  inputs: ["src/**/*"],
});
```

## Requirements

- Node.js 18+ with `--experimental-strip-types` support

## License

MIT
