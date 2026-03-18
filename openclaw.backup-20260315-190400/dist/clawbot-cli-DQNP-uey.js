import "./paths-B4BZAPZh.js";
import { B as theme } from "./utils-BKDT474X.js";
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
import "./ip-DK-vcRii.js";
import { t as formatDocsLink } from "./links-_OmPhBsv.js";
import { n as registerQrCli } from "./qr-cli-0_xJavUe.js";

//#region src/cli/clawbot-cli.ts
function registerClawbotCli(program) {
	registerQrCli(program.command("clawbot").description("Legacy clawbot command aliases").addHelpText("after", () => `\n${theme.muted("Docs:")} ${formatDocsLink("/cli/clawbot", "docs.openclaw.ai/cli/clawbot")}\n`));
}

//#endregion
export { registerClawbotCli };