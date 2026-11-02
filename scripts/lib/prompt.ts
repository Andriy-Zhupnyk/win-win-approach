// Interactive terminal prompts for the owner-run scripts. The secret prompt
// never echoes what is typed and never returns anything but the typed value;
// nothing in here logs or prints it.
import readline from "node:readline";

export type Prompter = {
  ask(question: string): Promise<string>;
  askSecret(question: string): Promise<string>;
  confirm(question: string): Promise<boolean>;
};

export class PromptAbortedError extends Error {
  constructor() {
    super("Aborted.");
  }
}

export class NotInteractiveError extends Error {
  constructor() {
    super(
      "This script needs an interactive terminal (stdin and stdout must be TTYs). " +
        "On Windows use PowerShell or Windows Terminal, or run Git Bash through `winpty`.",
    );
  }
}

/** Plain-text question (email, yes/no). Echoes input as usual. */
function ask(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve, reject) => {
    rl.on("close", () => reject(new PromptAbortedError()));
    rl.question(question, (answer) => {
      rl.removeAllListeners("close");
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Reads one line from the TTY in raw mode without echoing any character.
 * Refuses to run when stdin is not a TTY, so the password can never be piped
 * in from a file or a command line (it would end up in history or a file).
 */
function askSecret(question: string): Promise<string> {
  const { stdin, stdout } = process;
  if (!stdin.isTTY || !stdout.isTTY || typeof stdin.setRawMode !== "function") {
    return Promise.reject(new NotInteractiveError());
  }
  return new Promise((resolve, reject) => {
    let value = "";
    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    const finish = (action: () => void) => {
      stdin.removeListener("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write("\n");
      action();
    };

    const onData = (chunk: string) => {
      // A paste arrives as one multi-character chunk.
      for (const char of chunk) {
        if (char === "\r" || char === "\n") {
          finish(() => resolve(value));
          return;
        }
        if (char === "\u0003" || char === "\u0004") {
          finish(() => reject(new PromptAbortedError()));
          return;
        }
        if (char === "\u007f" || char === "\b") {
          value = value.slice(0, -1);
          continue;
        }
        // Ignore other control characters (arrows, escape sequences).
        if (char >= " ") {
          value += char;
        }
      }
    };

    stdin.on("data", onData);
  });
}

export const terminalPrompter: Prompter = {
  ask,
  askSecret,
  async confirm(question) {
    const answer = await ask(`${question} (yes/no): `);
    return answer.toLowerCase() === "yes";
  },
};
