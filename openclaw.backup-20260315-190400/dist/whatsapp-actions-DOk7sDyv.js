import "./agent-scope-CiUx4u3k.js";
import "./paths-C9do7WCN.js";
import "./subsystem-CGE2Gr4r.js";
import "./workspace-Coo0-24P.js";
import "./model-selection-BNuytbkf.js";
import "./github-copilot-token-BkwQAVvU.js";
import "./env-DPWMSs50.js";
import "./boolean-Ce2-qkSB.js";
import { a as normalizeWhatsAppTarget, i as isWhatsAppGroupJid } from "./plugins-DDHMQ3QK.js";
import { n as resolveWhatsAppAccount } from "./accounts-Ci3cLwUy.js";
import "./bindings-DKi5BVUO.js";
import "./image-ops-ytIXc4y7.js";
import "./message-channel-BFDfSy61.js";
import "./ssrf-GR1wTjsC.js";
import "./path-alias-guards-DqPz9Plh.js";
import "./fs-safe-DO-sV9tV.js";
import "./tool-images-BpGQaRyx.js";
import "./fetch-guard-ClDBVUl3.js";
import { a as createActionGate, c as jsonResult, d as readReactionParams, i as ToolAuthorizationError, m as readStringParam, n as missingTargetError } from "./target-errors-vh-Ho1G9.js";
import "./chunk-CnGtY6uJ.js";
import "./markdown-tables-oQ4TevLw.js";
import "./local-roots-BHi_eOQs.js";
import "./ir-Bl7SomkG.js";
import "./render-loap2gRq.js";
import "./tables-BeB5WGBT.js";
import { r as sendReactionWhatsApp } from "./outbound-DByb9hW3.js";

//#region src/whatsapp/resolve-outbound-target.ts
function resolveWhatsAppOutboundTarget(params) {
	const trimmed = params.to?.trim() ?? "";
	const allowListRaw = (params.allowFrom ?? []).map((entry) => String(entry).trim()).filter(Boolean);
	const hasWildcard = allowListRaw.includes("*");
	const allowList = allowListRaw.filter((entry) => entry !== "*").map((entry) => normalizeWhatsAppTarget(entry)).filter((entry) => Boolean(entry));
	if (trimmed) {
		const normalizedTo = normalizeWhatsAppTarget(trimmed);
		if (!normalizedTo) return {
			ok: false,
			error: missingTargetError("WhatsApp", "<E.164|group JID>")
		};
		if (isWhatsAppGroupJid(normalizedTo)) return {
			ok: true,
			to: normalizedTo
		};
		if (hasWildcard || allowList.length === 0) return {
			ok: true,
			to: normalizedTo
		};
		if (allowList.includes(normalizedTo)) return {
			ok: true,
			to: normalizedTo
		};
		return {
			ok: false,
			error: missingTargetError("WhatsApp", "<E.164|group JID>")
		};
	}
	return {
		ok: false,
		error: missingTargetError("WhatsApp", "<E.164|group JID>")
	};
}

//#endregion
//#region src/agents/tools/whatsapp-target-auth.ts
function resolveAuthorizedWhatsAppOutboundTarget(params) {
	const account = resolveWhatsAppAccount({
		cfg: params.cfg,
		accountId: params.accountId
	});
	const resolution = resolveWhatsAppOutboundTarget({
		to: params.chatJid,
		allowFrom: account.allowFrom ?? [],
		mode: "implicit"
	});
	if (!resolution.ok) throw new ToolAuthorizationError(`WhatsApp ${params.actionLabel} blocked: chatJid "${params.chatJid}" is not in the configured allowFrom list for account "${account.accountId}".`);
	return {
		to: resolution.to,
		accountId: account.accountId
	};
}

//#endregion
//#region src/agents/tools/whatsapp-actions.ts
async function handleWhatsAppAction(params, cfg) {
	const action = readStringParam(params, "action", { required: true });
	const isActionEnabled = createActionGate(cfg.channels?.whatsapp?.actions);
	if (action === "react") {
		if (!isActionEnabled("reactions")) throw new Error("WhatsApp reactions are disabled.");
		const chatJid = readStringParam(params, "chatJid", { required: true });
		const messageId = readStringParam(params, "messageId", { required: true });
		const { emoji, remove, isEmpty } = readReactionParams(params, { removeErrorMessage: "Emoji is required to remove a WhatsApp reaction." });
		const participant = readStringParam(params, "participant");
		const accountId = readStringParam(params, "accountId");
		const fromMeRaw = params.fromMe;
		const fromMe = typeof fromMeRaw === "boolean" ? fromMeRaw : void 0;
		const resolved = resolveAuthorizedWhatsAppOutboundTarget({
			cfg,
			chatJid,
			accountId,
			actionLabel: "reaction"
		});
		const resolvedEmoji = remove ? "" : emoji;
		await sendReactionWhatsApp(resolved.to, messageId, resolvedEmoji, {
			verbose: false,
			fromMe,
			participant: participant ?? void 0,
			accountId: resolved.accountId
		});
		if (!remove && !isEmpty) return jsonResult({
			ok: true,
			added: emoji
		});
		return jsonResult({
			ok: true,
			removed: true
		});
	}
	throw new Error(`Unsupported WhatsApp action: ${action}`);
}

//#endregion
export { handleWhatsAppAction };