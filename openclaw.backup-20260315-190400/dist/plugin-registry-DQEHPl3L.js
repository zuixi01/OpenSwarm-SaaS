import { t as __exportAll } from "./rolldown-runtime-Cbj13DAv.js";
import { ht as loadOpenClawPlugins } from "./reply-Deht_wOB.js";
import { d as resolveDefaultAgentId, u as resolveAgentWorkspaceDir } from "./agent-scope-CUpt2978.js";
import { E as getActivePluginRegistry, t as createSubsystemLogger } from "./subsystem-DypCPrmP.js";
import { Rt as loadConfig } from "./model-selection-J6oFwo9y.js";

//#region src/cli/plugin-registry.ts
var plugin_registry_exports = /* @__PURE__ */ __exportAll({ ensurePluginRegistryLoaded: () => ensurePluginRegistryLoaded });
const log = createSubsystemLogger("plugins");
let pluginRegistryLoaded = false;
function ensurePluginRegistryLoaded() {
	if (pluginRegistryLoaded) return;
	const active = getActivePluginRegistry();
	if (active && (active.plugins.length > 0 || active.channels.length > 0 || active.tools.length > 0)) {
		pluginRegistryLoaded = true;
		return;
	}
	const config = loadConfig();
	loadOpenClawPlugins({
		config,
		workspaceDir: resolveAgentWorkspaceDir(config, resolveDefaultAgentId(config)),
		logger: {
			info: (msg) => log.info(msg),
			warn: (msg) => log.warn(msg),
			error: (msg) => log.error(msg),
			debug: (msg) => log.debug(msg)
		}
	});
	pluginRegistryLoaded = true;
}

//#endregion
export { plugin_registry_exports as n, ensurePluginRegistryLoaded as t };