import { createInterface } from "node:readline/promises";
import { LoginSession, EAuthTokenPlatformType, EAuthSessionGuardType } from "steam-session";

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => rl.question(q);

async function askHidden(q) {
  process.stdout.write(q);
  const original = rl._writeToOutput;
  rl._writeToOutput = () => {};
  const answer = await rl.question("");
  rl._writeToOutput = original;
  process.stdout.write("\n");
  return answer;
}

const accountName = await ask("Steam username: ");
const password = await askHidden("Steam password: ");

const session = new LoginSession(EAuthTokenPlatformType.SteamClient);

session.on("authenticated", () => {
  console.log("\nLogged in. Your refresh token (keep it secret, valid about 200 days):\n");
  console.log(session.refreshToken);
  console.log("\nPut it in STEAM_REFRESH_TOKEN (in .env locally, or as a Secret on Koyeb).\n");
  rl.close();
  process.exit(0);
});
session.on("timeout", () => { console.error("Login timed out."); process.exit(1); });
session.on("error", (e) => { console.error("Login failed:", e.message); process.exit(1); });

const result = await session.startWithCredentials({ accountName, password });

if (result.actionRequired) {
  const codeAction = result.validActions.find((a) =>
    [EAuthSessionGuardType.DeviceCode, EAuthSessionGuardType.EmailCode].includes(a.type)
  );
  const canConfirm = result.validActions.some((a) => a.type === EAuthSessionGuardType.DeviceConfirmation);

  if (canConfirm) console.log("You can approve the login in the Steam mobile app…");
  if (codeAction) {
    const where = codeAction.type === EAuthSessionGuardType.EmailCode ? `email (${codeAction.detail})` : "Steam Guard app";
    const code = await ask(`…or enter the code from your ${where}: `);
    if (code.trim()) await session.submitSteamGuardCode(code.trim());
  }
}