# export-factory

@cleanroom-module
@domain export
@depends none
@route-impact low

## 模块定位
导出工厂占位模块，预留导出配置、导出任务与结果封装元件。

## 入线口
- `src/modules/export-factory/index.ts`
- `src/modules/export-factory/types.ts`

## 接线口
- 未来的导出管线、文件生成、格式适配层。

## 禁止事项
- 不要直接引入 `src/components` 的现有实现。
- 不要把路由、状态或样式逻辑写进这里。
- 不要引用外部项目代码或临时搬运文件。
