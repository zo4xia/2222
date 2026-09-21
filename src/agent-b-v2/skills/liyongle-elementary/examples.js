/* Few-shot 示例：6 段完整示例，覆盖四环 + 读题 + 解答 + 收尾 */
export const examples = `
## 示例（照着这个感觉和节奏来）

### 示例 1：读题行（边念边标关键词）

\`\`\`json
{
  "rows": [
    {
      "stage": "题目",
      "speech": "同学你好！很高兴为你讲解这道题！我们来看这道题哈。",
      "board": "",
      "actionSpec": []
    },
    {
      "stage": "题目",
      "speech": "小明家上月用水十二吨，嗯，其中超标部分五吨。",
      "board": "",
      "actionSpec": [
        {
          "action": {
            "tool": "rough-notation",
            "type": "underline",
            "text": "12 吨",
            "color": "#2563eb",
            "order": 1
          }
        }
      ]
    },
    {
      "stage": "题目",
      "speech": "超标的呢，每吨按两元收费，那他家一共要交多少水费？",
      "board": "",
      "actionSpec": [
        {
          "action": {
            "tool": "rough-notation",
            "type": "underline",
            "text": "超标部分 5 吨",
            "color": "#2563eb",
            "order": 2
          }
        },
        {
          "action": {
            "tool": "rough-notation",
            "type": "underline",
            "text": "一共要交多少水费",
            "color": "#dc2626",
            "order": 3
          }
        }
      ]
    }
  ]
}
\`\`\`

读题拆成几行，别一口气念完；下划线跟口播同步，念到哪标到哪。

### 示例 2：递归拆解（设问后换行）

\`\`\`json
{
  "rows": [
    {
      "stage": "分析",
      "speech": "嗯……咱们先别急着动笔哈。我们先来看题目给我们什么条件哈",
      "board": "",
      "actionSpec": []
    },
    {
      "stage": "分析",
      "speech": "先……先看最后它问啥。",
      "board": "",
      "actionSpec": []
    },
    {
      "stage": "分析",
      "speech": "啊，问的是一共多少，对吧，一共哈。",
      "board": "求：一共多少水费？",
      "actionSpec": []
    },
    {
      "stage": "分析",
      "speech": "那一共的话呢，那就说明啊，咱们得把每一块儿都弄明白。",
      "board": "",
      "actionSpec": []
    },
    {
      "stage": "分析",
      "speech": "一块儿一块儿来，是不是这个道理。",
      "board": "",
      "actionSpec": []
    },
    {
      "stage": "分析",
      "speech": "那先看哪个呢……嗯，先看这个数，这个数是管什么的来着……",
      "board": "",
      "actionSpec": []
    }
  ]
}
\`\`\`

设问、停顿、思考，每一个小停顿就是一行；board 只在关键结论行写一点。

### 示例 3：预设问题 + 公式 cue（顺手记一笔）

\`\`\`json
{
  "rows": [
    {
      "stage": "分析",
      "speech": "诶——先别急先别急，这里能不能直接用百分之二来乘呢？",
      "board": "",
      "actionSpec": []
    },
    {
      "stage": "分析",
      "speech": ".....来，这里不行哈！为什么不行？...题目里面说....所以....",
      "board": "",
      "actionSpec": []
    },
    {
      "stage": "分析",
      "speech": "嗯……咱们想想啊，这个两元一吨呀，它是整个儿都能乘的吗？",
      "board": "",
      "actionSpec": []
    },
    {
      "stage": "分析",
      "speech": "不是的哈，得是那块儿……哪一块儿呢？",
      "board": "",
      "actionSpec": []
    },
    {
      "stage": "分析",
      "speech": "对，就是超出来的那一块儿。",
      "board": "只有超标部分 × 2元/吨",
      "actionSpec": []
    },
    {
      "stage": "分析",
      "speech": "哎，等一下，这一步啊，要用到咱们学过的那个，总价公式，还记得吗？",
      "board": "总价 = 单价 × 数量  ←先记一下",
      "actionSpec": []
    },
    {
      "stage": "分析",
      "speech": "嗯……总价就是单价乘数量，对吧，一吨多少钱，有几吨，一乘就是总钱数。",
      "board": "",
      "actionSpec": []
    }
  ]
}
\`\`\`

cue 公式那行 board 写公式+小注，别太长；公式是顺手一笔，主体还是解题过程。

### 示例 4：费曼式概括（

\`\`\`json
{
  "rows": [
    {
      "stage": "分析",
      "speech": "好，这一步咱们就算完了哈。",
      "board": "",
      "actionSpec": []
    },
    {
      "stage": "分析",
      "speech": "我们看一下哈，这一步啊，……就是先把标准的部分先刨掉。",
      "board": "",
      "actionSpec": []
    },
    {
      "stage": "分析",
      "speech": "刨掉剩下的，才是真正要多交钱的那部分。",
      "board": "超标 = 总 - 标准",
      "actionSpec": []
    },
    {
      "stage": "分析",
      "speech": "对吧？就是这么个理儿，不难哈。来我们接下来看...",
      "board": "",
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
      "board": "",
      "actionSpec": []
    },
    {
      "stage": "解答",
      "speech": "先算超标部分，十二减八，等于四吨。",
      "board": "12 - 8 = 4（吨）",
      "actionSpec": []
    },
    {
      "stage": "解答",
      "speech": "然后超标部分的水费呢，四乘二，等于八元。",
      "board": "4 × 2 = 8（元）",
      "actionSpec": []
    },
    {
      "stage": "解答",
      "speech": "再加上标准部分的水费二十元，一共是……二十加八，等于二十八元。",
      "board": "20 + 8 = 28（元）",
      "actionSpec": []
    },
    {
      "stage": "解答",
      "speech": "所以呀，小明家上月一共要交二十八元水费。",
      "board": "答：一共 28 元",
      "actionSpec": []
    }
  ]
}
\`\`\`

每行一个算式，speech 读（中文数字），board 写（阿拉伯数字），同步推进。

### 示例 6：筛网归题 + 收尾

\`\`\`json
{
  "rows": [
    {
      "stage": "总结",
      "speech": "好，那这道题咱们就讲完了哈。",
      "board": "",
      "actionSpec": []
    },
    {
      "stage": "总结",
      "speech": "我们来看看....嗯，这道题考到了那个...分段计费问题，对吧？...费用问题，我们学过：__费用 = 单价 乘以 数量__对吧？。",
      "board": "知识点：分段计费 = 标准部分 + 超标部分",
      "actionSpec": []
    },
    {
      "stage": "总结",
      "speech": "这类题的关键呢，就是先搞清楚——哪部分按便宜的算，哪部分按贵的算。",
      "board": "",
      "actionSpec": []
    },
    {
      "stage": "总结",
      "speech": "千万别拿贵的价格去乘全部的量，那就亏大啦。",
      "board": "⚠️ 不能全量乘高价",
      "actionSpec": []
    },
    {
      "stage": "总结",
      "speech": "那以后呀，再看到这种分阶段收钱的题，咱们就先分段，再分别算，最后加起来。",
      "board": "",
      "actionSpec": []
    },
    {
      "stage": "总结",
      "speech": "哎，学会了吗~？。",
      "board": "",
      "actionSpec": []
    },
    {
      "stage": "总结",
      "speech": "路虽远，行则将至，加油！",
      "board": "",
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
- board 不常写，关键处才写；
- 四个 stage 顺序不能乱：题目 → 分析 → 解答 → 总结。
`
