const pending=new Map();let sequence=0;
export const nativeAvailable=()=>typeof window!=='undefined'&&!!window.SalaryNative?.postMessage;
export function nativeCall(method,payload={}){
 if(!nativeAvailable())return Promise.reject(new Error('The Android service is unavailable.'));
 if(!window.SalaryNative.onmessage)window.SalaryNative.onmessage=event=>{let message;try{message=JSON.parse(event.data);}catch{return;}const job=pending.get(message.id);if(!job)return;clearTimeout(job.timer);pending.delete(message.id);if(message.error){const error=new Error(message.error.message||'This action could not finish.');Object.assign(error,message.error);job.reject(error);}else job.resolve(message.result);};
 return new Promise((resolve,reject)=>{const id=String(++sequence),timer=setTimeout(()=>{pending.delete(id);reject(new Error('This action took too long. Please try again.'));},120000);pending.set(id,{resolve,reject,timer});try{window.SalaryNative.postMessage(JSON.stringify({id,method,payload}));}catch(error){clearTimeout(timer);pending.delete(id);reject(error);}});
}
