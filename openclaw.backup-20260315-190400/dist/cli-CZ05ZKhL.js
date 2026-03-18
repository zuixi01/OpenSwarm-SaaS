import { s as createSubsystemLogger } from "./entry.js";
import { j as loadConfig } from "./auth-profiles-6WJHPoy1.js";
import { d as resolveDefaultAgentId, u as resolveAgentWorkspaceDir } from "./agent-scope-C2k6BQnt.js";
import "./openclaw-root-C9tYgTzw.js";
import "./exec-BhaMholX.js";
import "./github-copilot-token-DKRiM6oj.js";
import "./host-env-security-BM8ktVlo.js";
import "./env-vars-DPtuUD7z.js";
import "./manifest-registry-HLdbjiS7.js";
import "./dock-B6idJaIX.js";
import "./model-CCg-E8K2.js";
import "./pi-model-discovery-BCUHcNVb.js";
import "./frontmatter-DzgKaILZ.js";
import "./skills-DOryi61N.js";
import "./path-alias-guards-BpvAiXds.js";
import "./message-channel-CJUwnCYd.js";
import "./sessions-CRMuaVTk.js";
import "./plugins-BOmV0yTv.js";
import "./accounts-jTTYYc3C.js";
import "./accounts-CnxuiQaw.js";
import "./accounts-DKgW2m_s.js";
import "./bindings-DcFNU_QL.js";
import "./logging-Cr3Gsq0-.js";
import "./send-Dwpn9TDt.js";
import "./send-CRKuzy2V.js";
import { _ as loadOpenClawPlugins } from "./subagent-registry-CVXe4Cfs.js";
import "./paths-ANQqR741.js";
import "./chat-envelope-CrHAOMhr.js";
import "./client-C2kv9X_7.js";
import "./call-D_7wmgxh.js";
import "./pairing-token-DzfCmsrM.js";
import "./net-DBrsyv8q.js";
import "./ip-BDxIP8rd.js";
import "./tailnet-Ca1WnFBq.js";
import "./tokens-DytUXmpb.js";
import "./with-timeout-DBSF8WcF.js";
import "./deliver-DIzJJMMZ.js";
import "./diagnostic-ilkPeYFb.js";
import "./diagnostic-session-state-Cw3EMvZy.js";
import "./send-DslMV0Oj.js";
import "./image-ops-WZr1HLCX.js";
import "./pi-embedded-helpers-CpQ-YZT5.js";
import "./sandbox-DY8nmmZL.js";
import "./tool-catalog-DABanDxl.js";
import "./chrome-CUDdqGYS.js";
import "./tailscale-Cz0j5H8x.js";
import "./auth-ML-4Xoce.js";
import "./server-context-cmI3JR7x.js";
import "./paths-CjmqZPVj.js";
import "./redact-Dcypez3H.js";
import "./errors-Cu3BYw29.js";
import "./fs-safe-BhLTWc_h.js";
import "./ssrf-Bte-xH9B.js";
import "./store-BXu3Rh07.js";
import "./ports-B9YOEPbT.js";
import "./trash-C8oZT55U.js";
import "./server-middleware-CksvUSHW.js";
import "./tool-images-DRFHeGdm.js";
import "./thinking-DW6CKWyf.js";
import "./models-config-Bx4oz_93.js";
import "./exec-approvals-allowlist-DhyOcuIh.js";
import "./exec-safe-bin-runtime-policy-BHphvzQc.js";
import "./reply-prefix-CJW3v-NP.js";
import "./memory-cli-cR4ZIIF8.js";
import "./manager-Z4x-EJPX.js";
import "./gemini-auth-C3KxuDfq.js";
import "./fetch-guard-DVFm6--m.js";
import "./query-expansion-CP14Ly4R.js";
import "./retry-DRMxSLyf.js";
import "./target-errors-DxuxEzkD.js";
import "./chunk-BzS5RYkf.js";
import "./markdown-tables-BbZ9SxYi.js";
import "./local-roots-CfYn4rwg.js";
import "./ir-Dmlv7Kna.js";
import "./render-C1H8wE-4.js";
import "./commands-CQRE0cc7.js";
import "./commands-registry-B0c36EOd.js";
import "./image-n4jQhuqR.js";
import "./tool-display-FacPPVzc.js";
import "./runner-BILcju_L.js";
import "./model-catalog-BiejcmsY.js";
import "./fetch-CgA7FwwB.js";
import "./pairing-store-CP4oUWWz.js";
import "./exec-approvals-UjbIDJw1.js";
import "./nodes-screen-BNq9DmvM.js";
import "./session-utils-BfRjbw9w.js";
import "./session-cost-usage-B1Kk2v41.js";
import "./skill-commands-DjngalJj.js";
import "./workspace-dirs-fckC5OJF.js";
import "./channel-activity-wMIoQsvx.js";
import "./tables-D0MmOQ59.js";
import "./server-lifecycle-BaTarhyt.js";
import "./stagger-BJGKxryR.js";
import "./channel-selection-67xZBvtg.js";
import "./plugin-auto-enable-BE71Amqa.js";
import "./send-C9rz8MA2.js";
import "./outbound-attachment-Cmwd3qUD.js";
import "./delivery-queue-C7pBPro_.js";
import "./send-DILNYHCF.js";
import "./resolve-route-DkJH7CNt.js";
import "./system-run-command-D0tcgV6x.js";
import "./pi-tools.policy-DqbBHZcv.js";
import "./proxy-C-FYeH9g.js";
import "./links-yQMT2QcX.js";
import "./cli-utils-CKDCmKAq.js";
import "./help-format-Du-bXlH0.js";
import "./progress-bvyZjsUc.js";
import "./replies-Bmi8F2Iv.js";
import "./onboard-helpers-CUuJedqj.js";
import "./prompt-style-wsroINzm.js";
import "./pairing-labels-DE-VLlA3.js";

//#region src/plugins/cli.ts
const log = createSubsystemLogger("plugins");
function registerPluginCliCommands(program, cfg) {
	const config = cfg ?? loadConfig();
	const workspaceDir = resolveAgentWorkspaceDir(config, resolveDefaultAgentId(config));
	const logger = {
		info: (msg) => log.info(msg),
		warn: (msg) => log.warn(msg),
		error: (msg) => log.error(msg),
		debug: (msg) => log.debug(msg)
	};
	const registry = loadOpenClawPlugins({
		config,
		workspaceDir,
		logger
	});
	const existingCommands = new Set(program.commands.map((cmd) => cmd.name()));
	for (const entry of registry.cliRegistrars) {
		if (entry.commands.length > 0) {
			const overlaps = entry.commands.filter((command) => existingCommands.has(command));
			if (overlaps.length > 0) {
				log.debug(`plugin CLI register skipped (${entry.pluginId}): command already registered (${overlaps.join(", ")})`);
				continue;
			}
		}
		try {
			const result = entry.register({
				program,
				config,
				workspaceDir,
				logger
			});
			if (result && typeof result.then === "function") result.catch((err) => {
				log.warn(`plugin CLI register failed (${entry.pluginId}): ${String(err)}`);
			});
			for (const command of entry.commands) existingCommands.add(command);
		} catch (err) {
			log.warn(`plugin CLI register failed (${entry.pluginId}): ${String(err)}`);
		}
	}
}

//#endregion
export { registerPluginCliCommands };