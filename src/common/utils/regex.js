// Always escape user input before building a RegExp (prevents invalid-regex 500s and ReDoS).
export const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
