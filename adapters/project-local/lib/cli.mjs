export class ExitError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ExitError";
    this.code = code;
  }
}

function toCamelCase(flag) {
  return flag.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

export function parseArgs(argv, spec) {
  const result = {};
  for (const [flag, definition] of Object.entries(spec)) {
    result[toCamelCase(flag)] =
      definition.type === "boolean" ? false : (definition.default ?? null);
  }

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--"))
      throw new ExitError(1, `Unexpected argument: ${token}`);

    const [flag, inlineValue] = splitFlag(token.slice(2));
    const definition = spec[flag];
    if (!definition) throw new ExitError(1, `Unknown option: --${flag}`);

    if (definition.type === "boolean") {
      if (inlineValue !== null)
        throw new ExitError(1, `Option --${flag} does not take a value.`);
      result[toCamelCase(flag)] = true;
      continue;
    }

    const value = inlineValue ?? argv[++index];
    if (value === undefined || value.startsWith("--")) {
      throw new ExitError(1, `Option --${flag} requires a value.`);
    }
    if (definition.choices && !definition.choices.includes(value)) {
      throw new ExitError(
        1,
        `Option --${flag} must be one of: ${definition.choices.join(", ")}. Received: ${value}`,
      );
    }
    result[toCamelCase(flag)] = value;
  }

  for (const [flag, definition] of Object.entries(spec)) {
    if (definition.required && !result[toCamelCase(flag)]) {
      throw new ExitError(1, `Option --${flag} is required.`);
    }
  }

  return result;
}

function splitFlag(token) {
  const separator = token.indexOf("=");
  if (separator === -1) return [token, null];
  return [token.slice(0, separator), token.slice(separator + 1)];
}

export function renderUsage(name, spec, extraLines = []) {
  const lines = [`Usage: node adapters/project-local/${name} [options]`, ""];
  const width = Math.max(...Object.keys(spec).map((flag) => flag.length)) + 2;
  for (const [flag, definition] of Object.entries(spec)) {
    const label =
      definition.type === "boolean" ? `--${flag}` : `--${flag} <value>`;
    const notes = [];
    if (definition.choices) notes.push(definition.choices.join("|"));
    if (definition.default) notes.push(`default: ${definition.default}`);
    if (definition.required) notes.push("required");
    const suffix = notes.length > 0 ? ` (${notes.join(", ")})` : "";
    lines.push(`  ${label.padEnd(width + 8)}${definition.describe}${suffix}`);
  }
  return [...lines, ...(extraLines.length > 0 ? ["", ...extraLines] : [])].join(
    "\n",
  );
}

export const log = {
  step(message) {
    process.stdout.write(`==> ${message}\n`);
  },
  info(message) {
    process.stdout.write(`    ${message}\n`);
  },
  plan(message) {
    process.stdout.write(`    [dry-run] ${message}\n`);
  },
  warn(message) {
    process.stdout.write(`    warning: ${message}\n`);
  },
  ok(message) {
    process.stdout.write(`    ok: ${message}\n`);
  },
};

export function runMain(main) {
  main().catch((error) => {
    if (error instanceof ExitError) {
      process.stderr.write(`${error.message}\n`);
      process.exit(error.code);
    }
    process.stderr.write(`${error?.stack ?? error}\n`);
    process.exit(1);
  });
}
