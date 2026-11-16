export function showError(error:unknown){uni.showToast({title:error instanceof Error?error.message:'操作失败，请重试',icon:'none',duration:3000})}
export function confirmAction(title:string,content:string){return new Promise<boolean>(resolve=>uni.showModal({title,content,success:r=>resolve(r.confirm),fail:()=>resolve(false)}))}
export function go(url:string){uni.navigateTo({url})}
export function numberValue(value:unknown,min:number,max:number,label:string){const n=Number(value);if(value===''||value==null||!Number.isFinite(n)||n<min||n>max)throw new Error(`${label}须在 ${min}～${max} 之间`);return n}
