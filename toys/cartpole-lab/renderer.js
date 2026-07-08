function setupCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, width: rect.width, height: rect.height };
}

export function drawCartPole(canvas, state) {
  const { ctx, width, height } = setupCanvas(canvas);
  ctx.clearRect(0, 0, width, height);

  const railY = height * 0.64;
  const centerX = width * 0.5;
  const evalState = state.evalState;
  const cartOffset = evalState ? (evalState.x / 2.4) * width * 0.34 : Math.sin(state.phase) * width * 0.16;
  const cartX = centerX + cartOffset;
  const cartW = Math.max(74, width * 0.11);
  const cartH = 34;
  const poleLength = Math.min(width, height) * 0.31;
  const angle = evalState ? evalState.theta : Math.sin(state.phase * 0.73) * 0.32;
  const pivotX = cartX;
  const pivotY = railY - cartH * 0.65;
  const tipX = pivotX + Math.sin(angle) * poleLength;
  const tipY = pivotY - Math.cos(angle) * poleLength;

  ctx.fillStyle = "rgba(15, 111, 92, 0.055)";
  for (let i = 0; i < 9; i += 1) {
    const x = (i / 8) * width;
    ctx.fillRect(x, 0, 1, height);
  }

  ctx.strokeStyle = "#d8d0c5";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(width * 0.08, railY);
  ctx.lineTo(width * 0.92, railY);
  ctx.stroke();

  ctx.fillStyle = "#fdfcf9";
  ctx.strokeStyle = "#171717";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(cartX - cartW / 2, railY - cartH, cartW, cartH, 6);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = "#0f6f5c";
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(pivotX, pivotY);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();

  ctx.fillStyle = "#245dff";
  ctx.beginPath();
  ctx.arc(pivotX, pivotY, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#6c665d";
  ctx.font = "12px SFMono-Regular, Consolas, monospace";
  const policyIter = state.previewMeta?.metrics?.iteration;
  const status = state.previewStatus ?? "stopped";
  const autoplay = state.autoplay ? "auto" : "manual";
  const actionMode = state.actionMode ?? "sample";
  const label = policyIter == null
    ? `preview ${state.previewMode ?? "latest"} · ${actionMode} · ${status} · ${autoplay}`
    : `preview ${state.previewMode ?? "latest"} · ${actionMode} · ${status} · ${autoplay} · policy iter ${policyIter}`;
  ctx.fillText(label, 20, 28);
  if (evalState) {
    ctx.fillText(`episode len ${evalState.episode_len}`, 20, 48);
    ctx.fillText(`episode return ${Number(evalState.episode_return ?? 0).toFixed(1)}`, 20, 68);
    ctx.fillText(`action ${evalState.action === 1 ? "right" : "left"}`, 20, 88);
    ctx.fillText(`p(left) ${Number(evalState.p_left ?? 0).toFixed(2)} · p(right) ${Number(evalState.p_right ?? 0).toFixed(2)}`, 20, 108);
    ctx.fillText(`value ${Number(evalState.value ?? 0).toFixed(2)}`, 20, 128);
  } else {
    ctx.fillText("no rollout loaded", 20, 48);
  }
}

export function drawHistory(canvas, history, options = {}) {
  const { ctx, width, height } = setupCanvas(canvas);
  const view = options.view ?? "rolling";
  const source = view === "full" ? history : history.slice(-180);
  ctx.clearRect(0, 0, width, height);

  ctx.fillStyle = "rgba(255, 255, 255, 0.52)";
  ctx.fillRect(0, 0, width, height);

  const margin = { top: 26, right: 18, bottom: 36, left: 56 };
  const plotW = Math.max(1, width - margin.left - margin.right);
  const plotH = Math.max(1, height - margin.top - margin.bottom);
  const x0 = margin.left;
  const y0 = margin.top + plotH;

  ctx.strokeStyle = "#ded8cf";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x0, margin.top);
  ctx.lineTo(x0, y0);
  ctx.lineTo(width - margin.right, y0);
  ctx.stroke();

  const rewardValues = source.map((m) => Number(m.mean_reward ?? 0));
  const lengthValues = source.map((m) => Number(m.mean_episode_len ?? 0));
  const max = Math.max(1, ...rewardValues, ...lengthValues);
  const yMax = Math.ceil(max / 10) * 10 || 1;

  ctx.fillStyle = "#8a8378";
  ctx.font = "11px SFMono-Regular, Consolas, monospace";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let i = 0; i <= 4; i += 1) {
    const value = (yMax / 4) * i;
    const y = y0 - (value / yMax) * plotH;
    ctx.strokeStyle = i === 0 ? "#d2cabf" : "#e8e1d8";
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(width - margin.right, y);
    ctx.stroke();
    ctx.fillText(String(Math.round(value)), x0 - 8, y);
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const firstIter = source[0]?.iteration ?? 0;
  const lastIter = source[source.length - 1]?.iteration ?? 0;
  ctx.fillText(String(firstIter), x0, y0 + 9);
  ctx.fillText(String(lastIter), width - margin.right, y0 + 9);
  ctx.fillText("iteration", x0 + plotW / 2, y0 + 20);

  ctx.save();
  ctx.translate(15, margin.top + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.fillText("reward / length", 0, 0);
  ctx.restore();

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#0f6f5c";
  ctx.fillText("reward", x0, 17);
  ctx.fillStyle = "#245dff";
  ctx.fillText("episode length", x0 + 70, 17);
  ctx.fillStyle = "#8a8378";
  ctx.fillText(view === "full" ? "from 0" : "rolling", x0 + 196, 17);

  if (source.length < 2) return;

  function plot(values, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    values.forEach((value, index) => {
      const x = x0 + (index / Math.max(1, values.length - 1)) * plotW;
      const y = y0 - (value / yMax) * plotH;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  plot(rewardValues, "#0f6f5c");
  plot(lengthValues, "#245dff");
}
