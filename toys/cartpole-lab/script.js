import initWasm, { PolicyEvaluator } from "./wasm/cartpole_core.js";
import { drawCartPole, drawHistory } from "./renderer.js";
import {
  clearBestPolicyCheckpoint,
  loadBestPolicyCheckpoint,
  saveBestPolicyCheckpoint
} from "./storage.js";

const defaultConfig = {
  num_envs: 128,
  horizon: 128,
  ppo_epochs: 4,
  minibatch_size: 512,
  gamma: 0.99,
  gae_lambda: 0.95,
  clip_eps: 0.2,
  value_coef: 0.5,
  entropy_coef: 0.01,
  learning_rate: 0.0003,
  max_episode_steps: 500,
  hidden_size: 64
};

const previewConfig = {
  ...defaultConfig,
  num_envs: 1,
  horizon: 16,
  ppo_epochs: 1,
  minibatch_size: 16
};

const els = {
  status: document.querySelector("#status"),
  start: document.querySelector("#start-button"),
  pause: document.querySelector("#pause-button"),
  reset: document.querySelector("#reset-button"),
  loadPolicy: document.querySelector("#load-policy-button"),
  clearPolicy: document.querySelector("#clear-policy-button"),
  previewPlay: document.querySelector("#preview-play-button"),
  previewAutoplay: document.querySelector("#preview-autoplay-button"),
  previewSample: document.querySelector("#preview-sample-button"),
  previewGreedy: document.querySelector("#preview-greedy-button"),
  previewLatest: document.querySelector("#preview-latest-button"),
  previewBest: document.querySelector("#preview-best-button"),
  historyRolling: document.querySelector("#history-rolling-button"),
  historyFull: document.querySelector("#history-full-button"),
  checkpointStatus: document.querySelector("#checkpoint-status"),
  policy: document.querySelector("#policy-output"),
  iteration: document.querySelector("#metric-iteration"),
  steps: document.querySelector("#metric-steps"),
  reward: document.querySelector("#metric-reward"),
  length: document.querySelector("#metric-length"),
  entropy: document.querySelector("#metric-entropy"),
  sps: document.querySelector("#metric-sps"),
  cartpoleCanvas: document.querySelector("#cartpole-canvas"),
  historyCanvas: document.querySelector("#history-canvas")
};

const history = [];
const worker = new Worker("./trainer.worker.js", { type: "module" });
const preview = {
  mode: "latest",
  actionMode: "sample",
  status: "stopped",
  autoplay: true,
  activeTrainer: null,
  activePayload: null,
  buffered: { latest: null, best: null },
  evalState: null
};

let phase = 0;
let latestMetrics = null;
let latestCheckpoint = null;
let historyView = "rolling";
let wasmReady = false;
let lastPreviewStepAt = 0;

function setStatus(text, kind = "") {
  els.status.textContent = text;
  els.status.classList.toggle("is-ready", kind === "ready");
  els.status.classList.toggle("is-error", kind === "error");
}

function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function syncSegmentedButtons() {
  els.previewLatest.classList.toggle("is-active", preview.mode === "latest");
  els.previewBest.classList.toggle("is-active", preview.mode === "best");
  els.previewAutoplay.classList.toggle("is-on", preview.autoplay);
  els.previewSample.classList.toggle("is-active", preview.actionMode === "sample");
  els.previewGreedy.classList.toggle("is-active", preview.actionMode === "greedy");
  els.historyRolling.classList.toggle("is-active", historyView === "rolling");
  els.historyFull.classList.toggle("is-active", historyView === "full");
  els.previewPlay.textContent = preview.status === "playing" ? "Pause" : "Start";
}

function makePreviewTrainer(payload, seed) {
  const trainer = new PolicyEvaluator(JSON.stringify(previewConfig), BigInt(seed));
  if (payload.checkpointBytes) {
    trainer.load_policy_checkpoint_bytes(payload.checkpointBytes);
  } else {
    trainer.load_policy_checkpoint_json(JSON.stringify(payload.checkpoint));
  }
  return trainer;
}

function evalValuesToState(values) {
  return {
    x: values[0],
    x_dot: values[1],
    theta: values[2],
    theta_dot: values[3],
    action: values[4] | 0,
    reward: values[5],
    done: values[6] > 0.5,
    episode_len: values[7] | 0,
    episode_return: values[8],
    p_left: values[9] ?? 0,
    p_right: values[10] ?? 0,
    value: values[11] ?? 0
  };
}

function hasCheckpointPayload(payload) {
  return Boolean(payload?.checkpoint || payload?.checkpointBytes);
}

