# Scan 任务

**场景：`{场景名称}`，入口：`{入口文件}`**

**可用工具：`{工具清单}`**（已根据项目技术栈选定并确认已安装，直接使用即可）

**主视图：`{主视图}`** | **辅助视图：`{辅助视图}`**

你需要从入口出发，以 **`{主视图}`** 的视角阅读和组织叙事。遇到分支就展开所有路径，遇到外部调用（数据库、第三方服务、消息队列等）就标记边界。

**重要：一定从用户/外部调用者的角度开始。** 先说清楚：用户（或外部系统）在这个场景里能做什么？做了什么操作会触发这条链路？然后再往下讲系统内部怎么处理。不要上来就讲内部实现——读的人需要先知道"我在哪、这是干什么的"。

## a. 沿主视图阅读源码

从入口文件开始，以 `{主视图}` 的视角逐步阅读。源码是 ground truth。

## b. 用工具获取精确信息

不要猜。遇到不确定的地方，**只使用 `{工具清单}` 中的工具**确认：

- **类型不确定** → 查类型推断
- **函数边界不清** → 解析语法结构
- **谁调了这个函数** → find references
- **定义在哪** → go to definition

## c. 画图

用 `{主视图}` 的方式为这条链路画图（nodes + edges）。

- **每个节点必须绑定源码位置**：`{file, startLine, endLine}`
- **所有分支都画**，异常路径不能省
- 节点标签用大白话，不用代码术语

如果沿途自然遇到了 `{辅助视图}` 中提到的模式（比如明显的状态机、决策表、通信边界等），顺手标注出来，但不需要刻意寻找。

## d. 写通俗描述

- **模块名称**：一句话概括，**把什么变成什么**
- **input**：业务含义，不是类型签名。比如"用户选好的商品清单 + 收货地址"
- **output**：业务含义。比如"一笔完成支付的订单"
- **notes**：补充说明，每条一两句话。比如"支付回调有签名验证，防止伪造通知"

## e. 标记覆盖

每读完一段代码，立即标记：

```bash
# 逐行读过、理解了逻辑
ot-coverage mark <file> <startLine>-<endLine> --depth deep

# 知道归属但没逐行展开
ot-coverage mark <file> <startLine>-<endLine> --depth mapped

# import、空行、纯类型定义等
ot-coverage mark <file> <startLine>-<endLine> --depth ignored
```

## f. 输出

**边分析边写入** `.ot/modules/{场景名称}.html`：

1. **开始分析前**：先写入 HTML 骨架（`<head>`、CDN 引用、样式、左右分屏容器、空的 `sourceMap` 对象）
2. **每完成一轮 a~e**：立即将这轮的内容追加到 HTML 中（描述段落、mermaid 片段、sourceMap 条目）
3. **全部完成后**：补上闭合标签（`</body></html>`）

这样即使中途被截断，文件中已有前面分析好的部分。

图使用 Mermaid.js 语法，通过 CDN 渲染。

### 源码查看器

页面采用左右分屏布局（黄金比例 `61.8% : 38.2%`）：

- **左侧**：主要内容区（描述、流程图等）
- **右侧**：源码查看器面板，初始隐藏，点击流程图节点后展开

#### Mermaid 节点点击交互

- 将 Mermaid 的 `securityLevel` 设为 `'loose'` 以启用 callback
- 每个流程图节点用 `click` 语法绑定回调，传入节点 ID
- 回调函数根据节点 ID 查找对应的源码位置信息（`file`, `startLine`, `endLine`），在右侧面板中展示

#### 源码面板实现

- 使用 **Monaco Editor**（VS Code 的编辑器内核），通过 CDN 加载
- 设为 **只读模式**（`readOnly: true`）
- 关闭所有辅助 UI：minimap、行号装饰以外的 gutter、右键菜单、悬浮提示、代码折叠等，只保留行号和代码内容
- 面板顶部显示当前文件的**相对路径和文件名**
- 通过 `revealLineInCenter()` 滚动到目标行，用 `deltaDecorations()` 高亮 `startLine` 到 `endLine` 的行范围（背景色标记）

