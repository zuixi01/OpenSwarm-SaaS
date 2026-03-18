import "./paths-B4BZAPZh.js";
import "./utils-BKDT474X.js";
import "./thinking-EAliFiVK.js";
import { ht as loadOpenClawPlugins } from "./reply-Deht_wOB.js";
import { d as resolveDefaultAgentId, u as resolveAgentWorkspaceDir } from "./agent-scope-CUpt2978.js";
import { t as createSubsystemLogger } from "./subsystem-DypCPrmP.js";
import "./openclaw-root-PhSD0wUu.js";
import "./exec-X_fw5eJV.js";
import { Rt as loadConfig } from "./model-selection-J6oFwo9y.js";
import "./github-copilot-token-nncItI8D.js";
import "./boolean-Wzu0-e0P.js";
import "./env-B5XQ5e-9.js";
import "./host-env-security-lcjXF83D.js";
import "./env-vars-Duxu9t5m.js";
import "./manifest-registry-DQsiKxT_.js";
import "./dock-xZn_ilyf.js";
import "./message-channel-BFAJAoI_.js";
import "./send-DV19W-o1.js";
import "./runner-DMMMVobY.js";
import "./image-DHJnnDh5.js";
import "./models-config-BimjyIkA.js";
import "./pi-model-discovery-DCK8tt6v.js";
import "./pi-embedded-helpers-C1fyO3tV.js";
import "./sandbox-DVLj_3bK.js";
import "./tool-catalog-BWgva5h1.js";
import "./chrome-9lm2infi.js";
import "./tailscale-DgFgUW99.js";
import "./ip-DK-vcRii.js";
import "./tailnet-kbXXH7kK.js";
import "./ws-zZ6eXqMi.js";
import "./auth-DokunS-s.js";
import "./server-context-C4JQn68-.js";
import "./frontmatter-C8fqIiB_.js";
import "./skills-CTCu9kyq.js";
import "./path-alias-guards-DkmbVRdv.js";
import "./paths-Dxw90pcQ.js";
import "./redact-B76y7XVG.js";
import "./errors-8IxbaLwV.js";
import "./fs-safe-9B-VHIh9.js";
import "./ssrf-DN6IsWAy.js";
import "./image-ops-DKdGMPEO.js";
import "./store-5dMbPc1E.js";
import "./ports-Cyh6xQxA.js";
import "./trash-Dd-0scMD.js";
import "./server-middleware-BqKURFqJ.js";
import "./sessions-Hkcy8tM7.js";
import "./plugins-D13me3z9.js";
import "./accounts-CbSDbxsL.js";
import "./accounts-B-amtsmS.js";
import "./accounts-by8A9Yl7.js";
import "./bindings-Ugi9eu0k.js";
import "./logging-_TuF9Wz5.js";
import "./send-D2cn-JVn.js";
import "./paths-CxPj6Z2y.js";
import "./chat-envelope-CZCr0x5F.js";
import "./tool-images-UJsxlzPQ.js";
import "./tool-display-CERZKWmU.js";
import "./fetch-guard-CVpSbg3c.js";
import "./api-key-rotation-ASd_3Q06.js";
import "./local-roots-D3Zp1XAW.js";
import "./model-catalog-CPznmlMd.js";
import "./tokens-LFopHMoh.js";
import "./deliver-DzVpHq63.js";
import "./commands-BnuDjfQ7.js";
import "./commands-registry-CTrWxHEa.js";
import "./client-EwxHy0Jk.js";
import "./call-Dx-c0m2G.js";
import "./pairing-token-BdLe8Jtz.js";
import "./fetch-CfmRs4ph.js";
import "./retry-DaYeUuIS.js";
import "./pairing-store-B53Nki6F.js";
import "./exec-approvals-Coe3V-Ad.js";
import "./exec-approvals-allowlist-IM79qENF.js";
import "./exec-safe-bin-runtime-policy-DtuQqNAP.js";
import "./nodes-screen-BJA7sZ0c.js";
import "./target-errors-C-BLJJgu.js";
import "./diagnostic-session-state-BCQ_xRK9.js";
import "./with-timeout-BV2THSR3.js";
import "./diagnostic-nLkEtXii.js";
import "./send-DWL38WYk.js";
import "./model-BHwbm5WN.js";
import "./reply-prefix-CSXMdi-8.js";
import "./memory-cli-C82-TvAl.js";
import "./manager-DUv9QiYQ.js";
import "./query-expansion-CJ6fu-ua.js";
import "./chunk-B8zx2WnL.js";
import "./markdown-tables-B3pxFz1L.js";
import "./ir-Di75e_Ot.js";
import "./render-CAaBsF7l.js";
import "./pi-tools.policy-C8K-rNTV.js";
import "./channel-activity-ChavUAf9.js";
import "./tables-B20o3aCd.js";
import "./send-Bjbs28Nj.js";
import "./proxy-DZJY4nKm.js";
import "./links-_OmPhBsv.js";
import "./cli-utils-CzIyxbam.js";
import "./help-format-CWJQePOA.js";
import "./progress-OUlzaka3.js";
import "./resolve-route-DeUwIMSW.js";
import "./replies-_S2QUL80.js";
import "./skill-commands-c6PT-O_k.js";
import "./workspace-dirs-CXWUoYT2.js";
import "./plugin-auto-enable-ClrgoY6j.js";
import "./channel-selection-DD21LJnf.js";
import "./outbound-attachment-DMMlTyYf.js";
import "./delivery-queue-C9RsX5zv.js";
import "./session-cost-usage-CjEHEp-I.js";
import "./send-CGK40hed.js";
import "./onboard-helpers-qfrMQvIt.js";
import "./prompt-style-CQUEv9Gp.js";
import "./pairing-labels-CqZcrrWU.js";
import "./server-lifecycle-D1-L8T0s.js";
import "./stagger-DCVgoPuj.js";
import "./system-run-command-BTYHg9i6.js";

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