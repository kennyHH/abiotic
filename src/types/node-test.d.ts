declare module 'node:fs' {
  export function existsSync(path: string): boolean;
  const fs: { existsSync: typeof existsSync };
  export default fs;
}

declare module 'node:path' {
  export function resolve(...paths: string[]): string;
  export function join(...paths: string[]): string;
  const path: { resolve: typeof resolve; join: typeof join };
  export default path;
}

declare const process: {
  cwd(): string;
};
