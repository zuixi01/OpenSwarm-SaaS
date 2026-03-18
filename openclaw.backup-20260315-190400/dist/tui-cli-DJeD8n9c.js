import { Ot as theme, v as defaultRuntime } from "./entry.js";
import "./auth-profiles-6WJHPoy1.js";
import "./agent-scope-C2k6BQnt.js";
import "./openclaw-root-C9tYgTzw.js";
import "./exec-BhaMholX.js";
import "./github-copilot-token-DKRiM6oj.js";
import "./host-env-security-BM8ktVlo.js";
import "./env-vars-DPtuUD7z.js";
import "./manifest-registry-HLdbjiS7.js";
import "./dock-B6idJaIX.js";
import "./frontmatter-DzgKaILZ.js";
import "./skills-DOryi61N.js";
import "./path-alias-guards-BpvAiXds.js";
import "./message-channel-CJUwnCYd.js";
import "./sessions-CRMuaVTk.js";
import "./plugins-BOmV0yTv.js";
import "./accounts-jTTYYc3C.js";
import "./accounts-CnxuiQaw.js";
import "./accounts-DKgW2m_s.js";
import "./bindings-DcFNU_QL.js";
import "./logging-Cr3Gsq0-.js";
import "./paths-ANQqR741.js";
import "./chat-envelope-CrHAOMhr.js";
import "./client-C2kv9X_7.js";
import "./call-D_7wmgxh.js";
import "./pairing-token-DzfCmsrM.js";
import "./net-DBrsyv8q.js";
import "./ip-BDxIP8rd.js";
import "./tailnet-Ca1WnFBq.js";
import "./image-ops-WZr1HLCX.js";
import "./pi-embedded-helpers-CpQ-YZT5.js";
import "./sandbox-DY8nmmZL.js";
import "./tool-catalog-DABanDxl.js";
import "./chrome-CUDdqGYS.js";
import "./tailscale-Cz0j5H8x.js";
import "./auth-ML-4Xoce.js";
import "./server-context-cmI3JR7x.js";
import "./paths-CjmqZPVj.js";
import "./redact-Dcypez3H.js";
import "./errors-Cu3BYw29.js";
import "./fs-safe-BhLTWc_h.js";
import "./ssrf-Bte-xH9B.js";
import "./store-BXu3Rh07.js";
import "./ports-B9YOEPbT.js";
import "./trash-C8oZT55U.js";
import "./server-middleware-CksvUSHW.js";
import "./tool-images-DRFHeGdm.js";
import "./thinking-DW6CKWyf.js";
import "./commands-CQRE0cc7.js";
import "./commands-registry-B0c36EOd.js";
import "./tool-display-FacPPVzc.js";
import { t as parseTimeoutMs } from "./parse-timeout-D6jdFkXC.js";
import { t as formatDocsLink } from "./links-yQMT2QcX.js";
import { t as runTui } from "./tui-CzG0Ad52.js";

//#region src/cli/tui-cli.ts
function registerTuiCli(program) {
	program.command("tui").description("Open a terminal UI connected to the Gateway").option("--url <url>", "Gateway WebSocket URL (defaults to gateway.remote.url when configured)").option("--token <token>", "Gateway token (if required)").option("--password <password>", "Gateway password (if required)").option("--session <key>", "Session key (default: \"main\", or \"global\" when scope is global)").option("--deliver", "Deliver assistant replies", false).option("--thinking <level>", "Thinking level override").option("--message <text>", "Send an initial message after connecting").option("--timeout-ms <ms>", "Agent timeout in ms (defaults to agents.defaults.timeoutSeconds)").option("--history-limit <n>", "History entries to load", "200").addHelpText("after", () => `\n${theme.muted("Docs:")} ${formatDocsLink("/cli/tui", "docs.openclaw.ai/cli/tui")}\n`).action(async (opts) => {
		try {
			const timeoutMs = parseTimeoutMs(opts.timeoutMs);
			if (opts.timeoutMs !== void 0 && timeoutMs === void 0) defaultRuntime.error(`warning: invalid --timeout-ms "${String(opts.timeoutMs)}"; ignoring`);
			const historyLimit = Number.parseInt(String(opts.historyLimit ?? "200"), 10);
			await runTui({
				url: opts.url,
				token: opts.token,
				password: opts.password,
				session: opts.session,
				deliver: Boolean(opts.deliver),
				thinking: opts.thinking,
				message: opts.message,
				timeoutMs,
				historyLimit: Number.isNaN(historyLimit) ? void 0 : historyLimit
			});
		} catch (err) {
			defaultRuntime.error(String(err));
			defaultRuntime.exit(1);
		}
	});
}

//#endregion
export { registerTuiCli };