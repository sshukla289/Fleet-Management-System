export function readViteEnv(name: string): string | undefined {
  const runtimeConfig = globalThis as { __VITE_ENV__?: Record<string, string | undefined> }
  return runtimeConfig.__VITE_ENV__?.[name]
}
