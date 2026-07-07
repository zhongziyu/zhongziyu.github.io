# zhongziyu.github.io

zhongziyu 的 GitHub Pages 个人网站，用来整理文章、交互解释和小型网页实验。

访问地址：

```text
https://zhongziyu.github.io
```

## Structure

- `index.html`: 极简入口页，分流到 Articles 与 Toys。
- `articles/`: 文章索引与长文页面，支持文章内 JavaScript、canvas、SVG、数据文件等。
- `toys/`: shader、AI 小工具、可视化实验等独立页面。
- `shared/`: 多页面共享样式。

本项目是纯静态站点，不需要构建工具。每篇文章或 toy 都可以放在自己的目录里，并用局部 `script.js` 管理交互。

## Writing Articles

复制 `articles/workspace-style-demo/` 可以创建一篇新文章。文章页适合放：

- 正文推导与长图文解释
- `canvas` / `svg` / WebGPU / WebGL 交互组件
- 每篇文章自己的 `script.js`
- 每篇文章自己的数据文件
- MathJax 或 KaTeX 公式渲染脚本

推荐让文章脚本保持局部化，例如使用 IIFE 或模块化代码，避免不同文章之间共享全局状态。
