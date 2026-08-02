/**
 * Planning Plugin — 计划模板（5 套）
 */

export interface PlanTemplate {
  name: string;
  tasks: { name: string; prerequisites?: number[]; note?: string }[];
}

export const TEMPLATES: Record<string, PlanTemplate> = {
  review: {
    name: "代码审查",
    tasks: [
      { name: "通读代码，理解整体结构" },
      { name: "检查类型安全和边界条件" },
      { name: "检查错误处理和日志" },
      { name: "检查性能热点" },
      { name: "编写审查总结", prerequisites: [1, 2, 3, 4] },
    ],
  },
  refactor: {
    name: "重构",
    tasks: [
      { name: "分析现有代码，确定重构范围" },
      { name: "编写/更新单元测试（安全网）", prerequisites: [1] },
      { name: "执行重构", prerequisites: [2] },
      { name: "验证测试通过", prerequisites: [3] },
      { name: "更新文档", prerequisites: [4] },
    ],
  },
  deploy: {
    name: "部署上线",
    tasks: [
      { name: "检查所有测试通过" },
      { name: "生成 changelog" },
      { name: "创建备份/快照" },
      { name: "执行部署", prerequisites: [1, 2, 3] },
      { name: "健康检查和冒烟测试", prerequisites: [4] },
    ],
  },
  dev: {
    name: "开发迭代",
    tasks: [
      { name: "明确需求和验收标准" },
      { name: "实现核心逻辑", prerequisites: [1] },
      { name: "测试验证", prerequisites: [2] },
      { name: "修复测试中发现的问题", prerequisites: [3] },
      { name: "最终验证和交付", prerequisites: [4] },
    ],
  },
  feature: {
    name: "功能开发",
    tasks: [
      { name: "明确需求和验收标准" },
      { name: "设计方案", prerequisites: [1] },
      { name: "实现核心逻辑", prerequisites: [2] },
      { name: "编写单元测试", prerequisites: [3] },
      { name: "集成测试和调试", prerequisites: [3, 4] },
    ],
  },
};
