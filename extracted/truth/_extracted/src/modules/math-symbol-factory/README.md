# math-symbol-factory

@cleanroom-module
@domain math-symbol
@depends none
@route-impact low

## 模块定位
数学符号工厂占位模块，预留公式符号、表达式片段与符号面板元件。

## 入线口
- `src/modules/math-symbol-factory/index.ts`
- `src/modules/math-symbol-factory/types.ts`

## 接线口
- 未来的数学符号库、公式编辑、符号选择联动。

## 禁止事项
- 不要直接引入 `src/components` 的现有实现。
- 不要把路由、状态或样式逻辑写进这里。
- 不要引用外部项目代码或临时搬运文件。
