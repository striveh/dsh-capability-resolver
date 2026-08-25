# DSH 能力发现器

[English](README.md)

[![CI](https://github.com/striveh/dsh-capability-resolver/actions/workflows/ci.yml/badge.svg)](https://github.com/striveh/dsh-capability-resolver/actions/workflows/ci.yml)
[![DSH 上游兼容性](https://github.com/striveh/dsh-capability-resolver/actions/workflows/upstream-drift.yml/badge.svg)](https://github.com/striveh/dsh-capability-resolver/actions/workflows/upstream-drift.yml)

这是一个非官方、独立维护的 DeepSeek Harness 插件，面向一个需求优先的问题：当前已经配置了哪些能力，接下来有哪些社区插件值得人工检查？

解析器只读运行。它不会安装、启用、禁用、更新或执行候选插件。它从 `https://awesome-dsh-plugin.com/plugins.json` 下载完整公开目录，把用户需求留在本地 DSH Host 中，并只在本地排序规范化后的记录。Plugins 设置页展示经过深度校验的完整证据；模型可见工具只接收独立的安全投影，不包含不可信目录自由文本。

被目录收录、GitHub topic、star 和下载量只是发现元数据，不代表 DeepSeek 背书、兼容性证明、安全审查或安装建议。

## 状态与兼容性

版本 `0.1.0` 只声明一个目标：DeepSeek Harness `0.1.1-rc.2`。它不声称兼容更早或更新的 DSH 版本。

机器可读记录位于 [`compatibility/dsh.json`](compatibility/dsh.json)。每周 workflow 会比较 DSH 最新公开 release，并计算本插件依赖的官方文件 Git blob 摘要。出现新 release、tag 移动、事实源缺失或摘要变化时，自动化会新建或更新一个审阅 issue 并让 workflow 失败；它不会自动扩大兼容声明。

## 基础能力

- 读取当前 Loader 模块名，以及当前模型可调用的工具和 Skill。
- 只请求固定 HTTPS 社区目录，请求中绝不包含用户需求文本。
- 对目录输入做有界解析；单条无效记录不会让整个发现流程失效。
- 在 Host 本地对中英文需求做确定性排序。
- 返回 `use-existing`、`consider-plugin`、`no-match` 或 `unavailable`，并附带当前匹配、目录完整性、旧缓存状态、警告、候选和匹配证据。
- 通过仅 loopback 可用的 `/dsh-capability-resolver` Connection RPC channel 提供结果。
- 在 Web Plugins 设置下新增发现页，并提供只读 `capability_resolve` 工具；其 canonical value 与渲染结果只包含严格标识符和有界的本地/数值事实。
- 只有目录中的 npm 包名通过严格解析时，才把它作为结构化 `installSpec` 证据展示；绝不把它变成命令执行。

## 安装

前置条件：

- DeepSeek Harness `0.1.1-rc.2`；
- Node.js `22.19` 或 package engine 允许的更新版本；
- `PATH` 中有 pnpm，这是 `dsh plugin` 的要求。

`v0.1.0` 发布后，把已审阅 tag 安装进 Web profile：

```sh
dsh plugin --profile web add github:striveh/dsh-capability-resolver#v0.1.0
dsh --profile web --dump-config
dsh web
```

新增、更新、禁用或移除 bundle 后，需要重启正在运行的 Web profile。展开后的配置中应出现 `dsh-capability-resolver` 层。仓库提交预构建 `lib/`，并有意不提供 `prepare`、`preinstall`、`install` 或 `postinstall` 脚本，因此从 GitHub 安装不需要授予 package 构建权限。

开发期间可安装本地未发布 checkout：

```sh
dsh plugin --profile web add .
dsh --profile web --dump-config
dsh web
```

## 使用

打开 Web 设置，选择 Plugins，在发现页中用中文或英文描述需要的能力。页面会优先展示已配置匹配，只在本地排序器找到证据时展示社区候选。

模型可见工具为 Agent-backed session 提供相同的只读发现路径。工具参数及安全投影后的结果仍遵循 DSH 正常的会话日志规则。目录名称、描述、分类、匹配词、警告和当前能力名称不会进入模型可见 canonical value 或面向会话日志的渲染文本；严格校验的仓库/目录 URL 和可选 npm 标识符仍可用于识别候选。目录提供方始终收不到需求文本。

采取任何安装步骤前，请自行检查候选仓库、目录详情页与 package 内容。一个候选可能“相关”，但仍然可能不兼容、已停止维护、不安全、标注错误或不适合当前 profile。

## 配置

Bundle 显式声明了全部部署可调默认值；目录 URL 有意不可配置。

| 字段 | 默认值 | 允许范围 | 含义 |
| --- | ---: | ---: | --- |
| `freshCacheMs` | `900000` | `1000..86400000` | 最近一次成功目录在该时长内视为新鲜。 |
| `staleCacheMs` | `86400000` | `1000..604800000` | 刷新失败后可使用 last-good 旧缓存的最长时长；不得小于 `freshCacheMs`。 |
| `fetchTimeoutMs` | `5000` | `100..60000` | 固定目录请求超时。 |
| `maxCatalogBytes` | `8388608` | `65536..33554432` | 解析前允许的最大响应字节数。 |
| `maxCatalogEntries` | `5000` | `1..20000` | 最多处理的目录记录数。 |
| `maxTaskChars` | `2000` | `64..16000` | 允许的最大需求文本长度。 |
| `maxResults` | `8` | `1..50` | 最多返回的社区候选数。 |
| `maxCurrentMatches` | `8` | `1..50` | 最多返回的已配置、工具或 Skill 匹配数。 |
| `maxDescriptionChars` | `600` | `80..4000` | 单条候选描述保留的最大字符数。 |
| `maxMatchedTerms` | `12` | `1..50` | 作为证据展示的本地匹配词上限。 |

如需覆盖默认值，在 `$DSH_HOME/profiles/web/cordis.patch.yml` 中增加更晚的配置行。DSH 会替换目标行的完整 `config`，因此需要重述全部字段：

```yaml
- id: dsh-capability-resolver
  config:
    freshCacheMs: 900000
    staleCacheMs: 86400000
    fetchTimeoutMs: 5000
    maxCatalogBytes: 8388608
    maxCatalogEntries: 5000
    maxTaskChars: 2000
    maxResults: 8
    maxCurrentMatches: 8
    maxDescriptionChars: 600
    maxMatchedTerms: 12
```

## 禁用或卸载

如果要保留依赖但禁用插件，在 profile 的后续 patch 中添加以下内容，然后重启 Web：

```yaml
- id: dsh-capability-resolver
  disabled: true
```

移除依赖及其 bundle 层：

```sh
dsh plugin --profile web remove dsh-capability-resolver
```

本插件不创建安装数据库，也不持久化需求文本。移除本插件不会移除用户在人工审阅候选后另行安装的任何插件。

## 隐私与信任

Host 持有有界、内存中的 last-good 目录缓存。UI 请求通过 loopback Connection channel。唯一固定的外部请求只下载目录，不包含需求文本、凭据、Cookie 或安装动作。数据流、保留策略和威胁假设见 [`docs/privacy-and-trust.zh.md`](docs/privacy-and-trust.zh.md)，实现分流见 [`docs/design.zh.md`](docs/design.zh.md)。

本插件不为候选提供 sandbox、恶意代码扫描、package 签名验证、依赖审计、兼容性测试或维护者身份认证。来源链接只是供人继续检查的证据，不是信任结论。

## 开发与发布证据

```sh
pnpm install --frozen-lockfile
node scripts/assert-dsh-test-version.mjs 0.1.1-rc.2
pnpm verify
pnpm pack --dry-run
```

`pnpm verify` 会运行 Host/Client 类型检查、聚焦测试、兼容性 helper 测试、隔离的干净 production 构建、发布 package 校验和固定兼容记录校验。构建产物门禁不会先覆盖 checkout，而是逐项比较隔离构建与待发布 `lib/` 的完整文件集合和字节。Package 校验会另行检查 exports、必要产物路径、Web lazy loader id、bundle 默认值、loopback channel、固定目录 URL、安装期生命周期脚本必须缺失，以及构建后 JavaScript 不得引入命令执行依赖。

Build 或单元测试通过不等于可安装 bundle 验收。Release 还必须把准确公开 tag 安装到隔离的 DSH home/profile，检查 `--dump-config`，启动 Web，通过 keyless fixture 走完 Plugins 设置页，并验证禁用与移除行为。详见 [`CONTRIBUTING.md`](CONTRIBUTING.md)。

## 局限

- 排序结合词法证据和一小组经过审阅的常见跨语言意图词；它不是通用语义搜索，也不是适用性证明。
- 完整目录仍可能漏掉有用插件；目录不完整或使用旧缓存时会显式标识。
- Loader 中存在只代表“已配置”，不代表安装成功、启用、兼容或健康。
- 固定社区目录是独立外部来源，可能包含错误或恶意元数据。
- 本插件不提供自动安装、验证、回滚或更新流程。
- DSH 仍处于 developer preview；未来版本可能要求同步调整源码、package、UI、RPC 或 profile。

## 许可证

[MIT](LICENSE)。DeepSeek Harness 与 DeepSeek 名称归各自权利人所有。
