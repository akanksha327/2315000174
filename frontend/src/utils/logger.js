export const logger = {
  info(action, data = {}) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "info",
      action,
      ...data
    }));
  },
  error(action, error, data = {}) {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "error",
      action,
      message: error?.message || String(error),
      stack: error?.stack,
      ...data
    }));
  },
  warn(action, message, data = {}) {
    console.warn(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "warn",
      action,
      message,
      ...data
    }));
  }
};
