(function () {
  const canvas = document.querySelector("#wave-canvas");
  const slider = document.querySelector("#frequency");
  const output = document.querySelector("#frequency-value");

  if (!canvas || !slider || !output) {
    return;
  }

  const ctx = canvas.getContext("2d");

  function draw() {
    const frequency = Number(slider.value);
    const width = canvas.width;
    const height = canvas.height;
    const mid = height / 2;

    output.value = String(frequency);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#fffefd";
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "#e3ded5";
    ctx.lineWidth = 1;
    for (let x = 0; x <= width; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y += 60) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    ctx.strokeStyle = "#245dff";
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let x = 0; x <= width; x += 2) {
      const phase = (x / width) * Math.PI * 2 * frequency;
      const y = mid + Math.sin(phase) * 86 * Math.cos((x / width) * Math.PI);
      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    ctx.fillStyle = "#171717";
    ctx.font = "16px SFMono-Regular, Consolas, monospace";
    ctx.fillText("sinusoid frequency = " + frequency, 24, 34);
  }

  slider.addEventListener("input", draw);
  draw();
})();
