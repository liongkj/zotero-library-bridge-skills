import Addon from "./addon";
import { config } from "../package.json";

const zoteroGlobal = (_globalThis as any).Zotero;

if (!zoteroGlobal) {
  throw new Error("Zotero global not available in addon context");
}

if (!zoteroGlobal[config.addonInstance]) {
  _globalThis.Zotero = zoteroGlobal;
  _globalThis.addon = new Addon();
  zoteroGlobal[config.addonInstance] = addon;

  if (!zoteroGlobal.ZoteroLibraryBridge) {
    zoteroGlobal.ZoteroLibraryBridge = addon;
  }

  void addon.hooks.onStartup();
}
