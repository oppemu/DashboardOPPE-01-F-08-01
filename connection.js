/* Authenticated Apps Script bridge. No JSONP, public endpoint, token in config, or cached data. */
(function(){'use strict';
let frame,peer,peerOrigin,readyPromise,receiveHandler,pending=new Map();
const nonce=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
function gasOrigin(value){try{const u=new URL(value);return u.protocol==='https:'&&(u.hostname==='script.google.com'||u.hostname==='script.googleusercontent.com'||u.hostname.endsWith('-script.googleusercontent.com'));}catch{return false;}}
function clearRequests(message){for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error(message));}pending.clear();}
function connect(){if(readyPromise)return readyPromise;
readyPromise=new Promise((resolve,reject)=>{
 const raw=window.APP_CONFIG?.webAppUrl;if(!raw){reject(Error('กรุณาตั้งลิงก์ /exec ใน config.js'));return;}
 let url;try{url=new URL(raw);if(url.protocol!=='https:'||url.hostname!=='script.google.com'||!/^\/(?:macros\/s|a\/macros\/mahidol\.ac\.th\/s)\/[A-Za-z0-9_-]+\/exec$/.test(url.pathname)||url.search||url.hash)throw Error();}catch{reject(Error('ลิงก์ Apps Script ไม่ถูกต้อง'));return;}
 if(location.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(location.hostname)){reject(Error('ต้องเปิดผ่าน HTTPS ไม่ใช่ไฟล์ในเครื่อง'));return;}
 url.searchParams.set('mode','bridge');url.searchParams.set('origin',location.origin);url.searchParams.set('nonce',nonce);
 const timer=setTimeout(()=>{reject(Error('เชื่อม Google ไม่สำเร็จ กรุณาเข้าสู่บัญชีที่ได้รับสิทธิ์ และตรวจการตั้งค่า Deploy/โดเมน/คุกกี้ของเบราว์เซอร์'));},25000);
 function receive(event){const msg=event.data;if(!gasOrigin(event.origin)||!msg||msg.channel!=='mu-contractor-v1'||msg.nonce!==nonce)return;
  if(msg.type==='ready'&&!peer){peer=event.source;peerOrigin=event.origin;clearTimeout(timer);resolve();return;}
  if(event.source!==peer||event.origin!==peerOrigin)return;
  const req=pending.get(msg.requestId);if(!req)return;clearTimeout(req.timer);pending.delete(msg.requestId);
  if(msg.type==='result'&&msg.payload&&Array.isArray(msg.payload.rows)&&Array.isArray(msg.payload.reviews)){req.resolve(msg.payload);}else req.reject(Error('อ่านข้อมูลไม่ได้ กรุณาตรวจสิทธิ์บัญชีและการเชื่อมชีท'));
 }
 receiveHandler=receive;window.addEventListener('message',receive);
 frame=document.createElement('iframe');frame.hidden=true;frame.title='เชื่อมข้อมูล Google แบบอ่านอย่างเดียว';frame.referrerPolicy='no-referrer';frame.src=url.href;document.body.append(frame);
}).catch(e=>{readyPromise=null;if(receiveHandler){window.removeEventListener('message',receiveHandler);receiveHandler=null;}peer=null;peerOrigin=null;if(frame){frame.remove();frame=null;}clearRequests(e.message);throw e;});return readyPromise;}
window.DashboardConnection={async read(){await connect();const requestId=crypto.randomUUID();return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(requestId);reject(Error('อ่านข้อมูลนานเกินไป กรุณากดอัปเดตข้อมูลอีกครั้ง'));},30000);pending.set(requestId,{resolve,reject,timer});peer.postMessage({channel:'mu-contractor-v1',nonce,type:'read',requestId},peerOrigin);});}};
})();
