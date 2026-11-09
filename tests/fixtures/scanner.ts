// Inert source strings only. Every fixture contains a scanner-visible command.
// Native probes force deny inside permission evaluation before Shell.create can
// reach its process spawner. Do not add execution-only fixtures here.
export const scannerFixtures = [
  { command: "ls", inspection: true },
  { command: "ls -la", inspection: true },
  { command: "ls -lah", inspection: true },
  { command: "git status", inspection: true },
  { command: "git status --short", inspection: true },
  { command: "git status --porcelain", inspection: true },
  { command: "ls .", inspection: false },
  { command: "ls --recursive", inspection: false },
  { command: "git status --branch", inspection: false },
  { command: "ls && git status", inspection: false },
  { command: "ls | git status", inspection: false },
  { command: "ls", workdir: "packages/app", inspection: true },
  { command: "git status", workdir: "packages/app", inspection: true },
] as const;
