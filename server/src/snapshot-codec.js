// Lossless, session-local deltas over reliable ordered WebSocket. Input is already fog-filtered.
// The worker offsets periodic keyframes per seat to spread fanout bursts.
// Store serialized values, not references into live effects/ability state. Commit only after send succeeds.
export function encodeSnapshot(frame,previous,offset=0){
 let fullLength=2,keys=0;
 const fields=Object.create(null),rows=frame.u,rs=frame.rs,rsFields=Object.create(null);
 for(const k of Object.keys(frame)){const value=JSON.stringify(frame[k]);if(value===undefined)continue;fields[k]=value;fullLength+=JSON.stringify(k).length+1+value.length+(keys++?1:0);}
 if(rs)for(const k of Object.keys(rs)){const v=JSON.stringify(rs[k]);if(v!==undefined)rsFields[k]=v;}
 // Unit rows are primitive arrays freshly made by rows()/fogRow(). Retain private copies for callers that reuse them.
 const base={q:frame.q,fields,rows:rows.map(r=>r.slice()),rsFields};
 if(!previous||(frame.q+offset)%100===0||rows.length!==previous.rows.length||rows.some((r,i)=>r[0]!==previous.rows[i][0]||r.length!==previous.rows[i].length))return {data:JSON.stringify(frame),base};
 const change={},remove=[],patch=[],rsChange={},rsRemove=[];
 for(const k of Object.keys(fields))if(!['t','q','u','ev','rs'].includes(k)&&fields[k]!==previous.fields[k])change[k]=frame[k];
 for(const k of Object.keys(previous.fields))if(!(k in fields)&&k!=='rs')remove.push(k);
 for(let i=0;i<rows.length;i++){const row=rows[i],old=previous.rows[i],p=[i];for(let j=1;j<row.length;j++)if(row[j]!==old[j])p.push(j,row[j]);if(p.length>1)patch.push(p);}
 if(rs){for(const k of Object.keys(rsFields))if(rsFields[k]!==previous.rsFields[k])rsChange[k]=rs[k];for(const k of Object.keys(previous.rsFields))if(!(k in rsFields))rsRemove.push(k);}
 const delta={t:'sd',q:frame.q,b:previous.q,c:change,u:patch,ev:frame.ev};
 if(remove.length)delta.r=remove;
 if(rs){delta.rs=rsChange;if(rsRemove.length)delta.rr=rsRemove;}else if('rs' in previous.fields)remove.push('rs');
 if(remove.length)delta.r=remove;
 const data=JSON.stringify(delta);
 return {data:data.length<fullLength?data:JSON.stringify(frame),base};
}
