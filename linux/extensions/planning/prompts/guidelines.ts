/**
 * Planning Plugin — LLM Guidelines（13 条）
 */

export const GUIDELINES: string[] = [
  "每次状态变更后及时用 plan_tasks(action='update') 更新，避免任务偏移。" +
    "\n例：\n" +
    "  用户原始信息:\"实现登录功能\"\n" +
    "  工具调用:\"plan_tasks(action='update', changes=[{id:5,status:'completed'}])\"",

  "新建任务用 plan_tasks(action='add')，只追加不替换。" +
    "\n例：\n" +
    "  用户原始信息:\"能不能加个暗黑模式？\"\n" +
    "  工具调用:\"plan_tasks(action='add', tasks=[{id:6,name:'添加暗黑模式'}])\"",

  "开始任务前用 plan_tasks(action='update') 将状态设为 in_progress。" +
    "\n例：\n" +
    "  用户原始信息:\"开始修那个超时的问题\"\n" +
    "  工具调用:\"plan_tasks(action='update', changes=[{id:5,status:'in_progress'}])\"",

  "完成任务后立即用 plan_tasks 将状态设为 completed。" +
    "\n例：\n" +
    "  用户原始信息:\"测试通过了！\"\n" +
    "  工具调用:\"plan_tasks(action='update', changes=[{id:5,status:'completed'}])\"",

  "任务阻塞时设为 paused；取消任务时设为 cancelled。",

  "需要同时追加任务和更新状态时，序列调用 add + update。" +
    "\n例：\n" +
    "  用户原始信息:\"重构完成，接下来做性能优化\"\n" +
    "  工具调用:\"plan_tasks(action='add', tasks=[{id:6,name:'性能优化'}]) → plan_tasks(action='update', changes=[{id:5,status:'completed'}])\"",

  "任务描述简短精准。" +
    "\n例：\n" +
    "  用户原始信息:\"用户反馈登录有时候会超时需要排查和修复\"\n" +
    "  工具调用:\"plan_tasks(action='add', tasks=[{id:7,name:'修复 login 超时问题'}])\"",

  "任何待解决事项都应创建为任务——设计讨论、技术决策、bug 分析都算。" +
    "\n例：\n" +
    "  用户原始信息:\"我们要不要用 Redis 做缓存？\"\n" +
    "  工具调用:\"plan_tasks(action='add', tasks=[{id:8,name:'决定缓存方案'}])\"",

  "改动实施后必须通过测试验证方可标记完成。" +
    "\n例：\n" +
    "  用户原始信息:\"改了 force-sync.ts\"\n" +
    "  工具调用:\"先 /reload 验证 → 通过后 plan_tasks(action='update', changes=[{id:9,status:'completed'}])\"",

  "对插件/项目自身的操作（git、软链接、迁移）也是任务。" +
    "\n例：\n" +
    "  用户原始信息:\"把插件挪到 /data/repos/\"\n" +
    "  工具调用:\"plan_tasks(action='add', tasks=[{id:10,name:'迁移扩展仓库'}])\"",

  "多轮无进展的进行中任务 → 退回暂停。" +
    "\n例：\n" +
    "  用户原始信息:\"先不管那个集成了\"\n" +
    "  工具调用:\"plan_tasks(action='update', changes=[{id:10,status:'paused'}])\"",

  "父任务前置子任务。建依赖前自问：'A 完成 B 才能开始？' → B 前置 A。'B 都完成 A 才算完？' → A 前置 B。" +
    "\n例：\n" +
    "  用户原始信息:\"优化同步体验需要几条改进\"\n" +
    "  工具调用:\"plan_tasks(action='add', tasks=[{id:11,name:'优化同步',prerequisites:[12,13,14]},{id:12,name:'加规则'},{id:13,name:'改消息'},{id:14,name:'加模板'}])\"",

  "计划阶段先分析顺序关系，需要时拆分为有依赖的子任务。" +
    "\n例：\n" +
    "  用户原始信息:\"需要设计数据库、实现API、写测试\"\n" +
    "  工具调用:\"plan_tasks(action='add', tasks=[{id:15,name:'设计数据库'},{id:16,name:'实现API',prerequisites:[15]},{id:17,name:'编写测试',prerequisites:[16]}])\"",
];
