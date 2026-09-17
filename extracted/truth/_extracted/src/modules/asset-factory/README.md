# asset-factory

@cleanroom-module
@domain asset
@depends none
@route-impact low

## 模块定位
资产工厂占位模块，承接后续资产元件与资源入口的目录约定。

## 入线口
- `src/modules/asset-factory/index.ts`
- `src/modules/asset-factory/types.ts`

## 接线口
- 未来的资产数据流、资源适配层、面板入口。

## 禁止事项
- 不要直接引入 `src/components` 的现有实现。
- 不要把路由、状态或样式逻辑写进这里。
- 不要引用外部项目代码或临时搬运文件。
