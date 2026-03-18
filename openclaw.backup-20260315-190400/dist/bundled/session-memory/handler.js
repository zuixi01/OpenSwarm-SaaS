import { s as resolveAgentWorkspaceDir } from "../../agent-scope-CiUx4u3k.js";
import { s as resolveStateDir } from "../../paths-C9do7WCN.js";
import { t as createSubsystemLogger } from "../../subsystem-CGE2Gr4r.js";
import { l as resolveAgentIdFromSessionKey } from "../../session-key-CPPWn8gW.js";
import "../../workspace-Coo0-24P.js";
import "../../model-selection-BNuytbkf.js";
import "../../github-copilot-token-BkwQAVvU.js";
import "../../env-DPWMSs50.js";
import "../../boolean-Ce2-qkSB.js";
import "../../dock-BS4F0Lll.js";
import "../../tokens-dsU8rja1.js";
import "../../pi-embedded-CQnl8oWA.js";
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
import { O as hasInterSessionUserProvenance } from "../../sessions-CI-FFiWI.js";
import "../../accounts-hziA-8WI.js";
import "../../paths-_TesRDr4.js";
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
import { generateSlugViaLLM } from "../../llm-slug-generator.js";
import { t as resolveHookConfig } from "../../config-BeIwBEE4.js";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

