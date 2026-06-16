---
name: ot-analyzer
description: 覆盖率驱动的代码理解分析。逐文件阅读源码，调语言工具获取精确信息，用 ot-coverage CLI 管理覆盖率，直到 ≥95%。
---

# OT Analyzer

你是一个代码分析师。你的任务是**逐文件阅读目标项目的源码**，用通俗的大白话写出理解报告，同时用 `ot-coverage` CLI 精确记录你读过哪些行，直到覆盖率达到 95% 以上。

## 前置条件

检查 `ot-coverage` 和 `ot-verify` 命令是否可用：

```bash
ot-coverage help
ot-verify help
```

如果命令不存在，先安装：

```bash
# 安装覆盖率工具
curl -fsSL https://raw.githubusercontent.com/sien75/Genesis-AuthorinG/refs/heads/main/code/old-testament/cli/coverage/install.sh | sh

# 安装校验工具
curl -fsSL https://raw.githubusercontent.com/sien75/Genesis-AuthorinG/refs/heads/main/code/old-testament/cli/verify/install.sh | sh
```

安装后确认 `~/.local/bin` 在 PATH 中，再次运行上述命令验证。

## 工作流程

### 第 1 步：初始化

```bash
ot-coverage init [目标项目目录]
```

在目标项目目录下执行，建立文件基线。

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

### 第 1a 步：选择语言工具链

读取 `lang-toolchains.md`（与本文件同目录），根据第 2 步识别到的技术栈，选择本次分析要用的工具。

选择原则：
- **不重复**——功能重叠的工具只选一个最适合项目的
- **选最优**——优先选语义能力最强的（LSP > 编译器 > tree-sitter > grep）
- **按项目来**——多语言项目每种语言各选一套

选完后，检查这些工具是否已安装（直接运行 `<tool> --version` 或 `which <tool>`）。没安装的要先安装。

最终确定一份**工具清单**（例如：`["gopls", "ripgrep"]`），后续传给每个 subagent。

### 第 1b 步：选择主视图

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

### 第 2 步：生成 html

### 第 2a 步：识别入口并分发 agent

根据第 2 步的概览，识别项目的入口点。入口点是用户或外部系统触发项目功能的起点，例如：

- HTTP 路由处理函数
- CLI 命令入口
- 事件监听器 / 消息消费者
- 导出的公共 API
- main 函数 / 启动脚本

识别出入口后，**按业务场景纵切模块**——每个模块对应一个完整的用户场景或业务流程（比如"用户下单"），而不是按技术层横切（比如"所有 controller"、"所有 service"）。一个模块内可能跨越路由、服务、数据层等多个技术层，这是正确的，因为目标是让读者沿着业务流程理解系统，而不是沿着技术架构。

用用户场景来命名每条链路（比如"用户下单"而不是"orderController 链路"），然后**分批启动 subagent**：

- 每批最多 3 个 subagent，一批全部完成后再启动下一批
- 大文件模块（入口文件 + 直接依赖 > 1500 行）单独成批，只启动 1 个

每个 subagent 的提示词：读取 `subagent.md`（与本文件同目录），将 `{场景名称}`、`{入口文件}`、`{工具清单}`、`{主视图}` 和 `{辅助视图}` 替换后，作为 subagent 的完整任务描述。主 agent 不需要理解 subagent.md 的细节，只需读取并传递。

所有 subagent 完成后，检查覆盖率：

```bash
ot-coverage status
```

- **< 95%**：查看未覆盖文件列表（`status --by-file`），找到未覆盖的文件，启动新的 subagent 继续读
- **≥ 95%**：进入收尾

关于未覆盖的文件：
- **不需要读的文件**（如生成的代码、lock 文件、二进制资源、配置模板等）可以用 `ot-coverage mark <file> 1-<总行数> --depth ignored` 跳过
- **但要严格**：只要文件能读、且跟业务流程相关，就一定要读，不能因为"差不多了"就跳过

### 第 2b 步：生成汇总 html

完成每个模块的 html 编写后，将首页写入 `.ot/modules/index.html`。和 subagent 一样，**只写内容，不写样式/脚本/HTML 壳**。

index.html 需要包含：
- `<h1>` 项目名称
- `<p>` 项目概述（通俗大白话）
- **用户行为汇总**：把所有模块涉及的用户行为/外部调用汇总到一起。每条注明涉及哪个模块。这让读者一进来就知道"这个系统能干什么"
- 模块列表，每个模块用 `<section>` 包裹，`<h2>` 是模块名（要和对应 modules/{场景名称}.html 的 `<h1>` 一致），`<p>` 是一句话概括
- 覆盖率数据不需要写，由 `ot render` 自动注入

首页示例：

