# Character Triptych

一个专门为 Higgsfield Soul 2.0 人物三联图服务的桌面工具。输入一段人物描述，选择是否会在 Higgsfield 里另配参考图，即可得到正面全身、背面全身、面部特写组成的完整英文 Prompt。

## 功能

- 单条人物描述优化，保持 v1 的低复杂度工作流
- “有参考图 / 无参考图”两种身份锚定写法
- DeepSeek API 与本地 Codex CLI 两种等价 Provider
- 完整 Prompt 一键复制，左 / 中 / 右三格可分别复制
- 显示身份锚点、跨格服装和 AI 补全假设
- 设置与历史记录只保存在本机
- GitHub Actions 自动构建 macOS Apple Silicon DMG 与 Windows x64 NSIS

## 身份开关是什么意思

应用本身不接收图片。

- 有参考图：你稍后会自己在 Higgsfield 上传人物参考图。输出会强调面部、发型、体态和身份与该图完全一致。
- 无参考图：没有图像锚点，输出会补全年龄、性别呈现、人种外观类型、身高、脸型、发型、体态和气质。

## 使用

1. 安装并打开应用。
2. 在“设置”里检测本地 Codex CLI，或填入 DeepSeek API Key。
3. 输入一个人物描述，选择身份锚定方式和 Provider。
4. 点击“开始优化”，复制完整 Prompt 到 Higgsfield Soul 2.0。
5. 在 Higgsfield UI 中设置 16:9、2k；如果已有身份资产，再选择对应 Soul ID。

## 隐私与安全

- DeepSeek Key 写入 Tauri 本地 Store，不进入源码、网络日志或历史记录。
- Codex CLI 复用本机登录状态。人物描述从 stdin 传给子进程，不会拼接进 shell 命令。
- Codex 子进程使用只读沙箱、临时会话、JSON Schema 和可配置超时。
- 应用没有图片上传、识图、账号系统或云端历史。
- 选择 DeepSeek 时，人物文字会发送给 DeepSeek API；选择 Codex CLI 时，则遵循本机 Codex 的服务与数据设置。

## 本地开发

需要 Node.js 22、Rust stable，以及当前平台的 Tauri 系统依赖。

```bash
npm install
npm run check
npm run check:rust
npm run tauri dev
```

只预览 React 界面：

```bash
npm run dev
```

浏览器预览不会调用桌面 IPC，因此 Provider 会显示为不可用。

## 测试

```bash
npm test
```

测试覆盖 LIRA 人物三联规则提取范围、两种身份模式、JSON 解析降级、Provider 可用性以及 Codex 用户输入不进入命令参数。

## 发布

推送语义化版本标签后，Desktop Builds 工作流会在两个 runner 上构建安装包并创建 GitHub Release：

```bash
git tag v0.1.0
git push origin v0.1.0
```

发布页同时提供 SHA-256 校验文件。当前首发安装包未做 Apple Developer ID 或 Windows Authenticode 商业签名，首次打开时系统可能显示来源确认。

## 规则来源

内置规则从 Lira Image Prompt Optimization 的人物 / Soul 2.0 / Soul ID / 三联图部分定向提取，当前规则版本为 1.0.0。其他模型与地点、道具、修图分支未装入系统 Prompt。
