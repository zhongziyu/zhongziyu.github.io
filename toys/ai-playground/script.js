(function () {
  const prompt = document.querySelector("#prompt");
  const run = document.querySelector("#run");
  const output = document.querySelector("#output");

  if (!prompt || !run || !output) {
    return;
  }

  run.addEventListener("click", function () {
    const text = prompt.value.trim();
    if (!text) {
      output.textContent = "先写一点 prompt。";
      return;
    }

    const words = text
      .replace(/[，。！？；：、]/g, " ")
      .split(/\s+/)
      .filter(Boolean);

    output.textContent = [
      "本地实验输出：",
      "",
      "标题候选：Interactive Notes & Tiny Tools",
      "关键词：" + words.slice(0, 8).join(" / "),
      "",
      "后续这里可以替换成真实 API 调用。"
    ].join("\n");
  });
})();
