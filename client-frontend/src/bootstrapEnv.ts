export {}

(globalThis as { __VITE_ENV__?: Record<string, string | boolean | undefined> }).__VITE_ENV__ = {
  ...(globalThis as { __VITE_ENV__?: Record<string, string | boolean | undefined> }).__VITE_ENV__,
  ...import.meta.env,
}