#### 源码文件读取

- 使用 **File System Access API**（`window.showDirectoryPicker()`）读取本地项目文件
- 页面加载时提示用户选择项目根目录，获取目录句柄后缓存
- 点击节点时，根据节点绑定的相对文件路径，从目录句柄中定位并读取文件内容
- 如果用户未授权目录或文件不存在，在源码面板中显示提示信息

### 页面结构参考

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>{场景名称}</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
  <script>mermaid.initialize({startOnLoad: true, securityLevel: 'loose'});</script>
  <!-- Monaco Editor 通过 CDN 加载（如 jsdelivr 或 unpkg 上的 monaco-editor） -->
</head>
<body>

  <!-- 左侧内容区（61.8%） -->
  <div id="main-content">
    <p><a href="../index.html">← 返回概述</a></p>

    <h1>{场景名称}</h1>
    <p>（通俗的模块描述）</p>

    <h2>输入 / 输出</h2>
    <ul>
      <li>📥 输入：（业务含义）</li>
      <li>📤 输出：（业务含义）</li>
    </ul>

    <h2>流程</h2>
    <pre class="mermaid">
      graph TD
        A["步骤一"] --> B["步骤二"]
        B --> C{"条件判断"}
        C -->|"是"| D["步骤三"]
        C -->|"否"| E["错误处理"]
        click A showSource "查看源码"
        click B showSource "查看源码"
        click D showSource "查看源码"
        click E showSource "查看源码"
    </pre>

    <h2>补充说明</h2>
    <ul>
      <li>（notes 内容）</li>
    </ul>
  </div>

  <!-- 右侧源码面板（38.2%），初始隐藏 -->
  <div id="source-panel">
    <div id="source-header">{文件路径/文件名}</div>
    <div id="monaco-container"></div>
  </div>

  <script>
    // 节点 ID → 源码位置的映射
    const sourceMap = {
      A: { file: 'src/foo.ts', startLine: 12, endLine: 30 },
      B: { file: 'src/bar.ts', startLine: 45, endLine: 72 },
      // ...
    };

    // showSource 回调：读取文件 → Monaco 展示 → 高亮行
    function showSource(nodeId) { /* ... */ }
  </script>

</body>
</html>
```

## 描述风格

像团队里的老手给刚接手这个项目的新人讲系统。新人懂代码，但不懂这个项目的业务逻辑和背景。

所以：
- 不需要解释"什么是函数"、"什么是 API"——这些新人都懂
- 但要解释"这个函数在业务上是干嘛的"、"为什么要这么做"、"这步的输入从哪来的"
- 避免只是复述代码结构（"调用了 A，A 调用了 B"），要讲清楚业务意图

**不要这样写：**
> 此模块实现了文件上传的 validation pipeline，接收 `input: Buffer, projectId: string`，通过 middleware chain 进行校验

**要这样写：**
> 用户选了文件点上传后，系统先检查文件格式和大小——太大或格式不支持就直接告诉用户不行，没问题才存起来

**不要这样写：**
> 该函数通过调用 PaymentGateway.createCharge() 发起支付请求

**要这样写：**
> 这一步是去跟支付宝/微信发起扣款，然后等回调通知说钱到没到

## 关键约束

1. **覆盖率由程序算**——必须调 `ot-coverage` 标记，不 mark 就不算读过
2. **流程图要完整**——所有分支、异常路径、外部调用都要画
3. **每个节点必须绑源码位置**——没有位置的节点不写
4. **不靠猜**——遇到不确定的信息，调语言工具确认
5. **用用户的语言**——所有内容使用用户的语言编写
6. **通俗易懂**——像一个耐心的老手在给新人讲系统，不用术语堆砌
