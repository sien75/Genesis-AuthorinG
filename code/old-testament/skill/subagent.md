# Scan 任务

**场景：`{场景名称}`，入口：`{入口文件}`**

**可用工具：`{工具清单}`**（已根据项目技术栈选定并确认已安装，直接使用即可）

**主视图：`{主视图}`** | **辅助视图：`{辅助视图}`**

你需要从入口出发，以 **`{主视图}`** 的视角阅读和组织叙事。遇到分支就展开所有路径，遇到外部调用（数据库、第三方服务、消息队列等）就标记边界。

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

分析完成后，将结果写入 `.ot/modules/{场景名称}.html`。

使用纯 HTML，不写 CSS 样式（浏览器默认样式即可）。图使用 Mermaid.js 语法，通过 CDN 渲染。

页面结构参考：

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>{场景名称}</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
  <script>mermaid.initialize({startOnLoad: true});</script>
</head>
<body>
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
  </pre>

  <!-- 每个节点对应的源码位置 -->
  <h2>源码位置</h2>
  <ul>
    <li>步骤一 — <code>src/foo.ts:12-30</code></li>
    <li>步骤二 — <code>src/bar.ts:45-72</code></li>
  </ul>

  <h2>补充说明</h2>
  <ul>
    <li>（notes 内容）</li>
  </ul>
</body>
</html>
```

## 描述风格

像给新人讲系统。

**不要这样写：**
> 此模块实现了文件上传的 validation pipeline，接收 `input: Buffer, projectId: string`

**要这样写：**
> 这一步会检查文件格式和大小，太大或格式不对就直接告诉用户不行

## 关键约束

1. **覆盖率由程序算**——必须调 `ot-coverage` 标记，不 mark 就不算读过
2. **流程图要完整**——所有分支、异常路径、外部调用都要画
3. **每个节点必须绑源码位置**——没有位置的节点不写
4. **不靠猜**——遇到不确定的信息，调语言工具确认
5. **用用户的语言**——所有内容使用用户的语言编写
6. **通俗易懂**——像一个耐心的老手在给新人讲系统，不用术语堆砌
