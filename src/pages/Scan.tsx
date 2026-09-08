import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/layout/TopBar';
import { Button } from '@/components/ui/Button';
import { MedicalDisclaimer } from '@/components/ui/MedicalDisclaimer';
import { useSkinScan } from '@/hooks/useSkinScan';
import { useAppStore } from '@/store/useAppStore';

const GUIDES = ['نور کافی و یکنواخت', 'صورت مستقیم رو‌به‌دوربین', 'بدون آرایش غلیظ/عینک', 'فاصله حدود ۳۰ سانتی‌متر'];

function resizeThumb(src: string, size: number): Promise<string | undefined> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = size; c.height = size;
      const ctx = c.getContext('2d'); if (!ctx) return resolve(undefined);
      const s = Math.min(img.naturalWidth, img.naturalHeight);
      ctx.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, size, size);
      resolve(c.toDataURL('image/jpeg', 0.6));
    };
    img.onerror = () => resolve(undefined);
    img.src = src;
  });
}

export default function Scan() {
  const navigate = useNavigate();
  const consent = useAppStore((s) => s.faceDataConsent);
  const kioskPhone = useAppStore((s) => s.kioskPhone);
  const setKioskPhone = useAppStore((s) => s.setKioskPhone);
  const { quality, checking, checkImage } = useSkinScan();

  const [preview, setPreview] = useState<string | null>(null);
  const [phone, setPhone] = useState(kioskPhone || '');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null); // ALWAYS mounted below -- never conditionally rendered
  const streamRef = useRef<MediaStream | null>(null);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  useEffect(() => {
    if (!consent) navigate('/consent', { replace: true });
    return stopStream;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consent, navigate]);

  const cameraErrorMessage = (e: unknown): string => {
    const name = e instanceof DOMException ? e.name : '';
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') return 'اجازه‌ی دسترسی به دوربین داده نشد. از تنظیمات مرورگر (کنار نوار آدرس) دسترسی دوربین را فعال کنید.';
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return 'هیچ دوربینی روی این دستگاه پیدا نشد.';
    if (name === 'NotReadableError' || name === 'TrackStartError') return 'دوربین در دسترس نیست — احتمالاً برنامه‌ی دیگری (مثل Zoom/Teams یا یک تب دیگر) در حال استفاده از آن است.';
    if (name === 'OverconstrainedError') return 'دوربین این کیفیت را پشتیبانی نمی‌کند.';
    return e instanceof Error ? e.message : 'دسترسی به دوربین انجام نشد.';
  };

  const openCamera = async () => {
    setCameraError('');
    if (!window.isSecureContext) {
      setCameraError('دوربین روی HTTP شبکه محلی کار نمی‌کند (نیاز به HTTPS). از دکمه «انتخاب عکس از گالری» استفاده کنید.');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) { setCameraError('دوربین در این مرورگر پشتیبانی نمی‌شود.'); return; }
    stopStream();
    // Mount/show the <video> element FIRST so videoRef.current definitely
    // exists before we try to attach the stream to it (fixes a silent
    // no-op bug where the stream was assigned before the element existed).
    setCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1080 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try { await videoRef.current.play(); } catch { /* some browsers auto-play once metadata loads */ }
      }
    } catch (e) {
      setCameraError(cameraErrorMessage(e));
      setCameraOpen(false);
    }
  };

  const capture = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) { setCameraError('تصویر دوربین هنوز آماده نیست، یک لحظه صبر کنید و دوباره امتحان کنید.'); return; }
    const c = document.createElement('canvas'); c.width = video.videoWidth; c.height = video.videoHeight;
    c.getContext('2d')?.drawImage(video, 0, 0, c.width, c.height);
    const data = c.toDataURL('image/jpeg', 0.92);
    setPreview(data);
    setCameraOpen(false);
    stopStream();
    await checkImage(data);
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      setPreview(dataUrl);
      setCameraOpen(false);
      stopStream();
      await checkImage(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const submit = async (mode: 'accurate' | 'standard') => {
    if (!preview || checking) return;
    if (phone.trim()) setKioskPhone(phone.trim());
    const thumb = await resizeThumb(preview, 160);
    navigate('/analyzing', { state: { imageDataUrl: preview, thumb, mode } });
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-140px)]">
      <TopBar eyebrow="مرحله اسکن" />
      <h1 className="text-[22px] font-extrabold text-sageDeep">یک عکس واضح و روبه‌رو از صورتتان بگیرید</h1>

      <div className="mt-3 mb-1">
        <label className="text-[12.5px] font-bold text-sageDeep">موبایل (اختیاری — برای پیگیری پیشرفت)</label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="09xxxxxxxxx"
          className="w-full mt-1 border-[1.5px] border-line rounded-sm px-4 py-3 text-[15px] bg-white"
          dir="ltr"
          inputMode="tel"
        />
      </div>

      <div className="grid grid-cols-2 gap-2 my-4">
        {GUIDES.map((g) => (
          <div key={g} className="bg-white border border-line rounded-md p-3 text-xs leading-6"><b className="text-sageDeep">✓</b> {g}</div>
        ))}
      </div>

      <div className="relative rounded-2xl overflow-hidden aspect-square bg-black">
        {/* video is ALWAYS in the DOM so videoRef.current is never null when we need it */}
        <video
          ref={videoRef} playsInline muted autoPlay
          className={`w-full h-full object-cover scale-x-[-1] ${cameraOpen ? 'block' : 'hidden'}`}
        />
        {!cameraOpen && preview && <img src={preview} className="absolute inset-0 w-full h-full object-cover" />}
        {!cameraOpen && !preview && (
          <div onClick={openCamera} className="absolute inset-0 flex flex-col items-center justify-center gap-3 cursor-pointer bg-white">
            <div className="w-16 h-16 rounded-full bg-sageMist flex items-center justify-center text-3xl">📷</div>
            <div className="font-bold text-sm text-ink">باز کردن دوربین</div>
            <div className="text-xs text-stone">یا فایل تصویر را انتخاب کنید</div>
          </div>
        )}
        {cameraOpen && (
          <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-3">
            <button onClick={capture} className="w-16 h-16 rounded-full bg-white border-4 border-sageSoft shadow-lg" aria-label="گرفتن عکس" />
          </div>
        )}
        {!cameraOpen && preview && (
          <button onClick={openCamera} className="absolute bottom-3 left-3 bg-white/95 rounded-full px-4 py-2 text-xs font-bold">دوباره عکس بگیر</button>
        )}
      </div>

      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onFile} />
      <button onClick={() => fileRef.current?.click()} className="text-sm font-bold text-sage mt-3">انتخاب عکس از گالری</button>

      {(checking || quality || cameraError) && (
        <div className={`rounded-md p-3.5 mt-3.5 text-sm leading-7 ${checking ? 'bg-sageMist text-sageDeep' : quality?.ok ? 'bg-sageMist text-sageDeep' : 'bg-[#FBEEE9] text-coral'}`}>
          {checking ? 'در حال بررسی چهره، نور و کیفیت تصویر...' : quality?.ok ? '✓ عکس برای تحلیل مناسب است' : cameraError || quality?.issues.map((i) => i.message).join(' · ')}
        </div>
      )}

      <div className="mt-5 flex flex-col gap-2.5">
        <Button onClick={() => submit('accurate')} disabled={!preview || checking}>🎯 شروع تحلیل با دقت (Gemini)</Button>
        <Button onClick={() => submit('standard')} disabled={!preview || checking} variant="secondary">⚡ شروع تحلیل معمولی (مدل محلی)</Button>
      </div>
      <p className="text-[11.5px] text-stone leading-6 mt-2">
        «تحلیل با دقت» عکس شما را برای بررسی به سرویس هوش مصنوعی Gemini/OpenRouter می‌فرستد (دقت بالاتر). «تحلیل معمولی» کاملاً روی مدل‌های محلی همین پروژه انجام می‌شود و هیچ عکسی جایی ارسال نمی‌شود.
      </p>
      <MedicalDisclaimer />
    </div>
  );
}