function bufferPreviewCheckpoint(mode, payload) {
  if (!hasCheckpointPayload(payload)) return;
  preview.buffered[mode] = payload;
  syncSegmentedButtons();
}

function startRolloutFromPayload(payload, options = {}) {
  if (!wasmReady || !hasCheckpointPayload(payload)) return false;
  const seed = options.seed ?? Date.now();
  preview.activeTrainer = makePreviewTrainer(payload, seed);
  preview.activePayload = payload;
  preview.evalState = null;
  preview.status = "playing";
  lastPreviewStepAt = 0;
  syncSegmentedButtons();
  return true;
}

function startLatestRollout() {
  const payload = preview.buffered[preview.mode] ?? preview.activePayload;
  if (!payload) {
    setStatus(`No ${preview.mode} policy`, "error");
    return false;
  }
  return startRolloutFromPayload(payload);
}

async function initPreviewRuntime() {
  await initWasm();
  wasmReady = true;
  const saved = await loadBestPolicyCheckpoint();
  if (hasCheckpointPayload(saved)) bufferPreviewCheckpoint("best", saved);
  updateCheckpointStatus(saved);
  if (preview.autoplay && preview.status === "stopped") startLatestRollout();
  syncSegmentedButtons();
}

function updateCheckpointStatus(record = preview.buffered.best) {
  latestCheckpoint = hasCheckpointPayload(record) ? record : null;
  els.loadPolicy.disabled = !latestCheckpoint;
  els.clearPolicy.disabled = !latestCheckpoint;
  els.previewBest.disabled = !latestCheckpoint && !preview.buffered.best;

  if (!latestCheckpoint) {
    els.checkpointStatus.textContent = "No saved policy";
    if (preview.mode === "best") setPreviewMode("latest");
    return;
  }

  const reward = Number(latestCheckpoint.metrics?.mean_reward ?? 0).toFixed(2);
  const iteration = latestCheckpoint.metrics?.iteration ?? 0;
  const size = formatBytes(latestCheckpoint.bytes);
  const storage = latestCheckpoint.storage ?? "IndexedDB";
  els.checkpointStatus.textContent = `Best reward ${reward} at iter ${iteration} · ${size} · ${storage}`;
}

function drawCurrentHistory() {
  drawHistory(els.historyCanvas, history, { view: historyView });
}

function updateMetrics(metrics) {
  latestMetrics = metrics;
  els.iteration.textContent = String(metrics.iteration ?? 0);
  els.steps.textContent = String(metrics.total_steps ?? 0);
  els.reward.textContent = Number(metrics.mean_reward ?? 0).toFixed(2);
  els.length.textContent = Number(metrics.mean_episode_len ?? 0).toFixed(2);
  els.entropy.textContent = Number(metrics.entropy ?? 0).toFixed(3);
  els.sps.textContent = Math.round(metrics.steps_per_second ?? 0).toString();

  history.push(metrics);
  drawCurrentHistory();
}

async function persistCheckpoint(checkpoint) {
  if (!checkpoint?.checkpointBytes) return;
  try {
    await saveBestPolicyCheckpoint(checkpoint, defaultConfig);
    const saved = await loadBestPolicyCheckpoint();
    bufferPreviewCheckpoint("best", saved);
    updateCheckpointStatus(saved);
  } catch (error) {
    setStatus("Storage error", "error");
    els.policy.textContent = error instanceof Error ? error.message : String(error);
  }
}

function setPreviewActionMode(mode) {
  preview.actionMode = mode === "greedy" ? "greedy" : "sample";
  if (preview.status === "playing") {
    preview.status = "stopped";
    startLatestRollout();
  }
  syncSegmentedButtons();
}

function setPreviewMode(mode) {
  const nextMode = mode === "best" ? "best" : "latest";
  if (nextMode === "best" && !preview.buffered.best && !preview.activePayload) {
    setStatus("No best policy", "error");
    return;
  }
  preview.mode = nextMode;
  preview.status = "stopped";
  preview.activePayload = null;
  preview.activeTrainer = null;
  preview.evalState = null;
  if (preview.autoplay) startLatestRollout();
  syncSegmentedButtons();
}

function finishRollout() {
  preview.status = "stopped";
  syncSegmentedButtons();
  if (preview.autoplay) {
    startLatestRollout();
  }
}

function stepPreview(now) {
  if (preview.status !== "playing" || !preview.activeTrainer) return;
  if (now - lastPreviewStepAt < 33) return;
  lastPreviewStepAt = now;
  const state = evalValuesToState(preview.activeTrainer.eval_step_values(preview.actionMode === "greedy"));
  preview.evalState = state;
  if (state.done) finishRollout();
}

