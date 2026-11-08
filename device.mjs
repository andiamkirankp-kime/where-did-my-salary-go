import {validateBackup} from './core.mjs?v=7';
import {nativeAvailable,nativeCall} from './native.mjs?v=7';
export class DeviceError extends Error {constructor(message,kind='storage',details={}){super(message);this.kind=kind;Object.assign(this,details);}}
const aad=id=>new TextEncoder().encode('salary-control-device:1:'+id);
export class BrowserVault {
 constructor({indexedDBImpl=globalThis.indexedDB}={}){this.indexedDB=indexedDBImpl;this.dbPromise=null;}
 open(){if(!this.indexedDB)throw new DeviceError('This browser cannot keep your financial data.');return this.dbPromise??=(new Promise((resolve,reject)=>{const request=this.indexedDB.open('salary-control-device-v1',1);request.onupgradeneeded=()=>{for(const store of ['money','keys','identity'])request.result.createObjectStore(store);};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(new DeviceError('Storage could not be opened.'));request.onblocked=()=>reject(new DeviceError('Close your other app tabs, then try again.'));}));}
 async get(store,id){const db=await this.open();return new Promise((resolve,reject)=>{const request=db.transaction(store,'readonly').objectStore(store).get(id);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(new DeviceError('Storage could not be read.'));});}
 async put(store,id,value){const db=await this.open();return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(value,id);tx.oncomplete=resolve;tx.onerror=()=>reject(new DeviceError('Your changes could not be kept on this device.'));});}
 async identity(){return (await this.get('identity','active'))||null;}
 async setIdentity(user){return this.put('identity','active',user);}
 async key(id){let key=await this.get('keys',id);if(key)return key;const generated=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);const db=await this.open();return new Promise((resolve,reject)=>{const tx=db.transaction('keys','readwrite'),store=tx.objectStore('keys'),read=store.get(id);read.onsuccess=()=>{key=read.result||generated;if(!read.result)store.put(key,id);};tx.oncomplete=()=>resolve(key);tx.onerror=()=>reject(new DeviceError('The encryption key could not be saved.'));});}
 async decode(id,row){if(!row)return {data:null,revision:0};try{const key=await this.get('keys',id);if(!key)throw new Error('Missing key');const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:row.iv,additionalData:aad(id)},key,row.ciphertext);const data=JSON.parse(new TextDecoder().decode(plain));if(!validateBackup(data))throw new Error('Invalid state');return {data,revision:row.revision};}catch{throw new DeviceError('The saved data on this device could not be opened. Restore a backup to continue.');}}
 async read(id){return this.decode(id,await this.get('money',id));}
 async write(id,data,revision,{replace=false}={}){
  if(!validateBackup(data))throw new DeviceError('This financial record is not valid.');
  if(new TextEncoder().encode(JSON.stringify(data)).length>1024*1024)throw new DeviceError('Keep financial records under 1 MB.');
  const key=await this.key(id),iv=crypto.getRandomValues(new Uint8Array(12)),ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad(id)},key,new TextEncoder().encode(JSON.stringify(data)));
  const db=await this.open();let previous,next;
  await new Promise((resolve,reject)=>{const tx=db.transaction('money','readwrite'),store=tx.objectStore('money'),request=store.get(id);request.onsuccess=()=>{previous=request.result;if(!replace&&(previous?.revision||0)!==revision){tx.abort();return;}next={revision:(previous?.revision||0)+1,iv,ciphertext};store.put(next,id);};tx.oncomplete=resolve;tx.onabort=()=>reject(new DeviceError('Another tab saved newer data.','conflict',{row:previous}));tx.onerror=()=>reject(new DeviceError('Your changes could not be saved on this device.'));});
  return {revision:next.revision,updatedAt:Date.now()};
 }
 async clear(id){const db=await this.open();return new Promise((resolve,reject)=>{const tx=db.transaction(['money','keys'],'readwrite');tx.objectStore('money').delete(id);tx.objectStore('keys').delete(id);tx.oncomplete=resolve;tx.onerror=()=>reject(new DeviceError('The data could not be removed.'));});}
}
export class NativeVault {
 async identity(){return (await nativeCall('session')).user||null;}
 async setIdentity(){/* Native identity is established by verified sign-in. */}
 async read(id){const saved=await nativeCall('readMoney',{accountId:id});if(saved.data&&!validateBackup(saved.data))throw new DeviceError('Saved data is not valid. Restore a backup.');return saved;}
 async write(id,data,revision,{replace=false}={}){return nativeCall(replace?'replaceMoney':'writeMoney',{accountId:id,data,revision});}
 async clear(id){return nativeCall('clearMoney',{accountId:id});}
}
export class DeviceStore {
 constructor({vault=nativeAvailable()?new NativeVault():new BrowserVault(),onStatus=()=>{},onSaved=()=>{}}={}){this.vault=vault;this.onStatus=onStatus;this.onSaved=onSaved;this.user=null;this.revision=0;this.pending=null;this.inFlight=null;this.conflict=null;}
 async load(user){if(this.inFlight)try{await this.inFlight;}catch{}if(this.user?.id!==user.id){this.pending=null;this.conflict=null;}this.user=user;const saved=await this.vault.read(user.id);this.revision=saved.revision;return {...saved,user};}
 queue(data){if(!this.user)return;this.pending=structuredClone(data);this.onStatus(this.conflict?'conflict':'saving');if(!this.conflict)queueMicrotask(()=>this.flush().catch(()=>{}));}
 async flush(){if(this.conflict)throw new DeviceError('Choose which local copy to keep.','conflict');if(this.inFlight){await this.inFlight;return this.pending?this.flush():undefined;}if(!this.pending||!this.user)return;const data=this.pending;this.pending=null;const id=this.user.id;
  this.inFlight=(async()=>{try{const saved=await this.vault.write(id,data,this.revision);this.revision=saved.revision;this.onSaved({...saved,data});this.onStatus(this.pending?'saving':'saved');}catch(error){if(!this.pending)this.pending=data;if(error.kind==='conflict'){this.conflict='row' in error?await this.vault.decode(id,error.row):{data:error.data||null,revision:error.revision||0};this.onStatus('conflict');}else this.onStatus('error');throw error;}})();
  try{await this.inFlight;}finally{this.inFlight=null;}if(this.pending)await this.flush();
 }
 async replace(data){if(this.inFlight)try{await this.inFlight;}catch{}this.pending=null;this.conflict=null;const saved=await this.vault.write(this.user.id,data,this.revision,{replace:true});this.revision=saved.revision;this.onSaved({...saved,data});this.onStatus('saved');return saved;}
 resolveConflict(useLocal){if(!this.conflict)return;const remote=this.conflict;this.revision=remote.revision;this.conflict=null;if(!useLocal)this.pending=null;this.onStatus(useLocal?'saving':'saved');return remote.data;}
}
