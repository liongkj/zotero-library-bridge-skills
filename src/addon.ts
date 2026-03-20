import hooks from "./hooks";

class Addon {
  public data: {
    alive: boolean;
    // Env type, see build.js
    env: "development" | "production";
    bridge?: any;
  };
  // Lifecycle hooks
  public hooks: typeof hooks;
  // APIs
  public api: {
    [key: string]: any;
    
  };

  constructor() {
    this.data = {
      alive: true,
      env: __env__,
    };
    this.hooks = hooks;
    this.api = {};
  }
}

export default Addon;
