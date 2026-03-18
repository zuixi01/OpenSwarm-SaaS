import "./agent-scope-CiUx4u3k.js";
import "./paths-C9do7WCN.js";
import { $ as shouldLogVerbose, X as logVerbose } from "./subsystem-CGE2Gr4r.js";
import "./workspace-Coo0-24P.js";
import "./model-selection-BNuytbkf.js";
import "./github-copilot-token-BkwQAVvU.js";
import "./env-DPWMSs50.js";
import "./boolean-Ce2-qkSB.js";
import "./dock-BS4F0Lll.js";
import "./plugins-DDHMQ3QK.js";
import "./accounts-Ci3cLwUy.js";
import "./bindings-DKi5BVUO.js";
import "./accounts-B_Ux_WCM.js";
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
import "./gemini-auth-DK0J4Ghx.js";
import "./fetch-guard-ClDBVUl3.js";
import "./local-roots-BHi_eOQs.js";
import { a as resolveMediaAttachmentLocalRoots, n as createMediaAttachmentCache, o as runCapability, r as normalizeMediaAttachments, t as buildProviderRegistry, u as isAudioAttachment } from "./runner-B7RghiHU.js";

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