const isDev = process.env.NODE_ENV === "development"

export const logger = {
  info:  (...args: unknown[]) => isDev && console.info("[Noble Job]", ...args),
  error: (...args: unknown[]) => console.error("[Noble Job ERROR]", ...args),
  warn:  (...args: unknown[]) => console.warn("[Noble Job WARN]", ...args),
}
