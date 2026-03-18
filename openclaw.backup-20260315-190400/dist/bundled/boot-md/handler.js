import { n as listAgentIds, s as resolveAgentWorkspaceDir } from "../../agent-scope-CiUx4u3k.js";
import "../../paths-C9do7WCN.js";
import { pt as isGatewayStartupEvent, r as defaultRuntime, t as createSubsystemLogger } from "../../subsystem-CGE2Gr4r.js";
import { l as resolveAgentIdFromSessionKey } from "../../session-key-CPPWn8gW.js";
import "../../workspace-Coo0-24P.js";
import "../../model-selection-BNuytbkf.js";
import "../../github-copilot-token-BkwQAVvU.js";
import "../../env-DPWMSs50.js";
import "../../boolean-Ce2-qkSB.js";
import "../../dock-BS4F0Lll.js";
import { n as SILENT_REPLY_TOKEN } from "../../tokens-dsU8rja1.js";
import { a as createDefaultDeps, i as agentCommand } from "../../pi-embedded-CQnl8oWA.js";
import "../../plugins-DDHMQ3QK.js";
import "../../accounts-Ci3cLwUy.js";
import "../../bindings-DKi5BVUO.js";
import "../../send-jFOST1iZ.js";
import "../../send-BPUUbToy.js";
import "../../deliver-DvVWBx7_.js";
import "../../diagnostic-DUeedNNG.js";
import "../../diagnostic-session-state-_tGY1a3B.js";
import "../../accounts-B_Ux_WCM.js";
import "../../send-7Nj0TwhR.js";
import "../../image-ops-ytIXc4y7.js";
import "../../pi-model-discovery-YehKBAM7.js";
import "../../message-channel-BFDfSy61.js";
import "../../pi-embedded-helpers-qnfs15AW.js";
import "../../chrome-DdCy-Bb4.js";
import "../../ssrf-GR1wTjsC.js";
import "../../frontmatter-DMZypGUO.js";
import "../../skills-CBafcFRc.js";
import "../../path-alias-guards-DqPz9Plh.js";
import "../../redact-qRndXuX6.js";
import "../../errors-g-M6e-2M.js";
import "../../fs-safe-DO-sV9tV.js";
import "../../store-Q3603hr3.js";
import { U as resolveMainSessionKey, V as resolveAgentMainSessionKey, d as updateSessionStore, s as loadSessionStore } from "../../sessions-CI-FFiWI.js";
import "../../accounts-hziA-8WI.js";
import { l as resolveStorePath } from "../../paths-_TesRDr4.js";
import "../../tool-images-BpGQaRyx.js";
import "../../thinking-CJoHneR6.js";
import "../../image-BaNRoyvf.js";
import "../../reply-prefix-Co2AbRLk.js";
import "../../manager-DSPfG4vT.js";
import "../../gemini-auth-DK0J4Ghx.js";
import "../../fetch-guard-ClDBVUl3.js";
import "../../query-expansion-BxU3X1gS.js";
import "../../retry-DOgdFVsJ.js";
import "../../target-errors-vh-Ho1G9.js";
import "../../chunk-CnGtY6uJ.js";
import "../../markdown-tables-oQ4TevLw.js";
import "../../local-roots-BHi_eOQs.js";
import "../../ir-Bl7SomkG.js";
import "../../render-loap2gRq.js";
import "../../commands-registry-CWosCgjs.js";
import "../../skill-commands-ByXCSnZg.js";
import "../../runner-B7RghiHU.js";
import "../../fetch-B1nZSYJF.js";
import "../../channel-activity-CiJYZtyi.js";
import "../../tables-BeB5WGBT.js";
import "../../send-B6lYD2tN.js";
import "../../outbound-attachment-BFP3ylsO.js";
import "../../send-u79Dp_NE.js";
import "../../resolve-route-uVkmtG1R.js";
import "../../proxy-Bee2aKQk.js";
import "../../replies-CJ9jMLgI.js";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

