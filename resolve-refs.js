import { join } from 'path';

/**
 * Resolve @bundleName:path references to absolute file paths.
 * @param {string} ref - Reference like "@kanban:agent.md" or plain path
 * @param {Object} bundleDirs - Map of bundleName -> directory path
 * @returns {string} Resolved absolute path
 */
export function resolveRef(ref, bundleDirs) {
  if (typeof ref !== 'string') return ref;
  const match = ref.match(/^@([^:]+):(.+)$/);
  if (!match) return ref;
  const [, bundleName, relPath] = match;
  const dir = bundleDirs[bundleName];
  if (!dir) throw new Error(`Cannot resolve @${bundleName}:${relPath} — bundle '${bundleName}' not found`);
  return join(dir, relPath);
}

/**
 * Scan content for all @bundle:path reference patterns.
 * @param {string} content - Markdown/YAML content to scan
 * @returns {Array<{bundle: string, path: string, full: string}>}
 */
export function scanRefs(content) {
  return [...content.matchAll(/@([a-zA-Z0-9_-]+):([^\s\])"']+)/g)].map(m => ({
    bundle: m[1],
    path: m[2],
    full: m[0],
  }));
}
