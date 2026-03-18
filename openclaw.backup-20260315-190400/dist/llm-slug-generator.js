import { a as resolveAgentEffectiveModelPrimary, c as resolveDefaultAgentId, i as resolveAgentDir, s as resolveAgentWorkspaceDir } from "./agent-scope-CiUx4u3k.js";
import "./paths-C9do7WCN.js";
import { t as createSubsystemLogger } from "./subsystem-CGE2Gr4r.js";
import "./workspace-Coo0-24P.js";
import { bn as DEFAULT_PROVIDER, l as parseModelRef, yn as DEFAULT_MODEL } from "./model-selection-BNuytbkf.js";
import "./github-copilot-token-BkwQAVvU.js";
import "./env-DPWMSs50.js";
import "./boolean-Ce2-qkSB.js";
import "./dock-BS4F0Lll.js";
import "./tokens-dsU8rja1.js";
import { t as runEmbeddedPiAgent } from "./pi-embedded-CQnl8oWA.js";
import "./plugins-DDHMQ3QK.js";
import "./accounts-Ci3cLwUy.js";
import "./bindings-DKi5BVUO.js";
import "./send-jFOST1iZ.js";
import "./send-BPUUbToy.js";
import "./deliver-DvVWBx7_.js";
import "./diagnostic-DUeedNNG.js";
import "./diagnostic-session-state-_tGY1a3B.js";
import "./accounts-B_Ux_WCM.js";
import "./send-7Nj0TwhR.js";
import "./image-ops-ytIXc4y7.js";
import "./pi-model-discovery-YehKBAM7.js";
import "./message-channel-BFDfSy61.js";
import "./pi-embedded-helpers-qnfs15AW.js";
import "./chrome-DdCy-Bb4.js";
import "./ssrf-GR1wTjsC.js";
import "./frontmatter-DMZypGUO.js";
import "./skills-CBafcFRc.js";
import "./path-alias-guards-DqPz9Plh.js";
import "./redact-qRndXuX6.js";
import "./errors-g-M6e-2M.js";
import "./fs-safe-DO-sV9tV.js";
import "./store-Q3603hr3.js";
import "./sessions-CI-FFiWI.js";
import "./accounts-hziA-8WI.js";
import "./paths-_TesRDr4.js";
import "./tool-images-BpGQaRyx.js";
import "./thinking-CJoHneR6.js";
import "./image-BaNRoyvf.js";
import "./reply-prefix-Co2AbRLk.js";
import "./manager-DSPfG4vT.js";
import "./gemini-auth-DK0J4Ghx.js";
import "./fetch-guard-ClDBVUl3.js";
import "./query-expansion-BxU3X1gS.js";
import "./retry-DOgdFVsJ.js";
import "./target-errors-vh-Ho1G9.js";
import "./chunk-CnGtY6uJ.js";
import "./markdown-tables-oQ4TevLw.js";
import "./local-roots-BHi_eOQs.js";
import "./ir-Bl7SomkG.js";
import "./render-loap2gRq.js";
import "./commands-registry-CWosCgjs.js";
import "./skill-commands-ByXCSnZg.js";
import "./runner-B7RghiHU.js";
import "./fetch-B1nZSYJF.js";
import "./channel-activity-CiJYZtyi.js";
import "./tables-BeB5WGBT.js";
import "./send-B6lYD2tN.js";
import "./outbound-attachment-BFP3ylsO.js";
import "./send-u79Dp_NE.js";
import "./resolve-route-uVkmtG1R.js";
import "./proxy-Bee2aKQk.js";
import "./replies-CJ9jMLgI.js";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

//#region src/hooks/llm-slug-generator.ts
/**
* LLM-based slug generator for session memory filenames
*/
const log = createSubsystemLogger("llm-slug-generator");
/**
* Generate a short 1-2 word filename slug from session content using LLM
*/
async function generateSlugViaLLM(params) {
	let tempSessionFile = null;
	try {
		const agentId = resolveDefaultAgentId(params.cfg);
		const workspaceDir = resolveAgentWorkspaceDir(params.cfg, agentId);
		const agentDir = resolveAgentDir(params.cfg, agentId);
		const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-slug-"));
		tempSessionFile = path.join(tempDir, "session.jsonl");
		const prompt = `Based on this conversation, generate a short 1-2 word filename slug (lowercase, hyphen-separated, no file extension).

Conversation summary:
${params.sessionContent.slice(0, 2e3)}

Reply with ONLY the slug, nothing else. Examples: "vendor-pitch", "api-design", "bug-fix"`;
		const modelRef = resolveAgentEffectiveModelPrimary(params.cfg, agentId);
		const parsed = modelRef ? parseModelRef(modelRef, DEFAULT_PROVIDER) : null;
		const provider = parsed?.provider ?? DEFAULT_PROVIDER;
		const model = parsed?.model ?? DEFAULT_MODEL;
		const result = await runEmbeddedPiAgent({
			sessionId: `slug-generator-${Date.now()}`,
			sessionKey: "temp:slug-generator",
			agentId,
			sessionFile: tempSessionFile,
			workspaceDir,
			agentDir,
			config: params.cfg,
			prompt,
			provider,
			model,
			timeoutMs: 15e3,
			runId: `slug-gen-${Date.now()}`
		});
		if (result.payloads && result.payloads.length > 0) {
			const text = result.payloads[0]?.text;
			if (text) return text.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || null;
		}
		return null;
	} catch (err) {
		const message = err instanceof Error ? err.stack ?? err.message : String(err);
		log.error(`Failed to generate slug: ${message}`);
		return null;
	} finally {
		if (tempSessionFile) try {
			await fs.rm(path.dirname(tempSessionFile), {
				recursive: true,
				force: true
			});
		} catch {}
	}
}

//#endregion
export { generateSlugViaLLM };