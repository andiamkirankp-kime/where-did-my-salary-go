import {validateBackup} from './core.mjs?v=7';
const FORMAT='salary-control-encrypted-backup',ITERATIONS=600000,MAX=2*1024*1024;
function base64(bytes){const data=new Uint8Array(bytes);let text='';for(let i=0;i<data.length;i+=8192)text+=String.fromCharCode(...data.subarray(i,i+8192));return btoa(text);}
function unbase64(text){if(typeof text!=='string'||text.length>MAX||!/^[A-Za-z0-9+/]*={0,2}$/.test(text))throw new Error('This backup is not valid.');return Uint8Array.from(atob(text),char=>char.charCodeAt(0));}
async function passwordKey(password,salt,iterations){const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);}
export async function encryptBackup(data,password,now=new Date()){
 if(!validateBackup(data))throw new Error('Your account data is not valid.');
 if(typeof password!=='string'||password.length<12)throw new Error('Use a backup password with at least 12 characters.');
 const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
 const key=await passwordKey(password,salt,ITERATIONS);
 const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(FORMAT+':1')},key,new TextEncoder().encode(JSON.stringify(data)));
 return JSON.stringify({format:FORMAT,version:1,createdAt:now.toISOString(),kdf:'PBKDF2-SHA256',iterations:ITERATIONS,salt:base64(salt),iv:base64(iv),ciphertext:base64(ciphertext)});
}
export function parseBackup(text){if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX)throw new Error('Choose a backup under 2 MB.');let parsed;try{parsed=JSON.parse(text);}catch{throw new Error('This file is not a Salary Control backup.');}if(validateBackup(parsed))return {encrypted:false,data:parsed};if(parsed?.format!==FORMAT||parsed.version!==1||parsed.kdf!=='PBKDF2-SHA256'||!Number.isInteger(parsed.iterations)||parsed.iterations<100000||parsed.iterations>1000000)throw new Error('This backup format is not supported.');const salt=unbase64(parsed.salt),iv=unbase64(parsed.iv),ciphertext=unbase64(parsed.ciphertext);if(salt.length!==16||iv.length!==12||ciphertext.length<16)throw new Error('This backup is damaged.');return {encrypted:true,envelope:parsed,salt,iv,ciphertext};}
export async function decryptBackup(text,password){const parsed=parseBackup(text);if(!parsed.encrypted)return parsed.data;let data;try{const key=await passwordKey(password,parsed.salt,parsed.envelope.iterations);const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:parsed.iv,additionalData:new TextEncoder().encode(FORMAT+':1')},key,parsed.ciphertext);data=JSON.parse(new TextDecoder().decode(plain));}catch{throw new Error('The password is incorrect or this backup is damaged.');}if(!validateBackup(data))throw new Error('The restored data is not valid.');return data;}