//#region src/gateway/boot.ts
function generateBootSessionId() {
	return `boot-${(/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-").replace("T", "_").replace("Z", "")}-${crypto.randomUUID().slice(0, 8)}`;
}
const log$1 = createSubsystemLogger("gateway/boot");
const BOOT_FILENAME = "BOOT.md";
function buildBootPrompt(content) {
	return [
		"You are running a boot check. Follow BOOT.md instructions exactly.",
		"",
		"BOOT.md:",
		content,
		"",
		"If BOOT.md asks you to send a message, use the message tool (action=send with channel + target).",
		"Use the `target` field (not `to`) for message tool destinations.",
		`After sending with the message tool, reply with ONLY: ${SILENT_REPLY_TOKEN}.`,
		`If nothing needs attention, reply with ONLY: ${SILENT_REPLY_TOKEN}.`
	].join("\n");
}
async function loadBootFile(workspaceDir) {
	const bootPath = path.join(workspaceDir, BOOT_FILENAME);
	try {
		const trimmed = (await fs.readFile(bootPath, "utf-8")).trim();
		if (!trimmed) return { status: "empty" };
		return {
			status: "ok",
			content: trimmed
		};
	} catch (err) {
		if (err.code === "ENOENT") return { status: "missing" };
		throw err;
	}
}
function snapshotMainSessionMapping(params) {
	const agentId = resolveAgentIdFromSessionKey(params.sessionKey);
	const storePath = resolveStorePath(params.cfg.session?.store, { agentId });
	try {
		const entry = loadSessionStore(storePath, { skipCache: true })[params.sessionKey];
		if (!entry) return {
			storePath,
			sessionKey: params.sessionKey,
			canRestore: true,
			hadEntry: false
		};
		return {
			storePath,
			sessionKey: params.sessionKey,
			canRestore: true,
			hadEntry: true,
			entry: structuredClone(entry)
		};
	} catch (err) {
		log$1.debug("boot: could not snapshot main session mapping", {
			sessionKey: params.sessionKey,
			error: String(err)
		});
		return {
			storePath,
			sessionKey: params.sessionKey,
			canRestore: false,
			hadEntry: false
		};
	}
}
async function restoreMainSessionMapping(snapshot) {
	if (!snapshot.canRestore) return;
	try {
		await updateSessionStore(snapshot.storePath, (store) => {
			if (snapshot.hadEntry && snapshot.entry) {
				store[snapshot.sessionKey] = snapshot.entry;
				return;
			}
			delete store[snapshot.sessionKey];
		}, { activeSessionKey: snapshot.sessionKey });
		return;
	} catch (err) {
		return err instanceof Error ? err.message : String(err);
	}
}
async function runBootOnce(params) {
	const bootRuntime = {
		log: () => {},
		error: (message) => log$1.error(String(message)),
		exit: defaultRuntime.exit
	};
	let result;
	try {
		result = await loadBootFile(params.workspaceDir);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		log$1.error(`boot: failed to read ${BOOT_FILENAME}: ${message}`);
		return {
			status: "failed",
			reason: message
		};
	}
	if (result.status === "missing" || result.status === "empty") return {
		status: "skipped",
		reason: result.status
	};
	const sessionKey = params.agentId ? resolveAgentMainSessionKey({
		cfg: params.cfg,
		agentId: params.agentId
	}) : resolveMainSessionKey(params.cfg);
	const message = buildBootPrompt(result.content ?? "");
	const sessionId = generateBootSessionId();
	const mappingSnapshot = snapshotMainSessionMapping({
		cfg: params.cfg,
		sessionKey
	});
	let agentFailure;
	try {
		await agentCommand({
			message,
			sessionKey,
			sessionId,
			deliver: false
		}, bootRuntime, params.deps);
	} catch (err) {
		agentFailure = err instanceof Error ? err.message : String(err);
		log$1.error(`boot: agent run failed: ${agentFailure}`);
	}
	const mappingRestoreFailure = await restoreMainSessionMapping(mappingSnapshot);
	if (mappingRestoreFailure) log$1.error(`boot: failed to restore main session mapping: ${mappingRestoreFailure}`);
	if (!agentFailure && !mappingRestoreFailure) return { status: "ran" };
	return {
		status: "failed",
		reason: [agentFailure ? `agent run failed: ${agentFailure}` : void 0, mappingRestoreFailure ? `mapping restore failed: ${mappingRestoreFailure}` : void 0].filter((part) => Boolean(part)).join("; ")
	};
}

//#endregion
//#region src/hooks/bundled/boot-md/handler.ts
const log = createSubsystemLogger("hooks/boot-md");
const runBootChecklist = async (event) => {
	if (!isGatewayStartupEvent(event)) return;
	if (!event.context.cfg) return;
	const cfg = event.context.cfg;
	const deps = event.context.deps ?? createDefaultDeps();
	const agentIds = listAgentIds(cfg);
	for (const agentId of agentIds) {
		const workspaceDir = resolveAgentWorkspaceDir(cfg, agentId);
		const result = await runBootOnce({
			cfg,
			deps,
			workspaceDir,
			agentId
		});
		if (result.status === "failed") {
			log.warn("boot-md failed for agent startup run", {
				agentId,
				workspaceDir,
				reason: result.reason
			});
			continue;
		}
		if (result.status === "skipped") log.debug("boot-md skipped for agent startup run", {
			agentId,
			workspaceDir,
			reason: result.reason
		});
	}
};

//#endregion
export { runBootChecklist as default };