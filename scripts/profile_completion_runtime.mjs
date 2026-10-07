import { spawn, execFileSync } from "node:child_process";
import { createInterface } from "node:readline";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const python = resolve(root, ".venv-translation/Scripts/python.exe");
const modelPath = resolve(root, "models/translation/nllb-int8");
const rows = [];
for (const [profile, file] of [
  ["before", "output/project-completion/rollback/backend/translation/worker.py"],
  ["after", "backend/translation/worker.py"]
]) {
  const wrapper = "import os,sys,runpy; from pathlib import Path; script=sys.argv[1]; sys.argv=sys.argv[1:]; sys.path.insert(0,str(Path(script).parent)); print('PROFILE_PID:'+str(os.getpid()),file=sys.stderr,flush=True); runpy.run_path(script,run_name='__main__')";
  const child = spawn(python, ["-c", wrapper, resolve(root, file), "--stream"], { cwd: root, stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
  const lines = createInterface({ input: child.stdout });
  let pending;
  const ready = value => { pending?.(JSON.parse(value)); pending = null; };
  lines.on("line", ready);
  let interpreterPid;
  const errors = createInterface({ input: child.stderr });
  errors.on("line", line => { if (line.startsWith("PROFILE_PID:")) interpreterPid = Number(line.slice(12)); });
  const request = payload => new Promise((resolveResponse, reject) => {
    const timer = setTimeout(() => { child.kill(); reject(new Error(`${profile} timed out`)); }, 180000);
    pending = value => { clearTimeout(timer); value.error ? reject(new Error(value.error)) : resolveResponse(value); };
    child.stdin.write(`${JSON.stringify({ action: "translate", source: "en", target: "gu", modelPath, ...payload })}\n`);
  });
  try {
    let start = performance.now();
    await request({ texts: [] });
    const warmupMs = Math.round(performance.now() - start);
    // Windows virtualenv launchers spawn the interpreter; use its reported PID, not the launcher.
    if (!Number.isInteger(interpreterPid)) throw new Error("Interpreter PID unavailable.");
    const memoryCommand = `(Get-Process -Id ${interpreterPid}).WorkingSet64`;
    const workingSetBytes = Number(execFileSync("powershell.exe", ["-NoProfile", "-Command", memoryCommand], { encoding: "utf8", windowsHide: true }).trim());
    start = performance.now();
    const display = await request({ texts: ["Applicable law", "Analyze query", "Written language", "Service online"] });
    const staticDisplayMs = Math.round(performance.now() - start);
    start = performance.now();
    const input = await request({ source: "gu", target: "en", texts: ["આરોપીએ બીજી વ્યક્તિને ગંભીર ઈજા પહોંચાડી."] });
    const inputMs = Math.round(performance.now() - start);
    const row = { profile, warmupMs, workingSetBytes, staticDisplayMs, display: display.texts, inputMs, input: input.texts };
    rows.push(row);
    console.log(JSON.stringify(row));
  } finally {
    child.stdin.end();
    await new Promise(resolveExit => child.once("exit", resolveExit));
    lines.close();
    errors.close();
  }
}
await writeFile(resolve(root, "output/project-completion/runtime-profile.json"), JSON.stringify({ type: "LOCAL_SINGLE_RUN_PROFILE", limitations: "One sequential run per profile; not a universal speed guarantee. Working set sampled after empty warmup.", rows }, null, 2));
