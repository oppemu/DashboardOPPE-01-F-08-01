/* อ่านอย่างเดียว: แยกความคืบหน้าเป็นครั้งที่ไม่ซ้ำ และตรวจความครบของข้อมูลต่างหาก */
(function(root){'use strict';
const norm=v=>String(v==null?'':v).trim().replace(/[๐-๙]/g,d=>String(d.charCodeAt(0)-3664));
const code=v=>(norm(v).match(/OPPE-\d{2}-[PMW](?:I)?-\d{2}/i)||[])[0]||'';
const positive=v=>/^\d+$/.test(norm(v))&&Number(norm(v))>0&&Number.isSafeInteger(Number(norm(v)))?Number(norm(v)):null;
function visit(v){const m=norm(v).match(/^(\d+)\s*\/\s*(\d+)$/);return m&&+m[1]>0&&+m[2]>0&&Number.isSafeInteger(+m[1])&&Number.isSafeInteger(+m[2])?{current:+m[1],total:+m[2]}:null;}
const REQUIRED=Array.from({length:57},(_,i)=>i);
function columnName(j){let s='';for(let n=j+1;n>0;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;}
function audit(values,registry,reviews,rules){rules=rules||{};const headers=values[0]||[],map=new Map(),req=rules.requiredColumns||REQUIRED;let rows=0;
values.slice(1).forEach((r,i)=>{if(!r.some(v=>norm(v)))return;rows++;const row=i+2,c=code(r[7]),year=norm(r[44]),contract=norm(r[45]).replace(/\s+/g,'');
const baseKey=JSON.stringify([norm(r[5]),c,String(r[8]??'').trim(),norm(r[10]),norm(r[11])]);
const key=JSON.stringify([baseKey,contract||'ไม่ระบุสัญญา',year||'ไม่ระบุปี']);
if(!map.has(key))map.set(key,{key,baseKey,code:c,procedure:String(r[7]??'').trim(),subject:String(r[8]??'').trim(),location:norm(r[5]),year,contract:norm(r[45]),company:norm(r[9]),rows:[],identityIncomplete:!year||!contract,contracts:[norm(r[45])],years:[year]});
const missing=req.filter(j=>!norm(r[j])).map(j=>({column:j+1,label:(String(headers[j]??'').trim().replace(/\s+/g,' ')||'ไม่มีชื่อคอลัมน์')+' ('+columnName(j)+')'}));
const displayRow=rules.displayValues?.[i+1];if(displayRow&&norm(displayRow[0])!==norm(r[0]))throw new Error('ข้อมูลเปลี่ยนระหว่างอ่าน กรุณาอัปเดตอีกครั้ง');const visitValue=displayRow?displayRow[15]:r[15];
const v=visit(visitValue),expected=positive(r[14]),issues=[];
// เครื่องหมาย - ถือว่าได้กรอกช่องนี้แล้ว ตามนิยามผู้ใช้งาน
const chemNA=/^(?:-|ไม่มี(?:สารเคมี)?|ไม่เกี่ยวข้อง(?:กับสารเคมี)?|ไม่ได้ใช้(?:สารเคมี)?)$/.test(norm(r[31]));
if(!rules.inputOnly&&/ไม่เกี่ยว|ไม่มี|ไม่ได้/.test(norm(r[30]))&&norm(r[31])&&!chemNA)issues.push('ระบุไม่เกี่ยวข้องสารเคมี แต่กรอกชื่อสารเคมี');
// ทุกช่อง A:BE ถูกตรวจช่องว่างแล้ว รวม AF; ไม่เพิ่มข้อสังเกตตามเนื้อหา
if(!v)issues.push('จำนวนครั้งไม่ใช่รูปแบบ X/Y ที่ถูกต้อง');if(!expected)issues.push('จำนวนครั้งตามสัญญาไม่ใช่จำนวนเต็มบวก');if(v&&v.current>v.total)issues.push('จำนวนครั้งเกินเป้าหมาย');if(v&&expected&&v.total!==expected)issues.push('ตัวหารไม่ตรงจำนวนครั้งตามสัญญา');
const stableId=norm(r[0]),idCount=values.slice(1).filter(x=>norm(x[0])===stableId).length;
const checks=(rules.reviewChecks||[]).filter(x=>x.stableId?x.stableId===stableId:x.row===row);const check=checks.length===1&&(!checks[0].stableId||(stableId&&idCount===1))?checks[0]:null,hash=rules.rowHashes&&rules.rowHashes[row];
const manual=(rules.inputOnly?[]:rules.guardedFindings?.manualFindings||[]).filter(f=>f.stableId===stableId).map(f=>{const cells=Object.entries(f.expectedCells||{});const matches=!!stableId&&idCount===1&&cells.every(([c,v])=>{const j=c.split('').reduce((n,ch)=>n*26+ch.charCodeAt(0)-64,0)-1;return norm(r[j])===norm(v);});return matches?{reason:f.reason,caveat:f.caveat,evidence:cells.map(([c,v])=>c+': '+v).join(' · ')+' · '+f.caveat,checkedAt:rules.guardedFindings.checkedAt}:{reason:'ข้อมูลเปลี่ยนจากผลตรวจเดิม ต้องตรวจใหม่',evidence:'ไม่ใช้ข้อสังเกตเก่าเป็นข้อสรุปของข้อมูลปัจจุบัน',checkedAt:rules.guardedFindings.checkedAt};});
const reviewDecision=check&&hash&&hash===check.hash?check.decision:'unreviewed';
map.get(key).rows.push({row,manual,stableId,idUnique:!!stableId&&idCount===1,evidence:{year:year,contract:contract,visit:norm(visitValue),expected:norm(r[14]),detail:norm(r[40]),chemicalStatus:norm(r[30]),chemical:norm(r[31])},visitText:norm(visitValue),visit:v,expected,missing,issues,status:norm(r[38]),reviewDecision});
});
const result=Array.from(map.values()).map(g=>{const totals=[...new Set(g.rows.map(r=>r.expected).filter(Boolean))];g.expected=totals.length===1?totals[0]:null;
const valid=g.rows.filter(r=>r.visit&&r.expected&&r.visit.total===r.expected&&r.visit.current<=r.expected);const nums=valid.map(r=>r.visit.current),unique=[...new Set(nums)];
g.recorded=unique.length;g.maximum=unique.length?Math.max(...unique):0;g.duplicateVisits=unique.filter(n=>nums.filter(x=>x===n).length>1);g.missingVisits=g.expected&&g.expected<=10000?Array.from({length:g.expected},(_,i)=>i+1).filter(n=>!unique.includes(n)):[];
g.validationIssues=[];if(totals.length!==1)g.validationIssues.push('จำนวนครั้งตามสัญญาไม่ตรงกันหรือไม่ระบุ');if(g.identityIncomplete)g.validationIssues.push('รอยืนยันปีงบประมาณหรือเลขสัญญา');if(g.duplicateVisits.length)g.validationIssues.push('พบเลขครั้งซ้ำ: '+g.duplicateVisits.join(', '));if(g.rows.some(r=>r.issues.length))g.validationIssues.push('พบข้อมูลที่ต้องทบทวนในรายการย่อย');
g.finalFraction=g.expected?g.recorded+'/'+g.expected:'0/0';g.latestFraction=g.expected?g.maximum+'/'+g.expected:'0/0';g.terminalReached=Boolean(g.expected&&valid.some(r=>r.visit.current===g.expected));g.allVisitsPresent=Boolean(g.expected&&unique.length===g.expected&&g.missingVisits.length===0);
g.fieldsComplete=g.rows.every(r=>!r.missing.length);g.missingCellCount=g.rows.reduce((n,r)=>n+r.missing.length,0);g.reviewClear=g.rows.every(r=>r.reviewDecision==='clear');
g.status=!g.expected?'review':!g.allVisitsPresent?'ongoing':!g.fieldsComplete?'fields':g.validationIssues.length||!g.reviewClear?'review':'complete';return g;});
// คนละเลขสัญญาห้ามบวกเป็นสัญญาเดียว และข้อมูลเก่าที่ไม่ระบุสัญญาอาจซ้ำกับชุดใหม่
result.forEach(g=>{g.relatedGroups=result.filter(x=>x.baseKey===g.baseKey&&x.key!==g.key).map(x=>x.key);if(g.relatedGroups.length&&g.identityIncomplete){g.validationIssues.push('อาจซ้ำกับข้อมูลสัญญาที่ระบุรหัสแล้ว ต้องตรวจแยก');}});
const topics=[...new Set(result.map(g=>JSON.stringify([g.code,g.subject])))].map(k=>{const[c,s]=JSON.parse(k),members=result.filter(g=>g.code===c&&g.subject===s);return {code:c,subject:s,groups:members.map(g=>g.key),terminalReached:members.length>0&&members.every(g=>g.allVisitsPresent),fullyVerified:members.length>0&&members.every(g=>g.status==='complete')};});
const reviewMap=new Map((reviews||[]).map(r=>[r.id,r]));const codeCounts={};(registry||[]).forEach(p=>codeCounts[p.code]=(codeCounts[p.code]||0)+1);
const procedures=(registry||[]).map(r=>{const review=reviewMap.get(r.id)||{status:'unreviewed'};const aliases=r.submittedCodeAliases||[];const matched=result.filter(g=>g.code===r.code||aliases.includes(g.code));const mappingUncertain=Boolean(review.note)||!r.code||codeCounts[r.code]>1;const exact=result.filter(g=>g.code===r.code);const progress={hasData:matched.length>0,multiple:matched.length>1,current:matched.length===1?matched[0].recorded:0,total:matched.length===1?matched[0].expected||0:0,percent:matched.length===1&&matched[0].expected?Math.round(matched[0].recorded/matched[0].expected*100):null};
let completion=!matched.length?'noData':mappingUncertain?'review':matched.every(g=>g.status==='complete')?'complete':matched.some(g=>g.status==='ongoing'||g.status==='fields')?'incomplete':'review';
return Object.assign({},r,{review,groups:matched.length,groupKeys:matched.map(g=>g.key),mappingUncertain,coverage:mappingUncertain?'ambiguous':exact.length?'submitted':'notfound',progress,completion});});
const observedCodes=[...new Set(result.map(g=>g.code))];const unknown=observedCodes.filter(c=>!procedures.some(p=>p.code===c||(p.submittedCodeAliases||[]).includes(c)));
const coverage={required:procedures.filter(p=>p.review.status==='yes').length,matched:procedures.filter(p=>p.review.status==='yes'&&p.coverage==='submitted').length,notFound:procedures.filter(p=>p.review.status==='yes'&&p.coverage==='notfound').length,ambiguous:procedures.filter(p=>p.review.status==='yes'&&p.coverage==='ambiguous').length,formCodeMismatch:procedures.filter(p=>p.review.status==='mismatch').length};
return {rows,groups:result,topics,procedures,coverage,unknownCodes:unknown,rules:{requiredColumns:req,description:'ครบครั้งและผ่านตรวจช่องหลัก/รายละเอียด ณ วันที่ตรวจ ไม่ใช้แทนการตรวจรับ'},totals:{procedures:procedures.length,referenced:procedures.filter(p=>p.review.status==='yes').length,mismatch:procedures.filter(p=>p.review.status==='mismatch').length,unreviewed:procedures.filter(p=>p.review.status==='unreviewed').length,groups:result.length,topics:topics.length,terminalTopics:topics.filter(t=>t.terminalReached).length,enteredProcedures:observedCodes.length,complete:result.filter(g=>g.status==='complete').length,terminalReached:result.filter(g=>g.allVisitsPresent).length,ongoing:result.filter(g=>g.status==='ongoing').length,fields:result.filter(g=>g.status==='fields').length,review:result.filter(g=>g.status==='review').length,completeProcedures:procedures.filter(p=>p.completion==='complete').length,incompleteProcedures:procedures.filter(p=>p.completion==='incomplete').length,reviewProcedures:procedures.filter(p=>p.completion==='review').length}};
}
root.ProcurementAudit={audit,visit,code,norm,REQUIRED};if(typeof module!=='undefined')module.exports=root.ProcurementAudit;
})(typeof globalThis!=='undefined'?globalThis:this);
