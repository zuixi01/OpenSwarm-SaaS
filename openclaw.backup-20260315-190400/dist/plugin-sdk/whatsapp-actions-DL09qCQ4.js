import { i as resolveWhatsAppAccount } from "./accounts-t6O8wALr.js";
import "./paths-DVWx7USN.js";
import "./github-copilot-token-Cg0YPPSu.js";
import "./config-C3stb-cB.js";
import "./subsystem-Dov-90yx.js";
import "./command-format-BKON8t_-.js";
import "./agent-scope-Dmx5WfXj.js";
import "./message-channel-AE5edk7h.js";
import "./plugins-Bb8Ollli.js";
import "./bindings-FWLHqfM1.js";
import "./path-alias-guards-CIZliKd3.js";
import "./fs-safe-Dqz5JIN7.js";
import "./image-ops-BhETJ37Q.js";
import "./ssrf-D07_rJxG.js";
import "./fetch-guard-5FavoQuI.js";
import "./local-roots-jU1opwri.js";
import "./ir-DB823LNI.js";
import "./chunk-CMG4jo-_.js";
import "./markdown-tables-D5GZM90J.js";
import "./render-Dk3zVolZ.js";
import "./tables-Co5_Lq8s.js";
import "./tool-images-Bu8eGvHq.js";
import { a as createActionGate, c as jsonResult, d as readReactionParams, i as ToolAuthorizationError, m as readStringParam } from "./target-errors-o8BL1M3f.js";
import { t as resolveWhatsAppOutboundTarget } from "./resolve-outbound-target-DQ4ahF6n.js";
import { r as sendReactionWhatsApp } from "./outbound-DMOvDdgL.js";

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