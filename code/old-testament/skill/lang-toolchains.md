# 语言工具链参考

分析代码时别靠猜，用工具拿精确信息。下面按语言列出常用的工具，挑当前项目用得上的就行。

## TypeScript / JavaScript

**类型和语义**
- `tsc --noEmit` — 跑一遍类型检查，看看有没有类型错误，不会真的编译出文件
- `tsserver` / TypeScript LSP — 编辑器背后那个"智能提示引擎"，能查类型推断、跳转到定义、找谁引用了某个函数

**语法结构**
- `tree-sitter` (typescript/javascript grammar) — 把源码解析成语法树，精确知道函数从哪行开始到哪行结束

**搜索定位**
- `grep` / `ripgrep` — 最朴素但最可靠的全局搜索，找符号、找字符串、找 import 关系

## Python

**类型和语义**
- `pyright` / `mypy` — Python 的类型检查器，能推断出变量类型、发现类型不匹配
- `pylsp` / Pyright LSP — 定义跳转、引用查找、补全

**语法结构**
- `tree-sitter` (python grammar) — 解析类和函数边界
- Python 内置 `ast` 模块 — `python -c "import ast; ..."` 也能解析语法树，不需要额外安装

**搜索定位**
- `grep` / `ripgrep` — `rg "def function_name" --type py`

## Go

**类型和语义**
- `gopls` — Go 官方的 LSP，类型推断、定义跳转、引用查找都靠它
- `go vet` — 官方静态分析，能发现一些编译器抓不到的常见错误
- `go build` — 编译一遍看看有没有问题

**语法结构**
- `tree-sitter` (go grammar) — 解析接口定义、结构体、函数签名

**搜索定位**
- `grep` / `ripgrep` — `rg "func.*HandlerName" --type go`

## Java / Kotlin

**类型和语义**
- `jdtls` (Java) / `kotlin-language-server` — LSP，查类型、跳定义、找引用
- `javac` / `kotlinc` — 编译检查

**语法结构**
- `tree-sitter` (java/kotlin grammar) — 解析注解、类继承、方法边界

**搜索定位**
- `grep` / `ripgrep` — `rg "@RestController" --type java`

## Rust

**类型和语义**
- `rust-analyzer` — Rust 的 LSP，类型推断、定义跳转、引用查找，还能展开宏
- `cargo check` — 快速编译检查，不生成二进制
- `cargo clippy` — 静态 lint，能发现惯用写法问题

**语法结构**
- `tree-sitter` (rust grammar) — 解析 trait 实现、模块结构

**搜索定位**
- `grep` / `ripgrep` — `rg "pub fn" --type rust`

## C / C++

**类型和语义**
- `clangd` — C/C++ 的 LSP，类型推断、定义跳转、引用查找
- `clang` / `gcc` — 编译检查

**语法结构**
- `tree-sitter` (c/cpp grammar) — 解析头文件、宏定义、函数签名

**搜索定位**
- `grep` / `ripgrep` — `rg "void.*function_name" --type cpp`

## 所有语言都能用的

- `grep` / `ripgrep` — 全局搜索符号和字符串，最万能的工具
- `find` — 按文件名或扩展名定位文件
- `wc -l` — 统计行数
- `git log` / `git blame` — 看修改历史，了解某段代码为什么这么写
- `tree` — 快速看目录结构
