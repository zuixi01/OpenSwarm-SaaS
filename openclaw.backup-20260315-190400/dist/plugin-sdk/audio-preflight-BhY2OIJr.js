import "./accounts-t6O8wALr.js";
import "./paths-DVWx7USN.js";
import "./github-copilot-token-Cg0YPPSu.js";
import "./config-C3stb-cB.js";
import { $ as logVerbose, nt as shouldLogVerbose } from "./subsystem-Dov-90yx.js";
import "./command-format-BKON8t_-.js";
import "./agent-scope-Dmx5WfXj.js";
import "./dock-DFwXt9Fs.js";
import "./message-channel-AE5edk7h.js";
import "./sessions-9DG8XurL.js";
import "./plugins-Bb8Ollli.js";
import "./accounts-Com9dDFl.js";
import "./accounts-BtwyJDi6.js";
import "./bindings-FWLHqfM1.js";
import "./paths-B1GjDdB5.js";
import "./redact-Ch-c7_OU.js";
import "./errors-BWHFreGi.js";
import "./path-alias-guards-CIZliKd3.js";
import "./fs-safe-Dqz5JIN7.js";
import "./image-ops-BhETJ37Q.js";
import "./ssrf-D07_rJxG.js";
import "./fetch-guard-5FavoQuI.js";
import "./local-roots-jU1opwri.js";
import "./tool-images-Bu8eGvHq.js";
import { a as resolveMediaAttachmentLocalRoots, n as createMediaAttachmentCache, o as runCapability, r as normalizeMediaAttachments, t as buildProviderRegistry, u as isAudioAttachment } from "./runner-D3gD8uH_.js";
import "./skills-D4lTvbWG.js";
import "./chrome-C5Mwcjlx.js";
import "./store-C9YQM4Ru.js";
import "./pi-embedded-helpers-CNodvx-y.js";
import "./thinking-BpFZfHN9.js";
import "./image-W3BwhDgQ.js";
import "./pi-model-discovery-Cm9PQVkk.js";
import "./api-key-rotation-C_HTJ5iy.js";

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