worker.addEventListener("message", (event) => {
  const message = event.data;

  if (message.type === "ready") {
    setStatus("Ready", "ready");
    worker.postMessage({ type: "get-policy" });
    return;
  }

  if (message.type === "metrics") {
    updateMetrics(message.metrics);
    return;
  }

  if (message.type === "latest-checkpoint") {
    bufferPreviewCheckpoint("latest", message.checkpoint);
    if (preview.mode === "latest" && preview.autoplay && !preview.activePayload) startLatestRollout();
    return;
  }

  if (message.type === "checkpoint") {
    persistCheckpoint(message.checkpoint).then(() => {
      if (preview.mode === "best" && preview.autoplay && !preview.activePayload) startLatestRollout();
    });
    return;
  }

  if (message.type === "loaded-checkpoint") {
    setStatus("Policy loaded", "ready");
    return;
  }

  if (message.type === "policy") {
    els.policy.textContent = JSON.stringify(message.policy, null, 2);
    return;
  }

  if (message.type === "error") {
    setStatus("Error", "error");
    els.policy.textContent = message.message;
  }
});

els.start.addEventListener("click", () => worker.postMessage({ type: "start" }));
els.pause.addEventListener("click", () => worker.postMessage({ type: "pause" }));
els.reset.addEventListener("click", () => {
  history.length = 0;
  latestMetrics = null;
  preview.buffered.latest = null;
  preview.activePayload = null;
  preview.activeTrainer = null;
  preview.evalState = null;
  preview.status = "stopped";
  worker.postMessage({ type: "reset", config: defaultConfig, seed: Date.now() });
  drawCurrentHistory();
  syncSegmentedButtons();
});
els.loadPolicy.addEventListener("click", async () => {
  const saved = await loadBestPolicyCheckpoint();
  if (!hasCheckpointPayload(saved)) return;
  worker.postMessage({
    type: "load-checkpoint",
    checkpointBytes: saved.checkpointBytes,
    metrics: saved.metrics ?? null
  });
  bufferPreviewCheckpoint("latest", saved);
  if (preview.mode === "latest" && preview.status === "stopped") startLatestRollout();
});
els.clearPolicy.addEventListener("click", async () => {
  await clearBestPolicyCheckpoint();
  preview.buffered.best = null;
  if (preview.mode === "best") {
    preview.activePayload = null;
    preview.activeTrainer = null;
    preview.evalState = null;
    preview.status = "stopped";
  }
  updateCheckpointStatus(null);
  syncSegmentedButtons();
});
els.previewPlay.addEventListener("click", () => {
  if (preview.status === "playing") {
    preview.status = "paused";
    syncSegmentedButtons();
    return;
  }
  if (preview.status === "paused" && preview.activeTrainer) {
    preview.status = "playing";
    syncSegmentedButtons();
    return;
  }
  startLatestRollout();
});
els.previewAutoplay.addEventListener("click", () => {
  preview.autoplay = !preview.autoplay;
  if (preview.autoplay && preview.status === "stopped") startLatestRollout();
  syncSegmentedButtons();
});
els.previewSample.addEventListener("click", () => setPreviewActionMode("sample"));
els.previewGreedy.addEventListener("click", () => setPreviewActionMode("greedy"));
els.previewLatest.addEventListener("click", () => setPreviewMode("latest"));
els.previewBest.addEventListener("click", () => setPreviewMode("best"));
els.historyRolling.addEventListener("click", () => {
  historyView = "rolling";
  syncSegmentedButtons();
  drawCurrentHistory();
});
els.historyFull.addEventListener("click", () => {
  historyView = "full";
  syncSegmentedButtons();
  drawCurrentHistory();
});

syncSegmentedButtons();
updateCheckpointStatus(null);
drawCurrentHistory();
initPreviewRuntime().catch((error) => {
  setStatus("Preview error", "error");
  els.policy.textContent = error instanceof Error ? error.message : String(error);
});
worker.postMessage({ type: "init", config: defaultConfig, seed: 7 });
setStatus("Loading WASM");

function frame(now) {
  phase += 0.018;
  stepPreview(now);
  drawCartPole(els.cartpoleCanvas, {
    phase,
    evalState: preview.evalState,
    previewMode: preview.mode,
    actionMode: preview.actionMode,
    previewStatus: preview.status,
    autoplay: preview.autoplay,
    previewMeta: preview.activePayload
  });
  requestAnimationFrame(frame);
}

frame(0);
