function readStaticViteEnv() {
  try {
    return new Function('return typeof import !== "undefined" && import.meta && import.meta.env ? import.meta.env : undefined')() as
      | Record<string, string | boolean | undefined>
      | undefined
  } catch {
    return undefined
  }
}

export function readViteEnv(name: string): string | undefined {
  const runtimeConfig = globalThis as { __VITE_ENV__?: Record<string, string | undefined> }
  const runtimeValue = runtimeConfig.__VITE_ENV__?.[name]
  if (typeof runtimeValue === 'string' && runtimeValue.trim()) {
    return runtimeValue
  }

  const viteEnv = readStaticViteEnv()
  const staticValue = viteEnv?.[name]
  return typeof staticValue === 'string' && staticValue.trim() ? staticValue : undefined
}
