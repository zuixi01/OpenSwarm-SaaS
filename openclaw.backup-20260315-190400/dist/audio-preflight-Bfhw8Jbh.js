import "./paths-B4BZAPZh.js";
import { F as shouldLogVerbose, M as logVerbose } from "./utils-BKDT474X.js";
import "./thinking-EAliFiVK.js";
import "./agent-scope-CUpt2978.js";
import "./subsystem-DypCPrmP.js";
import "./openclaw-root-PhSD0wUu.js";
import "./exec-X_fw5eJV.js";
import "./model-selection-J6oFwo9y.js";
import "./github-copilot-token-nncItI8D.js";
import "./boolean-Wzu0-e0P.js";
import "./env-B5XQ5e-9.js";
import "./host-env-security-lcjXF83D.js";
import "./env-vars-Duxu9t5m.js";
import "./manifest-registry-DQsiKxT_.js";
import "./dock-xZn_ilyf.js";
import "./message-channel-BFAJAoI_.js";
import { a as resolveMediaAttachmentLocalRoots, n as createMediaAttachmentCache, o as runCapability, r as normalizeMediaAttachments, s as isAudioAttachment, t as buildProviderRegistry } from "./runner-DMMMVobY.js";
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
import "./paths-CxPj6Z2y.js";
import "./chat-envelope-CZCr0x5F.js";
import "./tool-images-UJsxlzPQ.js";
import "./tool-display-CERZKWmU.js";
import "./fetch-guard-CVpSbg3c.js";
import "./api-key-rotation-ASd_3Q06.js";
import "./local-roots-D3Zp1XAW.js";
import "./model-catalog-CPznmlMd.js";

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