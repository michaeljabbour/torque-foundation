/**
 * LazyBundleProxy — placeholder for a bundle that hasn't been activated yet.
 * Stores config and directory path until first access triggers real loading.
 */
export class LazyBundleProxy {
  constructor(name, { config, dir, manifest }) {
    this.name = name;
    this.config = config;
    this.dir = dir;
    this.manifest = manifest;
    this._activated = false;
  }

  get isLazy() { return true; }
  get isActivated() { return this._activated; }

  markActivated() {
    this._activated = true;
  }

  /**
   * Get the route patterns this lazy bundle would handle.
   * Used to register stub routes that trigger activation.
   */
  getRoutePatterns() {
    if (!this.manifest?.api?.routes) return [];
    return this.manifest.api.routes.map(r => ({
      method: (r.method || 'GET').toUpperCase(),
      path: r.path,
      handler: r.handler,
      auth: r.auth,
    }));
  }

  /**
   * Get the interface names this lazy bundle would expose.
   * Used to register stubs in the coordinator.
   */
  getInterfaceNames() {
    return this.manifest?.interfaces?.queries || [];
  }
}
