/**
 * 板书锚定核心（board anchor core）——Task 63 片1 抽核（夏夏拍板「最安全办 + 做减法」）。
 *
 * 同源纪律：findRange / sameBoardLine / tokenizeLine / readBrace 四函数体与 row-player.html
 *   内嵌版【字节级一致】——本文件是它们的唯一 ESM 真源（供生成工作台校验消费）；row-player
 *   三胞胎（root/public/dist）md5 铁律零触碰，播放器行为零变化。镜像对拍哨兵
 *   scripts/test-player-mirror-parity.mjs B13 锁死两版行为+源文本不漂移：
 *   改这里必须同步改 row-player.html 并过五重门；改那里同理（哨兵会当场揪出半边改）。
 *
 * 消费方：AgentBDirect.actionAnchorStatus（生成期「锚定存在性校验」）。
 *   旧实现 pool.includes 字符串近似无视行界与 occurrence——校验放行、播放器拒画
 *   =静默丢下划线（Task 62/63 夏夏实锤的兄弟病理，活在校验侧的残留）。换真 findRange
 *   语义后达成「校验放行 ⇒ 播放必画」：行内/跨折行/occ/frac 占位符三向行为归一。
 */
/* 同行判据+锚定匹配：以下四函数体= row-player.html L696-753 / L800-821 逐字节复制 */

function findRange(chars,sub,occ,opts){
  /* ★ Task 62 下划线落点根治：整池连续滑窗 → 按行分段行内滑窗。
     旧实现在整池上滑窗匹配不看行界——exactText 恰好横跨两行/两列时命中跨行字符：
     x1 取自第一行行尾、x2 取自第二行行首，下划线长度=跨行距离（整块板乱窜）。
     新规：行内命中才算命中（板书池字符带全局 li、题目池 layoutText 自带 li；无 li 旧池按同基线 y 分行兜底）——
     跨行目标宁可明示不画（warn 跳过），不可画错位置。 */
  /* ★ Task 63 题目区跨折行分段（夏夏「题目字号 30、自动文本换行」）：题目文本由 layoutText
     按区域宽自动折行（约 697px、30px 字号每行约 23 字），Agent 无从预知折行点——exactText
     恰跨折行点时行内匹配会整条拒画=静默丢下划线。题目区调用传 opts.allowWrap=true 走
     「连续流匹配 + 命中区间按行切段」：occ 语义=池内第 N 个连续匹配（App 侧
     textTargetRegistry indexOf 同语义），每段独立行内 x1/x2（跨行乱线几何仍不可能），
     下划线逐段画=老师跨行划重点「一行一段」的自然手部动作。
     板书区不传 allowWrap：板书行 Agent 可见，跨行 exactText 属 Agent 失误，宁拒不画。 */
  if(!sub)return null;                // 防御：空串不再匹配（rough-line 无 target，曾致 chars[-1] 崩溃；arrow 已砍）
  occ=occ||1; let hit=0;
  const n=chars.length,m=sub.length;
  const allowWrap=!!(opts&&opts.allowWrap);
  if(allowWrap){
    for(let i=0;i+m<=n;i++){          // 连续流滑窗（无视行界，命中后再按行切段）
      let ok=true;
      for(let k=0;k<m;k++) if(chars[i+k].ch!==sub[k]){ok=false;break;}
      if(!ok)continue;
      hit++;
      if(hit<occ)continue;
      const segs=[]; let s=i;
      while(s<i+m){                   // 命中区间按行切段：sameBoardLine 同段者归一段
        let e=s+1;
        while(e<i+m&&sameBoardLine(chars[s],chars[e]))e++;
        segs.push({x1:chars[s].x,y1:chars[s].y,x2:chars[e-1].x+chars[e-1].w,y2:chars[e-1].y});
        s=e;
      }
      const a=chars[i];
      return {x1:segs[0].x1,y1:segs[0].y1,x2:segs[segs.length-1].x2,y2:segs[segs.length-1].y2,
        size:(a.size!=null?a.size:30),segments:segs};
    }
    return null;
  }
  let s=0;
  while(s<n){
    let e=s+1;
    while(e<n&&sameBoardLine(chars[s],chars[e]))e++;   // 行段 [s,e)
    for(let i=s;i+m<=e;i++){                          // 行段内滑窗
      let ok=true;
      for(let k=0;k<m;k++) if(chars[i+k].ch!==sub[k]){ok=false;break;}
      if(ok){hit++; if(hit===occ){
        const a=chars[i], b=chars[i+m-1];
        return {x1:a.x,y1:a.y,x2:b.x+b.w,y2:b.y,size:(a.size!=null?a.size:30),
          segments:[{x1:a.x,y1:a.y,x2:b.x+b.w,y2:b.y}]};}}
    }
    s=e;
  }
  return null;
}
/* 同行判据：优先全局 li（Task 62 起板书池/题目池都带），旧池无 li 时同基线 y 兜底 */
function sameBoardLine(a,b){
  if(a.li!=null&&b.li!=null)return a.li===b.li;
  return a.y===b.y;
}

function readBrace(s,idx){
  if(s[idx]!=='{')return {text:'',next:idx};
  let depth=0,k=idx,out='';
  for(;k<s.length;k++){
    if(s[k]==='{')depth++;
    else if(s[k]==='}'){depth--; if(depth===0){k++;break;}}
    else out+=s[k];
  }
  return {text:out,next:k};
}
function tokenizeLine(s){
  const toks=[]; let i=0;
  while(i<s.length){
    if(s.startsWith('\\frac',i)){
      const a=readBrace(s,i+5);
      const b=readBrace(s,a.next);
      toks.push({frac:{num:a.text,den:b.text}});
      i=b.next;
    } else { toks.push({ch:s[i]}); i++; }
  }
  return toks;
}

/* ★ 中英词汇桥（与 row-player drawAction 内联桥同字面量，哨兵 B13 锁死）：
   rows.stage 中文硬约束（prompt.js「题目/分析/解答/总结」）↔ target.region 英文白名单
   （textTargetRegistry VALID_REGIONS）——契约两侧本就两套词汇，校验与执行器单点归一。 */
const REGION_STAGE_ZH = { analysis: '分析', solution: '解答', summary: '总结' };

/* 板书锚定校验流：行数组 → 零坐标字符流（li=行号保真）。
   与播放器 boardCharPool 的 token 语义一致：\frac 记号打不匹配占位符 \uE000，
   exactText 误锚进公式字面量时校验与播放器同判 miss。坐标全零不影响 findRange 的
   null 判定（行界/occ/匹配只读 ch 与 li）；题目池同理零坐标（allowWrap 连续流
   只看 ch，切段 segments 不被校验消费）。 */
function buildBoardAnchorFlow(lines){
  const out=[];
  (lines||[]).forEach((line,li)=>{
    for(const t of tokenizeLine(String(line||''))){
      out.push({ch:(t.frac?'\uE000':t.ch), li:li});
    }
  });
  return out;
}
function buildQuestionAnchorFlow(text){
  return [...String(text||'')].map((ch)=>({ch:ch, li:0}));
}

export { findRange, sameBoardLine, tokenizeLine, readBrace, REGION_STAGE_ZH, buildBoardAnchorFlow, buildQuestionAnchorFlow };
