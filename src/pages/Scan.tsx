import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/layout/TopBar';
import { useSkinScan } from '@/hooks/useSkinScan';
import { useAppStore } from '@/store/useAppStore';
import { MedicalDisclaimer } from '@/components/ui/MedicalDisclaimer';

function resizeThumb(src: string, size: number): Promise<string | undefined> { return new Promise((resolve)=>{ const img=new Image(); img.onload=()=>{const c=document.createElement('canvas'); c.width=size;c.height=size;const ctx=c.getContext('2d');if(!ctx)return resolve();const s=Math.min(img.naturalWidth,img.naturalHeight);ctx.drawImage(img,(img.naturalWidth-s)/2,(img.naturalHeight-s)/2,s,s,0,0,size,size);resolve(c.toDataURL('image/jpeg',0.6));};img.onerror=()=>resolve();img.src=src;}); }
const GUIDES=['چهره را داخل بیضی نگه دارید','نور یکنواخت و بدون فیلتر باشد','مستقیم رو به دوربین نگاه کنید','عینک آفتابی/ماسک/مو روی صورت نباشد'];

export default function Scan() {
  const navigate=useNavigate(); const fileRef=useRef<HTMLInputElement>(null); const videoRef=useRef<HTMLVideoElement>(null); const streamRef=useRef<MediaStream|null>(null);
  const [preview,setPreview]=useState<string|null>(null); const [cameraOpen,setCameraOpen]=useState(false); const [cameraError,setCameraError]=useState('');
  const {quality,checking,checkImage}=useSkinScan(); const consent=useAppStore(s=>s.faceDataConsent);
  const [startingMode,setStartingMode]=useState<'normal'|'gemini'|null>(null);
  useEffect(()=>{if(!consent)navigate('/consent',{replace:true}); return()=>{streamRef.current?.getTracks().forEach(t=>t.stop());};},[consent,navigate]);
  const openCamera=async()=>{setCameraError(''); try{if(!navigator.mediaDevices?.getUserMedia)throw new Error('دوربین این مرورگر در دسترس نیست.'); const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:1080},height:{ideal:1080}},audio:false}); streamRef.current=stream; if(videoRef.current){videoRef.current.srcObject=stream; await videoRef.current.play();} setCameraOpen(true);}catch(e){setCameraError(e instanceof Error?e.message:'دسترسی به دوربین انجام نشد.');}};
  const capture=async()=>{const video=videoRef.current;if(!video)return; const c=document.createElement('canvas'); c.width=video.videoWidth;c.height=video.videoHeight; c.getContext('2d')?.drawImage(video,0,0,c.width,c.height); const data=c.toDataURL('image/jpeg',0.92); setPreview(data); setCameraOpen(false); streamRef.current?.getTracks().forEach(t=>t.stop()); await checkImage(data);};
  const onFile=(e:React.ChangeEvent<HTMLInputElement>)=>{const file=e.target.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=async ev=>{const data=ev.target?.result as string;setPreview(data);await checkImage(data);};reader.readAsDataURL(file);};
  const submit=async(mode:'normal'|'gemini')=>{if(!preview||checking||startingMode)return;const thumb=await resizeThumb(preview,160);setStartingMode(mode);navigate('/analyzing',{state:{imageDataUrl:preview,thumb,mode}});};
  return <div className="flex flex-col min-h-[calc(100vh-140px)]"><TopBar eyebrow="مرحله اسکن"/><h1 className="text-[22px] font-extrabold text-sageDeep">یک عکس واضح و روبه‌رو از صورتتان بگیرید</h1>
    <div className="grid grid-cols-2 gap-2 my-4">{GUIDES.map(g=><div key={g} className="bg-white border border-line rounded-md p-3 text-xs leading-6"><b className="text-sageDeep">✓</b> {g}</div>)}</div>
    {cameraOpen ? <div className="relative rounded-2xl overflow-hidden bg-black aspect-square"><video ref={videoRef} playsInline muted className="w-full h-full object-cover scale-x-[-1]"/><div className="absolute inset-[10%] rounded-[50%] border-4 border-white/80 shadow-[0_0_0_999px_rgba(0,0,0,.28)] pointer-events-none"/><div className="absolute bottom-4 left-0 right-0 flex justify-center"><button onClick={capture} className="w-16 h-16 rounded-full bg-white border-4 border-sageSoft shadow-lg" aria-label="گرفتن عکس"/></div></div>
    : preview ? <div className="relative rounded-2xl overflow-hidden aspect-square bg-white"><img src={preview} className="w-full h-full object-cover"/><button onClick={openCamera} className="absolute bottom-3 left-3 bg-white/95 rounded-full px-4 py-2 text-xs font-bold">دوباره عکس بگیر</button></div>
    : <div onClick={openCamera} className="border-2 border-dashed border-sageSoft rounded-2xl bg-white aspect-square flex flex-col items-center justify-center gap-3 cursor-pointer"><div className="w-16 h-16 rounded-full bg-sageMist flex items-center justify-center text-3xl">📷</div><div className="font-bold text-sm text-ink">باز کردن دوربین</div><div className="text-xs text-stone">یا فایل تصویر را انتخاب کنید</div></div>}
    <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onFile}/>
    <button onClick={()=>fileRef.current?.click()} className="text-sm font-bold text-sage mt-3">انتخاب عکس از گالری</button>
    {(checking||quality||cameraError)&&<div className={`rounded-md p-3.5 mt-3.5 text-sm leading-7 ${checking?'bg-sageMist text-sageDeep':quality?.ok?'bg-sageMist text-sageDeep':'bg-[#FBEEE9] text-coral'}`}>{checking?'در حال بررسی چهره، نور و کیفیت تصویر...':quality?.ok?'✓ عکس برای تحلیل مناسب است':cameraError||quality?.issues.map(i=>i.message).join(' · ')}</div>}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
      <button onClick={()=>submit('gemini')} disabled={!preview||checking||!!startingMode} className="rounded-2xl px-4 py-4 bg-sageDeep text-white font-extrabold text-sm disabled:opacity-50">
        <span className="block text-base">✦ شروع تحلیل دقیق</span><span className="block text-xs font-medium opacity-80 mt-1">تحلیل چندبعدی با Gemini</span>
      </button>
      <button onClick={()=>submit('normal')} disabled={!preview||checking||!!startingMode} className="rounded-2xl px-4 py-4 bg-white border border-line text-sageDeep font-extrabold text-sm disabled:opacity-50">
        <span className="block text-base">◉ شروع تحلیل معمولی</span><span className="block text-xs font-medium text-stone mt-1">با مدل‌های محلی پروژه</span>
      </button>
    </div><MedicalDisclaimer/>
  </div>;
}
