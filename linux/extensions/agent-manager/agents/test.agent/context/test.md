# 测试上下文

这是 test agent 的专属上下文文件。

如果此内容出现在 LLM 对话中，说明 context 注入功能正常。

## 验证检查

- ✅ context/ 目录被正确读取
- ✅ 文件名排序后拼接
- ✅ CONTEXT_MARKER 过滤机制正常工作
