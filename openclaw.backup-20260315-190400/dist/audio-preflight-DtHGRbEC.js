import "./agent-scope-DZ5jocOf.js";
import "./paths-CH8dLxVx.js";
import { $ as shouldLogVerbose, X as logVerbose } from "./subsystem-64KmiDyq.js";
import "./model-selection-kfr1D9yt.js";
import "./github-copilot-token-2ggfYP8J.js";
import "./env-DVuU7NI1.js";
import "./dock-CqKdQRvZ.js";
import "./plugins-BCSlgjnl.js";
import "./accounts-DrsRCOEC.js";
import "./bindings-Cn9M6JTz.js";
import "./accounts-CYWHfrD2.js";
import "./image-ops-BAk4gObo.js";
import "./pi-model-discovery-Dvh4W9J3.js";
import "./message-channel-CNaCt7-6.js";
import "./pi-embedded-helpers-B67N8Z2w.js";
import "./chrome-irid7nqa.js";
import "./ssrf-tlVN4FBY.js";
import "./skills-DfkLZeGO.js";
import "./path-alias-guards-C_6L9YYA.js";
import "./redact-DwOdYA5i.js";
import "./errors-BLl0yZg4.js";
import "./fs-safe-PlmqyXnq.js";
import "./store-CqjZHgZN.js";
import "./sessions-GqMGg4XE.js";
import "./accounts-CSwtm9rr.js";
import "./paths-BwXONNJC.js";
import "./tool-images-BvM8fUjE.js";
import "./thinking-ZaPrKXBc.js";
import "./image-DEJCSCIM.js";
import "./gemini-auth-CQt8pv5V.js";
import "./fetch-guard-BhYFHZ2H.js";
import "./local-roots-D4lYwtOM.js";
import { a as resolveMediaAttachmentLocalRoots, n as createMediaAttachmentCache, o as runCapability, r as normalizeMediaAttachments, t as buildProviderRegistry, u as isAudioAttachment } from "./runner-CIFYDBce.js";

//#region src/media-understanding/audio-preflight.ts
/**
* Transcribes the first audio attachment BEFORE mention checking.
* This allows voice notes to be processed in group chats with requireMention: true.
* Returns the transcript or undefined if transcription fails or no audio is found.
*/
async function transcribeFirstAudio(params) {
	const { ctx, cfg } = params;
	const audioConfig = cfg.tools?.media?.audio;
	if (!audioConfig || audioConfig.enabled === false) return;
	const attachments = normalizeMediaAttachments(ctx);
	if (!attachments || attachments.length === 0) return;
	const firstAudio = attachments.find((att) => att && isAudioAttachment(att) && !att.alreadyTranscribed);
	if (!firstAudio) return;
	if (shouldLogVerbose()) logVerbose(`audio-preflight: transcribing attachment ${firstAudio.index} for mention check`);
	const providerRegistry = buildProviderRegistry(params.providers);
	const cache = createMediaAttachmentCache(attachments, { localPathRoots: resolveMediaAttachmentLocalRoots({
		cfg,
		ctx
	}) });
	try {
		const result = await runCapability({
			capability: "audio",
			cfg,
			ctx,
			attachments: cache,
			media: attachments,
			agentDir: params.agentDir,
			providerRegistry,
			config: audioConfig,
			activeModel: params.activeModel
		});
		if (!result || result.outputs.length === 0) return;
		const audioOutput = result.outputs.find((output) => output.kind === "audio.transcription");
		if (!audioOutput || !audioOutput.text) return;
		firstAudio.alreadyTranscribed = true;
		if (shouldLogVerbose()) logVerbose(`audio-preflight: transcribed ${audioOutput.text.length} chars from attachment ${firstAudio.index}`);
		return audioOutput.text;
	} catch (err) {
		if (shouldLogVerbose()) logVerbose(`audio-preflight: transcription failed: ${String(err)}`);
		return;
	} finally {
		await cache.cleanup();
	}
}

//#endregion
export { transcribeFirstAudio };