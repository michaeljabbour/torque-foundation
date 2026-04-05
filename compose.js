import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';

/**
 * Resolve includes: chains recursively. Returns augmented manifest map
 * where includes are flattened into depends_on.
 */
export function resolveIncludes(bundleDirs) {
  const manifests = {};
  for (const [name, dir] of Object.entries(bundleDirs)) {
    const mp = join(dir, 'manifest.yml');
    if (!existsSync(mp)) continue;
    manifests[name] = yaml.load(readFileSync(mp, 'utf8'));
  }

  // Recursively flatten includes into depends_on
  const visited = new Set();
  function flatten(name) {
    if (visited.has(name)) return;
    visited.add(name);
    const m = manifests[name];
    if (!m) return;
    const includes = (m.includes || []).map(i => typeof i === 'string' ? i : i.bundle || i.name).filter(Boolean);
    for (const inc of includes) {
      flatten(inc); // Resolve nested includes first
    }
    m.depends_on = [...new Set([...(m.depends_on || []), ...includes])];
  }

  for (const name of Object.keys(manifests)) flatten(name);
  return manifests;
}

/**
 * Compose multiple bundle manifests with merge rules.
 * Later bundles override earlier ones for scalars; arrays accumulate.
 */
export function composeBundles(base, ...overlays) {
  let result = { ...base };
  for (const overlay of overlays) {
    // Tables: namespace-scoped (never merge across bundles)
    // Events: accumulate
    if (overlay.events?.publishes) {
      result.events = result.events || {};
      result.events.publishes = [...(result.events?.publishes || []), ...overlay.events.publishes];
    }
    // Routes: accumulate
    if (overlay.api?.routes) {
      result.api = result.api || {};
      result.api.routes = [...(result.api?.routes || []), ...overlay.api.routes];
    }
    // UI navigation: accumulate
    if (overlay.ui?.navigation) {
      result.ui = result.ui || {};
      result.ui.navigation = [...(result.ui?.navigation || []), ...overlay.ui.navigation];
    }
    // UI routes: accumulate
    if (overlay.ui?.routes) {
      result.ui = result.ui || {};
      result.ui.routes = [...(result.ui?.routes || []), ...overlay.ui.routes];
    }
    // Scalars: last wins
    if (overlay.name) result.name = overlay.name;
    if (overlay.description) result.description = overlay.description;
    if (overlay.version) result.version = overlay.version;
  }
  return result;
}
