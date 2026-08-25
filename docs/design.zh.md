# 设计

[English](design.md)

`dsh-capability-resolver` 以一个可安装 Host+Client bundle 交付，因为解析器、模型可见 consumer、Connection adapter 和 Plugins 设置页需要一起发布并同步演进。

## 数据流

```text
固定公开目录 GET ──> 有界解析器 ──> Host last-good 缓存
                                           |
Loader 条目 + 模型可调用工具/Skill           |
                        \                  |
用户需求 ───────────────> 确定性本地解析器
                              |             |
                 capability_resolve 工具    |
                              |             |
                    模型安全投影             |
                              |             |
                    模型 + 结果会话日志       |
                                            |
                 loopback Connection RPC <──┘
                              |
                    完整已校验 UI 响应
                              |
                    Plugins 设置发现页
```

目录 provider 只接收针对 `https://awesome-dsh-plugin.com/plugins.json` 的固定 GET。自然语言需求在目录下载完成后才被接收并在本地匹配。没有查询参数、请求体、可配置目的地址或 provider callback 会收到需求文本。

## Host 所有权

Host 负责配置、目录传输、输入上限、规范化记录、确定性排序、last-good 缓存状态、Loader 观测、当前模型可调用工具/Skill 读取，以及 loopback RPC handler。注册项与缓存状态属于插件 apply 生命周期，并一同释放。

缓存分别设置新鲜与旧缓存时间窗。成功观测在新鲜窗口内可复用。并发的冷启动或刷新观测共享一个针对固定来源的 GET；取消一个观测者不会取消其他观测者仍在等待的请求，只有最后一个观测者离开或插件被释放时，共享请求才会中止。释放流程会等待该请求结束。刷新失败时，最近一次成功观测只能在旧缓存上限内使用，且明确标记为 stale。目录不可用或只完成部分解析时，结果会明确表达该状态。

当前 Loader 模块只被描述为“已配置”。解析器不会推断模块已成功安装、完成初始化、通过健康检查，或兼容当前 DSH release。

## 目录规范化

根目录身份、规范更新日期或 UTC 时间戳及分类会先通过校验，然后才消费具体条目。分类标签与允许的 monorepo 路径具有固定字符上限。每条记录独立解析：无效记录被跳过并计数，但其不可信原始内容不会进入警告。响应字节、条目数量、描述、需求文本、结果数量、当前匹配与对外匹配词均受配置上限约束。完整 loopback 解析结果还受固定的 512 KiB UTF-8 JSON 上限约束；构造结果时会丢弃尾部可选候选与可能匹配，同时保留支持 `use-existing` 或 `consider-plugin` 决策所需的条目。

仓库与目录详情链接必须通过允许的 HTTPS 规则。可选 npm 包名只有在通过严格包名解析后，才变为 `{ kind: "npm", packageName }`。目录中的 shell 文本永远不会作为安装指令保留。

## 本地排序

中英文文本会先规范化再匹配。常见需求填充词与低信息能力词被排除；拉丁文本匹配使用有意义 token，而不是任意子串；中文短语保留有用的本地词项。由同一个原始需求概念产生的词形变化与意图同义词只计为一个 coverage 单元，因此扩展本身不能满足多概念门槛。短语 `market data` 要求候选同时具有精确的市场与数据能力证据；独立的金融领域证据会提高 coverage，避免插件 marketplace 仅凭名称匹配胜出。少量经源码审阅的词表扩展语音转录等常见跨语言意图；新增意图必须同时增加误报与排序测试。这仍是确定性本地匹配，不是通用语义搜索。排序只使用本地规范化条目字段和确定性 tie-break。热度元数据可以作为来源证据展示，但不代表相关性、可信度、兼容性或安全性。

## Consumer

`capability_resolve` 工具把当前模型可调用工具/Skill 与 Host 目录解析结合。DSH `0.1.1-rc.2` 提供 canonical tool value 与渲染内容，但没有一个会改变模型序列化或会话重放行为的标准不可信内容标记。因此，工具会在 DSH 接收成功结果前，把完整解析结果映射为独立的安全 canonical value。该投影省略全部目录与当前能力自由文本，再次校验仓库、目录详情与可选 npm 标识符，只保留稳定来源身份和有界的本地/数值事实，并渲染明确的不可信数据提示。同一个安全值会进入 Code Mode。直接调用会把安全渲染发送给模型并写入 `tool/result`；Code Mode 子调用会把安全渲染写入 `tool/code-dispatch`。工具不会执行建议的下一步。

浏览器 Client 注册一个 `settings.plugins.tab` contribution。它调用固定 loopback channel，并在渲染已配置匹配、目录状态、候选与证据前深度校验完整响应。校验会再次执行 Host 的 512 KiB JSON 上限、列表/文本最大长度、canonical GitHub 仓库语法，以及由同一 owner/repository/path 身份推导的 awesome-dsh-plugin 详情页规则。该 UI-only 响应可以保留有界的不可信名称、描述、分类标签与警告，但不会被复用为工具结果。外部链接只有在通过该身份校验后才可交互。UI 不会拼接或执行安装命令。

## 失败行为

- 无效配置在插件加载时失败。
- 空白、过长、格式错误或被取消的本地请求在请求入口失败。
- 传输超时、非 JSON 内容、数据过大、无效根数据，以及没有可用 last-good 状态时，返回明确的 unavailable 结果。
- 单条无效记录产生部分结果和有界的通用警告。
- 外部刷新失败不会破坏 Loader/工具/Skill 读取，也不会修改已配置插件。
- 释放插件会取消所属工作，并通过各自正常生命周期移除 RPC、工具和 UI 注册项。

## 兼容性所有权

[`compatibility/dsh.json`](../compatibility/dsh.json) 固定唯一声明支持的 DSH release，以及负责 profile 安装、Client 加载、Connection RPC、Plugins 设置、工具、模型结果记录和 Skill 的官方文件。定时 workflow 只检测漂移，不会编辑记录或声称兼容。维护者必须审阅已变化的官方源码，并重新执行 release 验收路径。
