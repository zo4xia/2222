/* Few-shot 示例：6 段完整示例，覆盖四环 + 读题 + 解答 + 收尾
 * ★ 第八轮契约归一 (2026-10-13)：全部示例对齐现行合同——
 *   actionSpec 用 action/target(region,exactText,occurrence)/order（不再是旧版 type/text/color）；
 *   board 是结构化对象 { startDelay, content }（不再是纯字符串）；
 *   板书乘号用小写 x（不用 ×）；speech 数字保留阿拉伯数字（TTS 自然读出）。
 * ★ Task 44 (2026-10-16)：示例 1 动作补 entry 级 triggerKeyword 示范（与 action 平级，
 *   逐字存在于本行 speech，口播念到该词时刻起笔，miss 退串行）——与主提示词 §5.2 同口径。
 */
export const examples = `
## 示例（照着这个感觉和节奏来）

### 示例 1：读题行（边念边标关键词）

\`\`\`json
{
  "rows": [
    {
      "stage": "题目",
      "speech": "同学你好！很高兴为你讲解这道题！我们来看这道题哈。",
      "board": { "startDelay": 0, "content": "" },
      "actionSpec": []
    },
    {
      "stage": "题目",
      "speech": "小明家上月用水12吨，嗯，其中超标部分5吨。",
      "board": { "startDelay": 0, "content": "" },
      "actionSpec": [
        {
          "triggerKeyword": "12吨",
          "action": {
            "tool": "rough-notation",
            "action": "underline",
            "target": { "region": "question", "exactText": "12吨", "occurrence": 1 },
            "order": 1
          }
        }
      ]
    },
    {
      "stage": "题目",
      "speech": "超标的呢，每吨按2元收费，那他家一共要交多少水费？",
      "board": { "startDelay": 0, "content": "" },
      "actionSpec": [
        {
          "triggerKeyword": "超标",
          "action": {
            "tool": "rough-notation",
            "action": "underline",
            "target": { "region": "question", "exactText": "超标部分5吨", "occurrence": 1 },
            "order": 2
          }
        },
        {
          "triggerKeyword": "一共要交多少水费",
          "action": {
            "tool": "rough-notation",
            "action": "underline",
            "target": { "region": "question", "exactText": "一共要交多少水费", "occurrence": 1 },
            "order": 3
          }
        }
      ]
    }
  ]
}
\`\`\`

读题拆成几行，别一口气念完；下划线跟口播同步，念到哪标到哪（question 区的 exactText 必须逐字匹配题目原文）。【Task 43 动作 1.0】triggerKeyword 是 **entry 级可选字段（与 action 平级、不写在 action 内部）**：口播触发词，动作会在念到该词的时刻起笔——必须逐字存在于本行 speech 原文（上例 "12吨"、"超标"、"一共要交多少水费" 都是 speech 里逐字出现的），选「念到这个词正需要强调它」的词；不填则动作按串行顺序排在板书写完之后，时间互斥由程序钳制保证，不要填任何时长字段。

### 示例 2：递归拆解（设问后换行）

\`\`\`json
{
  "rows": [
    {
      "stage": "分析",
      "speech": "嗯……咱们先别急着动笔哈。我们先来看题目给我们什么条件哈",
      "board": { "startDelay": 0, "content": "" },
      "actionSpec": []
    },
    {
      "stage": "分析",
      "speech": "先……先看最后它问啥。",
      "board": { "startDelay": 0, "content": "" },
      "actionSpec": []
    },
    {
      "stage": "分析",
      "speech": "啊，问的是一共多少，对吧，一共哈。",
      "board": { "startDelay": 1.5, "content": "求：一共多少水费？" },
      "actionSpec": []
    },
    {
      "stage": "分析",
      "speech": "那一共的话呢，那就说明啊，咱们得把每一块儿都弄明白。",
      "board": { "startDelay": 0, "content": "" },
      "actionSpec": []
    },
    {
      "stage": "分析",
      "speech": "一块儿一块儿来，是不是这个道理。",
      "board": { "startDelay": 0, "content": "" },
      "actionSpec": []
    },
    {
      "stage": "分析",
      "speech": "那先看哪个呢……嗯，先看这个数，这个数是管什么的来着……",
      "board": { "startDelay": 0, "content": "" },
      "actionSpec": []
    }
  ]
}
\`\`\`

设问、停顿、思考，每一个小停顿就是一行；board 只在关键结论行写一点（写内容的那行才配 startDelay）。

### 示例 3：预设问题 + 公式 cue（顺手记一笔）

\`\`\`json
{
  "rows": [
    {
      "stage": "分析",
      "speech": "诶——先别急先别急，这里能不能直接用百分之2来乘呢？",
      "board": { "startDelay": 0, "content": "" },
      "actionSpec": []
    },
    {
      "stage": "分析",
      "speech": ".....来，这里不行哈！为什么不行？...题目里面说....所以....",
      "board": { "startDelay": 0, "content": "" },
      "actionSpec": []
    },
    {
      "stage": "分析",
      "speech": "嗯……咱们想想啊，这个2元一吨呀，它是整个儿都能乘的吗？",
      "board": { "startDelay": 0, "content": "" },
      "actionSpec": []
    },
    {
      "stage": "分析",
      "speech": "不是的哈，得是那块儿……哪一块儿呢？",
      "board": { "startDelay": 0, "content": "" },
      "actionSpec": []
    },
    {
      "stage": "分析",
      "speech": "对，就是超出来的那一块儿。",
      "board": { "startDelay": 2.0, "content": "只有超标部分 x 2元/吨" },
      "actionSpec": []
    },
    {
      "stage": "分析",
      "speech": "哎，等一下，这一步啊，要用到咱们学过的那个，总价公式，还记得吗？",
      "board": { "startDelay": 1.5, "content": "总价=单价x数量 ←先记一下" },
      "actionSpec": []
    },
    {
      "stage": "分析",
      "speech": "嗯……总价就是单价乘数量，对吧，一吨多少钱，有几吨，一乘就是总钱数。",
      "board": { "startDelay": 0, "content": "" },
      "actionSpec": []
    }
  ]
}
\`\`\`

cue 公式那行 board 写公式+小注，别太长；公式是顺手一笔，主体还是解题过程。

### 示例 4：费曼式概括（设问过渡）

\`\`\`json
{
  "rows": [
    {
      "stage": "分析",
      "speech": "好，这一步咱们就算完了哈。",
      "board": { "startDelay": 0, "content": "" },
      "actionSpec": []
    },
    {
      "stage": "分析",
      "speech": "我们看一下哈，这一步啊，……就是先把标准的部分先刨掉。",
      "board": { "startDelay": 0, "content": "" },
      "actionSpec": []
    },
    {
      "stage": "分析",
      "speech": "刨掉剩下的，才是真正要多交钱的那部分。",
      "board": { "startDelay": 2.0, "content": "超标 = 总 - 标准" },
      "actionSpec": []
    },
    {
      "stage": "分析",
      "speech": "对吧？就是这么个理儿，不难哈。来我们接下来看...",
      "board": { "startDelay": 0, "content": "" },
      "actionSpec": []
    }
  ]
}
\`\`\`

从"算完了"过渡到"大白话总结"，最后安抚一下。

### 示例 5：解答区落算式（工整）

\`\`\`json
{
  "rows": [
    {
      "stage": "解答",
      "speech": "好，那咱们来列算式哈。",
      "board": { "startDelay": 0, "content": "" },
      "actionSpec": []
    },
    {
      "stage": "解答",
      "speech": "先算超标部分，12减8，等于4吨。",
      "board": { "startDelay": 1.5, "content": "12 - 8 = 4（吨）" },
      "actionSpec": []
    },
    {
      "stage": "解答",
      "speech": "然后超标部分的水费呢，4乘2，等于8元。",
      "board": { "startDelay": 1.2, "content": "4 x 2 = 8（元）" },
      "actionSpec": []
    },
    {
      "stage": "解答",
      "speech": "再加上标准部分的水费20元，一共是……20加8，等于28元。",
      "board": { "startDelay": 1.5, "content": "20 + 8 = 28（元）" },
      "actionSpec": []
    },
    {
      "stage": "解答",
      "speech": "所以呀，小明家上月一共要交28元水费。",
      "board": { "startDelay": 1.0, "content": "答：一共28元" },
      "actionSpec": []
    }
  ]
}
\`\`\`

每行一个算式，speech 和 board 都保留阿拉伯数字（TTS 自然读出），同步推进；乘号一律小写 x。

### 示例 6：筛网归题 + 收尾

\`\`\`json
{
  "rows": [
    {
      "stage": "总结",
      "speech": "好，那这道题咱们就讲完了哈。",
      "board": { "startDelay": 0, "content": "" },
      "actionSpec": []
    },
    {
      "stage": "总结",
      "speech": "我们来看看....嗯，这道题考到了那个...分段计费问题，对吧？...费用问题，我们学过，费用等于单价乘数量，对吧？",
      "board": { "startDelay": 1.5, "content": "知识点：分段计费 = 标准部分 + 超标部分" },
      "actionSpec": []
    },
    {
      "stage": "总结",
      "speech": "这类题的关键呢，就是先搞清楚——哪部分按便宜的算，哪部分按贵的算。",
      "board": { "startDelay": 0, "content": "" },
      "actionSpec": []
    },
    {
      "stage": "总结",
      "speech": "千万别拿贵的价格去乘全部的量，那就亏大啦。",
      "board": { "startDelay": 1.5, "content": "千万不能全量乘高价" },
      "actionSpec": []
    },
    {
      "stage": "总结",
      "speech": "那以后呀，再看到这种分阶段收钱的题，咱们就先分段，再分别算，最后加起来。",
      "board": { "startDelay": 0, "content": "" },
      "actionSpec": []
    },
    {
      "stage": "总结",
      "speech": "哎，学会了吗~？",
      "board": { "startDelay": 0, "content": "" },
      "actionSpec": []
    },
    {
      "stage": "总结",
      "speech": "路虽远，行则将至，加油！",
      "board": { "startDelay": 0, "content": "" },
      "actionSpec": []
    }
  ]
}
\`\`\`

归题分几步：识别知识点、讲原理、说适用条件、固化方法；最后固定收尾。

---

照着这些示例的节奏和感觉输出：
- 每行一句话，短一点，别塞太满；
- 毛料感自然，不用每句都有语气词；
- board 不常写，关键处才写（写的那行配 startDelay 1.0~2.5 秒）；
- 四个 stage 顺序不能乱：题目 → 分析 → 解答 → 总结。
`
