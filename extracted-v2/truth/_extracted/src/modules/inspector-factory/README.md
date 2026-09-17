# inspector-factory

@cleanroom-module
@domain inspector
@depends none
@route-impact low

## 模块定位
检查器工厂占位模块，预留属性查看、诊断和调试面板元件。

## 入线口
- `src/modules/inspector-factory/index.ts`
- `src/modules/inspector-factory/types.ts`

## 接线口
- 未来的属性面板、调试信息、选中态联动。

## 禁止事项
- 不要直接引入 `src/components` 的现有实现。
- 不要把路由、状态或样式逻辑写进这里。
- 不要引用外部项目代码或临时搬运文件。
