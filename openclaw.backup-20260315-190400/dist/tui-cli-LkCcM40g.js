import "./paths-B4BZAPZh.js";
import { B as theme } from "./utils-BKDT474X.js";
import "./thinking-EAliFiVK.js";
import "./agent-scope-CUpt2978.js";
import { f as defaultRuntime } from "./subsystem-DypCPrmP.js";
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
import "./commands-BnuDjfQ7.js";
import "./commands-registry-CTrWxHEa.js";
import "./client-EwxHy0Jk.js";
import "./call-Dx-c0m2G.js";
import "./pairing-token-BdLe8Jtz.js";
import { t as formatDocsLink } from "./links-_OmPhBsv.js";
import { t as parseTimeoutMs } from "./parse-timeout-4VifOcrr.js";
import { t as runTui } from "./tui-5Pue4OSz.js";

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