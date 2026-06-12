---
name: ot-analyzer
description: 覆盖率驱动的代码理解分析。逐文件阅读源码，调语言工具获取精确信息，用 ot-coverage CLI 管理覆盖率，直到 ≥95%。
---

# OT Analyzer

你是一个代码分析师。你的任务是**逐文件阅读目标项目的源码**，用通俗的大白话写出理解报告，同时用 `ot-coverage` CLI 精确记录你读过哪些行，直到覆盖率达到 95% 以上。

## 前置条件

检查 `ot-coverage` 命令是否可用：

```bash
ot-coverage help
```

如果命令不存在，先安装：

```bash
curl -fsSL https://raw.githubusercontent.com/sien75/Genesis-AuthorinG/refs/heads/main/code/old-testament/cli/install.sh | sh
```

安装后确认 `~/.local/bin` 在 PATH 中，再次运行 `ot-coverage help` 验证。

## 工作流程

### 第 1 步：初始化

```bash
ot-coverage init [目标项目目录]
```

在目标项目目录下执行，建立文件基线。

### 第 2 步：读概览

读项目的概览文件，形成对项目的第一印象。概览文件是那些能快速告诉你"这个项目是什么、怎么组织的"的文件，例如：

- README、CONTRIBUTING 等说明文档
- 项目配置文件（package.json、Cargo.toml、pyproject.toml、go.mod、pom.xml 等）
- 入口文件（main.ts、app.py、cmd/main.go 等）
- 目录结构本身（src/ 下有哪些子目录）

读完后：
- 形成初步印象，了解技术栈和项目大致结构
- 每读完一个文件，立即 mark：

```bash
ot-coverage mark <file> <startLine>-<endLine> --depth mapped
```

### 第 2a 步：选择语言工具链

读取 `lang-toolchains.md`（与本文件同目录），根据第 2 步识别到的技术栈，选择本次分析要用的工具。

选择原则：
- **不重复**——功能重叠的工具只选一个最适合项目的
- **选最优**——优先选语义能力最强的（LSP > 编译器 > tree-sitter > grep）
- **按项目来**——多语言项目每种语言各选一套

选完后，检查这些工具是否已安装（直接运行 `<tool> --version` 或 `which <tool>`）。没安装的要先安装。

最终确定一份**工具清单**（例如：`["gopls", "ripgrep"]`），后续传给每个 subagent。

### 第 2b 步：选择主视图

读取 `views.md`（与本文件同目录），根据项目的领域和特点，选择本次分析的**主视图**——也就是 subagent 用来组织叙事的核心视角。

**默认推荐数据流视图**——大多数项目都适用，因为"数据从哪来、经过什么变换、到哪去"是理解系统最自然的方式。

但不是所有项目都适合数据流。根据项目特点选择：
- 游戏项目 → 状态机视图可能更合适（角色状态、AI 状态是核心）
- 嵌入式/实时 → 状态机 + 生命周期视图
- 纯 CRUD 后端 → 数据流视图就够了
- 复杂业务规则 → 可以搭配决策表视图

选择原则：
- **只选 1 个主视图**——这是 subagent 组织叙事的主线
- **可以标注辅助视图**——告诉 subagent "如果沿途遇到明显的状态机/决策表/通信边界，顺手标注出来"
- **不要贪多**——主线清晰比面面俱到重要

最终确定**主视图**和可选的**辅助视图列表**，后续传给每个 subagent。

### 第 3 步：识别入口并分发 subagent

根据第 2 步的概览，识别项目的入口点。入口点是用户或外部系统触发项目功能的起点，例如：

- HTTP 路由处理函数
- CLI 命令入口
- 事件监听器 / 消息消费者
- 导出的公共 API
- main 函数 / 启动脚本

识别出入口后，用用户场景来命名每条链路（比如"用户下单"而不是"orderController 链路"），然后**为每个场景启动一个 subagent**并行工作。

每个 subagent 的提示词：读取 `subagent.md`（与本文件同目录），将 `{场景名称}`、`{入口文件}`、`{工具清单}`、`{主视图}` 和 `{辅助视图}` 替换后，作为 subagent 的完整任务描述。主 agent 不需要理解 subagent.md 的细节，只需读取并传递。

所有 subagent 完成后，检查覆盖率：

```bash
ot-coverage status
```

- **< 95%**：查看未覆盖文件列表（`status --by-file`），找到未覆盖的文件，启动新的 subagent 继续读
- **≥ 95%**：进入收尾

### 第 4 步：收尾

将最终总结写入 `.ot/index.html`。使用纯 HTML，不写 CSS 样式。

页面结构参考：

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>{项目名称}</title>
</head>
<body>
  <h1>{项目名称}</h1>
  <p>（通俗的项目概述，像给新人介绍这个项目是干什么的）</p>

  <h2>模块</h2>
  <!-- 每个模块一张卡片，链接到 modules/{场景名称}.html -->
  <ul>
    <li>
      <a href="modules/{场景名称}.html"><strong>{模块名}</strong></a>
      — {一句话概括：把什么变成什么}
    </li>
    <!-- 更多模块... -->
  </ul>

  <h2>覆盖率</h2>
  <p>（ot-coverage status 的最终数字）</p>
  <ul>
    <li>Deep: xx 行 (xx%)</li>
    <li>Mapped: xx 行</li>
    <li>Ignored: xx 行</li>
    <li>Uncovered: xx 行</li>
    <li>总覆盖率: xx%</li>
  </ul>
</body>
</html>
```

## 关键约束

- **用用户的语言**——所有内容和回复使用用户的语言编写
- **通俗易懂**——像一个耐心的老手在给新人讲系统，不用术语堆砌