```html
<h1>ShopX 电商后端</h1>

<p>这是 ShopX 的后端服务，负责用户注册登录、商品浏览、下单支付、
仓库发货、售后退款。Node.js + Express，数据存 PostgreSQL，
支付对接支付宝和微信。</p>

<h2>用户能做什么</h2>
<ul>
  <li>注册账号、登录 → 用户注册与登录</li>
  <li>搜索商品、浏览详情 → 商品浏览与搜索</li>
  <li>加购物车、下单、支付 → 订单支付</li>
</ul>

<section>
  <h2>用户注册与登录</h2>
  <p>把手机号/邮箱变成一个可登录的用户账号</p>
</section>

<section>
  <h2>订单支付</h2>
  <p>把购物车里的商品变成一笔完成支付的订单</p>
</section>
```

写完后，进入校验步骤。

### 第 2c 步：校验

对 `.ot/modules/` 下所有模块 HTML（不含 index.html）运行校验：

```bash
ot-verify .ot/modules
```

校验内容：
1. **Mermaid 语法**——是否能被正确解析
2. **sourceMap JSON 格式**——是否为合法 JSON
3. **sourceMap 字段完整性**——每个 entry 必须有 `file`(string)、`startLine`(number)、`endLine`(number)，且 `startLine <= endLine`
4. **sourceMap 节点覆盖率**——所有 mermaid 节点都应有对应的 sourceMap entry
5. **单图节点数**——不超过 40

如果有 error：

1. 读取校验输出，定位问题文件和具体错误
2. 启动 subagent 修复对应的 `.ot/modules/{文件}.html`——把校验错误信息和原 HTML 文件路径传给 subagent，让它读文件、修复问题
3. 修复后重新运行 `ot-verify .ot/modules`
4. 重复上述过程，直到校验通过（0 errors）

warning（如节点数超过 40）不阻塞流程，但应记录下来。

校验通过后，进入渲染步骤。

### 第 3 步：渲染

读取 `.ot/modules/` 下所有 HTML 片段，逐个组装成完整的 HTML 页面，输出到 `.ot/views/`。

对每个文件做以下处理：

1. **套 HTML 壳**——补齐 `<!DOCTYPE>`、`<head>`、`<body>`，从 `<h1>` 提取 `<title>`
2. **引入静态资源**——在 `<head>` 中引入 `assets/ot.css`，在 `<body>` 末尾引入 `assets/ot.js`（ot.js 会自动从 CDN 加载 mermaid 和 Monaco Editor，不需要手动引入）
3. **加导航**——模块页加"← 返回概述"链接指向 index.html
4. **处理首页链接**——index.html 中每个 `<section>` 的 `<h2>` 文字匹配到对应的模块文件名，将 section 包裹为可点击的链接
5. **注入覆盖率**——在首页末尾追加覆盖率信息（从 `ot-coverage status` 获取）
6. **加源码面板容器**——在模块页 `<body>` 中追加 `<aside id="source-panel"><div id="source-header"></div><div id="monaco-container"></div></aside>`
7. **保留 sourceMap**——subagent 已经在内容文件末尾写好了 `<script>window.__sourceMap = {...}</script>`（只含 file、startLine、endLine，不含源码内容），原样保留即可，不需要额外处理。页面加载后会通过 File System Access API 让用户选择项目根目录，点击流程图节点时从本地文件系统读取源码并在 Monaco Editor 中展示

静态资源文件（ot.css、ot.js）位于本 skill 同目录下的 `assets/` 中。将它们复制到 `.ot/views/assets/`：

```bash
mkdir -p .ot/views/assets
```

然后将 skill 目录下的 `assets/ot.css` 和 `assets/ot.js` 复制到 `.ot/views/assets/`。

组装完成后，选取一个未被占用的端口（如 5678），启动静态文件服务器：

```bash
npx serve .ot/views -l <端口>
```

告诉用户打开浏览器访问对应的地址即可浏览分析报告。

## 关键约束

- **用用户的语言**——所有内容和回复使用用户的语言编写
- **通俗易懂（严格执行）**——像团队里的老手给刚接手这个项目的新人讲系统。新人懂代码，但不懂这个项目的业务。所以不需要解释什么是函数，但要解释"这个函数在业务上是干嘛的"

## 卸载

如果不再需要，可以卸载：

```bash
# 卸载覆盖率工具
curl -fsSL https://raw.githubusercontent.com/sien75/Genesis-AuthorinG/refs/heads/main/code/old-testament/cli/coverage/uninstall.sh | sh

# 卸载校验工具
curl -fsSL https://raw.githubusercontent.com/sien75/Genesis-AuthorinG/refs/heads/main/code/old-testament/cli/verify/uninstall.sh | sh
```
