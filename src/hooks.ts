import { config } from "../package.json";
import ZoteroLibraryBridge from "./modules/libraryBridge";

function log(message: string, error?: unknown) {
  if (error) {
    Zotero.debug(`[${config.addonRef}] ${message}: ${String(error)}`);
  } else {
    Zotero.debug(`[${config.addonRef}] ${message}`);
  }
}

async function onStartup() {
  await Promise.all([Zotero.initializationPromise, Zotero.uiReadyPromise]);

  if (!addon.data.bridge) {
    try {
      addon.data.bridge = new ZoteroLibraryBridge();
      addon.data.bridge.start();
      log("library bridge started");
    } catch (error) {
      log("library bridge startup failed", error);
    }
  }
}

async function onMainWindowLoad(_win: Window): Promise<void> {
  // no-op
}

async function onMainWindowUnload(_win: Window): Promise<void> {
  // no-op
}

function onShutdown(): void {
  try {
    addon.data.bridge?.stop?.();
  } catch (error) {
    log("library bridge shutdown failed", error);
  }

  addon.data.alive = false;
  delete (Zotero as any)[config.addonInstance];
}

async function onNotify(
  _event: string,
  _type: string,
  _ids: Array<string | number>,
  _extraData: { [key: string]: any },
) {
  // no-op
}

async function onPrefsEvent(_type: string, _data: { [key: string]: any }) {
  // no-op
}

export default {
  onStartup,
  onShutdown,
  onMainWindowLoad,
  onMainWindowUnload,
  onNotify,
  onPrefsEvent,
};