//#region src/hooks/bundled/session-memory/handler.ts
/**
* Session memory hook handler
*
* Saves session context to memory when /new or /reset command is triggered
* Creates a new dated memory file with LLM-generated slug
*/
const log = createSubsystemLogger("hooks/session-memory");
/**
* Read recent messages from session file for slug generation
*/
async function getRecentSessionContent(sessionFilePath, messageCount = 15) {
	try {
		const lines = (await fs.readFile(sessionFilePath, "utf-8")).trim().split("\n");
		const allMessages = [];
		for (const line of lines) try {
			const entry = JSON.parse(line);
			if (entry.type === "message" && entry.message) {
				const msg = entry.message;
				const role = msg.role;
				if ((role === "user" || role === "assistant") && msg.content) {
					if (role === "user" && hasInterSessionUserProvenance(msg)) continue;
					const text = Array.isArray(msg.content) ? msg.content.find((c) => c.type === "text")?.text : msg.content;
					if (text && !text.startsWith("/")) allMessages.push(`${role}: ${text}`);
				}
			}
		} catch {}
		return allMessages.slice(-messageCount).join("\n");
	} catch {
		return null;
	}
}
/**
* Try the active transcript first; if /new already rotated it,
* fallback to the latest .jsonl.reset.* sibling.
*/
async function getRecentSessionContentWithResetFallback(sessionFilePath, messageCount = 15) {
	const primary = await getRecentSessionContent(sessionFilePath, messageCount);
	if (primary) return primary;
	try {
		const dir = path.dirname(sessionFilePath);
		const resetPrefix = `${path.basename(sessionFilePath)}.reset.`;
		const resetCandidates = (await fs.readdir(dir)).filter((name) => name.startsWith(resetPrefix)).toSorted();
		if (resetCandidates.length === 0) return primary;
		const latestResetPath = path.join(dir, resetCandidates[resetCandidates.length - 1]);
		const fallback = await getRecentSessionContent(latestResetPath, messageCount);
		if (fallback) log.debug("Loaded session content from reset fallback", {
			sessionFilePath,
			latestResetPath
		});
		return fallback || primary;
	} catch {
		return primary;
	}
}
function stripResetSuffix(fileName) {
	const resetIndex = fileName.indexOf(".reset.");
	return resetIndex === -1 ? fileName : fileName.slice(0, resetIndex);
}
async function findPreviousSessionFile(params) {
	try {
		const files = await fs.readdir(params.sessionsDir);
		const fileSet = new Set(files);
		const baseFromReset = params.currentSessionFile ? stripResetSuffix(path.basename(params.currentSessionFile)) : void 0;
		if (baseFromReset && fileSet.has(baseFromReset)) return path.join(params.sessionsDir, baseFromReset);
		const trimmedSessionId = params.sessionId?.trim();
		if (trimmedSessionId) {
			const canonicalFile = `${trimmedSessionId}.jsonl`;
			if (fileSet.has(canonicalFile)) return path.join(params.sessionsDir, canonicalFile);
			const topicVariants = files.filter((name) => name.startsWith(`${trimmedSessionId}-topic-`) && name.endsWith(".jsonl") && !name.includes(".reset.")).toSorted().toReversed();
			if (topicVariants.length > 0) return path.join(params.sessionsDir, topicVariants[0]);
		}
		if (!params.currentSessionFile) return;
		const nonResetJsonl = files.filter((name) => name.endsWith(".jsonl") && !name.includes(".reset.")).toSorted().toReversed();
		if (nonResetJsonl.length > 0) return path.join(params.sessionsDir, nonResetJsonl[0]);
	} catch {}
}
/**
* Save session context to memory when /new or /reset command is triggered
*/
const saveSessionToMemory = async (event) => {
	const isResetCommand = event.action === "new" || event.action === "reset";
	if (event.type !== "command" || !isResetCommand) return;
	try {
		log.debug("Hook triggered for reset/new command", { action: event.action });
		const context = event.context || {};
		const cfg = context.cfg;
		const agentId = resolveAgentIdFromSessionKey(event.sessionKey);
		const workspaceDir = cfg ? resolveAgentWorkspaceDir(cfg, agentId) : path.join(resolveStateDir(process.env, os.homedir), "workspace");
		const memoryDir = path.join(workspaceDir, "memory");
		await fs.mkdir(memoryDir, { recursive: true });
		const now = new Date(event.timestamp);
		const dateStr = now.toISOString().split("T")[0];
		const sessionEntry = context.previousSessionEntry || context.sessionEntry || {};
		const currentSessionId = sessionEntry.sessionId;
		let currentSessionFile = sessionEntry.sessionFile || void 0;
		if (!currentSessionFile || currentSessionFile.includes(".reset.")) {
			const sessionsDirs = /* @__PURE__ */ new Set();
			if (currentSessionFile) sessionsDirs.add(path.dirname(currentSessionFile));
			sessionsDirs.add(path.join(workspaceDir, "sessions"));
			for (const sessionsDir of sessionsDirs) {
				const recoveredSessionFile = await findPreviousSessionFile({
					sessionsDir,
					currentSessionFile,
					sessionId: currentSessionId
				});
				if (!recoveredSessionFile) continue;
				currentSessionFile = recoveredSessionFile;
				log.debug("Found previous session file", { file: currentSessionFile });
				break;
			}
		}
		log.debug("Session context resolved", {
			sessionId: currentSessionId,
			sessionFile: currentSessionFile,
			hasCfg: Boolean(cfg)
		});
		const sessionFile = currentSessionFile || void 0;
		const hookConfig = resolveHookConfig(cfg, "session-memory");
		const messageCount = typeof hookConfig?.messages === "number" && hookConfig.messages > 0 ? hookConfig.messages : 15;
		let slug = null;
		let sessionContent = null;
		if (sessionFile) {
			sessionContent = await getRecentSessionContentWithResetFallback(sessionFile, messageCount);
			log.debug("Session content loaded", {
				length: sessionContent?.length ?? 0,
				messageCount
			});
			const allowLlmSlug = !(process.env.OPENCLAW_TEST_FAST === "1" || process.env.VITEST === "true" || process.env.VITEST === "1" || false) && hookConfig?.llmSlug !== false;
			if (sessionContent && cfg && allowLlmSlug) {
				log.debug("Calling generateSlugViaLLM...");
				slug = await generateSlugViaLLM({
					sessionContent,
					cfg
				});
				log.debug("Generated slug", { slug });
			}
		}
		if (!slug) {
			slug = now.toISOString().split("T")[1].split(".")[0].replace(/:/g, "").slice(0, 4);
			log.debug("Using fallback timestamp slug", { slug });
		}
		const filename = `${dateStr}-${slug}.md`;
		const memoryFilePath = path.join(memoryDir, filename);
		log.debug("Memory file path resolved", {
			filename,
			path: memoryFilePath.replace(os.homedir(), "~")
		});
		const timeStr = now.toISOString().split("T")[1].split(".")[0];
		const sessionId = sessionEntry.sessionId || "unknown";
		const source = context.commandSource || "unknown";
		const entryParts = [
			`# Session: ${dateStr} ${timeStr} UTC`,
			"",
			`- **Session Key**: ${event.sessionKey}`,
			`- **Session ID**: ${sessionId}`,
			`- **Source**: ${source}`,
			""
		];
		if (sessionContent) entryParts.push("## Conversation Summary", "", sessionContent, "");
		const entry = entryParts.join("\n");
		await fs.writeFile(memoryFilePath, entry, "utf-8");
		log.debug("Memory file written successfully");
		const relPath = memoryFilePath.replace(os.homedir(), "~");
		log.info(`Session context saved to ${relPath}`);
	} catch (err) {
		if (err instanceof Error) log.error("Failed to save session memory", {
			errorName: err.name,
			errorMessage: err.message,
			stack: err.stack
		});
		else log.error("Failed to save session memory", { error: String(err) });
	}
};

//#endregion
export { saveSessionToMemory as default };