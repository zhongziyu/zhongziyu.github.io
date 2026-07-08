import init, { PpoTrainer } from "./wasm/cartpole_core.js";

let trainer = null;
let currentConfig = null;
let running = false;
let loopScheduled = false;
let bestMeanReward = Number.NEGATIVE_INFINITY;
let lastLatestCheckpointAt = 0;
const latestCheckpointIntervalMs = 750;

function postError(error) {
  const message = error instanceof Error ? error.message : String(error);
  self.postMessage({ type: "error", message });
}

function makeTrainer(seed = 0) {
  if (!currentConfig) throw new Error("Trainer config is not initialized.");
  return new PpoTrainer(JSON.stringify(currentConfig), BigInt(seed));
}

function makePolicyCheckpointBytes(kind, metrics = null) {
  if (!trainer) throw new Error("Trainer is not initialized.");
  const checkpointBytes = trainer.get_policy_checkpoint_bytes();
  return {
    kind,
    saved_at: new Date().toISOString(),
    metrics,
    checkpointBytes,
    bytes: checkpointBytes.byteLength
  };
}

function postPolicySnapshot() {
  if (!trainer) throw new Error("Trainer is not initialized.");
  self.postMessage({ type: "policy", policy: JSON.parse(trainer.get_policy_json()) });
}

function postLatestCheckpoint(metrics = null) {
  const checkpoint = makePolicyCheckpointBytes("latest", metrics);
  self.postMessage({ type: "latest-checkpoint", checkpoint }, [checkpoint.checkpointBytes.buffer]);
}

function scheduleLoop() {
  if (loopScheduled) return;
  loopScheduled = true;
  setTimeout(trainLoop, 0);
}

function trainLoop() {
  loopScheduled = false;
  if (!running || !trainer) return;

  try {
    const startedAt = performance.now();
    const metrics = JSON.parse(trainer.train_iteration());
    const elapsedSeconds = Math.max((performance.now() - startedAt) / 1000, 0.000001);
    metrics.steps_per_second = Math.round((metrics.total_steps - (trainLoop.previousSteps ?? 0)) / elapsedSeconds);
    trainLoop.previousSteps = metrics.total_steps;
    self.postMessage({ type: "metrics", metrics });

    const now = performance.now();
    if (now - lastLatestCheckpointAt >= latestCheckpointIntervalMs) {
      lastLatestCheckpointAt = now;
      postLatestCheckpoint(metrics);
    }

    if (metrics.mean_reward > bestMeanReward && metrics.iteration >= 2) {
      bestMeanReward = metrics.mean_reward;
      const checkpoint = makePolicyCheckpointBytes("best", metrics);
      self.postMessage({ type: "checkpoint", checkpoint }, [checkpoint.checkpointBytes.buffer]);
    }

    if (metrics.iteration % 10 === 0) {
      postPolicySnapshot();
    }
  } catch (error) {
    running = false;
    postError(error);
    return;
  }

  scheduleLoop();
}

self.addEventListener("message", async (event) => {
  const message = event.data;

  try {
    if (message.type === "init") {
      await init();
      currentConfig = message.config;
      trainer = makeTrainer(message.seed ?? 0);
      bestMeanReward = Number.NEGATIVE_INFINITY;
      trainLoop.previousSteps = 0;
      lastLatestCheckpointAt = 0;
      self.postMessage({ type: "ready" });
      postLatestCheckpoint(null);
      return;
    }

    if (message.type === "start") {
      running = true;
      scheduleLoop();
      return;
    }

    if (message.type === "pause") {
      running = false;
      return;
    }

    if (message.type === "reset") {
      running = false;
      currentConfig = message.config;
      trainer = makeTrainer(message.seed ?? 0);
      bestMeanReward = Number.NEGATIVE_INFINITY;
      trainLoop.previousSteps = 0;
      lastLatestCheckpointAt = 0;
      self.postMessage({ type: "ready" });
      postLatestCheckpoint(null);
      return;
    }

    if (message.type === "load-checkpoint") {
      if (!trainer) throw new Error("Trainer is not initialized.");
      if (message.checkpointBytes) trainer.load_policy_checkpoint_bytes(message.checkpointBytes);
      else trainer.load_policy_checkpoint_json(JSON.stringify(message.checkpoint));
      bestMeanReward = message.metrics?.mean_reward ?? bestMeanReward;
      self.postMessage({ type: "loaded-checkpoint", metrics: message.metrics ?? null });
      postLatestCheckpoint(message.metrics ?? null);
      postPolicySnapshot();
      return;
    }

    if (message.type === "get-policy") {
      postPolicySnapshot();
    }
  } catch (error) {
    postError(error);
  }
});
