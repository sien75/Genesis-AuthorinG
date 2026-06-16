# Old Testament

覆盖率驱动的代码理解工具。

它让 AI 沿着真实代码路径阅读项目、记录源码覆盖率、生成带 Mermaid 流程图的 HTML 理解报告，并用校验工具检查 LLM 产物里的流程图和 sourceMap 是否可靠。

## 组成

- **`skill/`**：核心使用说明和工作流，包含如何分析项目、分发 subagent、记录覆盖率、校验报告、渲染页面
- **`cli/coverage/`**：`ot-coverage`，用于记录和统计代码阅读覆盖率
- **`cli/verify/`**：`ot-verify`，用于校验生成的 HTML 报告质量

## 使用

安装 skill 即可使用，例如：

```bash
npx skills add sien75/Genesis-AuthorinG
```

安装后，在需要分析的项目里说：

```text
使用 ot-analyzer 分析这个项目
```

> 注意：分析项目会消耗比较多的 token。

分析完成后 Agent 会提示你打开 url, 打开后需关联到本地项目目录, 关联完成后就可以对应代码阅读文档了.
