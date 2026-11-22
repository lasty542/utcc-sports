/**
 * หน้าต่างสแกน QR Code ของเจ้าหน้าที่ (รองรับเปิดกล้องสด, อัปโหลดรูป QR, กดเลือกคิว และกรอกรหัส)
 */
import { useState, useEffect, useRef, useCallback, type ChangeEvent, type FormEvent } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Html5Qrcode } from 'html5-qrcode';
import { QrCode, X, Camera, Keyboard, AlertCircle, RefreshCw } from 'lucide-react';
import { listBorrows, verifyScan, type BorrowItem } from '../../../services/borrowService';
import { notifyBorrowUpdated } from '../../../utils/realtime';
import ScannerCameraView from './ScannerCameraView';
import ScannerQueueView from './ScannerQueueView';
import ScannerSuccessView from './ScannerSuccessView';

interface ScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type ScanTab = 'camera' | 'manual';

const QR_READER_ID = 'utcc-qr-reader';
const QR_FILE_READER_ID = 'utcc-qr-file-reader';

const getErrorMessage = (err: unknown, fb: string) =>
  axios.isAxiosError<{ message?: string; error?: string }>(err)
    ? err.response?.data?.message || err.response?.data?.error || fb
    : err instanceof Error ? err.message : fb;

export default function ScannerModal({ isOpen, onClose, onSuccess }: ScannerModalProps) {
  const [activeTab, setActiveTab] = useState<ScanTab>('camera');
  const [scanCode, setScanCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeQueue, setActiveQueue] = useState<BorrowItem[]>([]);
  const [retryCount, setRetryCount] = useState(0);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isProcessingRef = useRef(false);

  const stopCamera = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (!scanner) return;
    try {
      if (scanner.isScanning) await scanner.stop();
      scanner.clear();
    } catch { /* ignore */ }
  }, []);

  const submitToken = useCallback(
    async (rawToken: string) => {
      const token = rawToken.trim();
      if (!token || isProcessingRef.current) return;

      isProcessingRef.current = true;
      setIsSubmitting(true);
      setScanError(null);

      try {
        const result = await verifyScan(token);
        await stopCamera();
        setSuccessMessage(`${result.message} (${result.borrow.userName} - ${result.borrow.studentId})`);
        setScanCode('');
        onSuccess();
        notifyBorrowUpdated();
      } catch (err) {
        setScanError(getErrorMessage(err, 'ไม่พบรายการยืมที่รอรับของหรือยังไม่ได้คืนสำหรับรหัสนี้'));
      } finally {
        setIsSubmitting(false);
      }
    },
    [onSuccess, stopCamera]
  );

  useEffect(() => {
    if (!isOpen || successMessage) return;
    let active = true;
    listBorrows()
      .then((data) => {
        if (active) setActiveQueue(data.filter((b) => b.statusType !== 'returned'));
      })
      .catch(() => {});
    return () => { active = false; };
  }, [isOpen, successMessage]);

  useEffect(() => {
    if (!isOpen || activeTab !== 'camera' || successMessage) {
      void stopCamera();
      return;
    }

    let cancelled = false;
    isProcessingRef.current = false;

    const startCamera = async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
      if (cancelled) return;

      const element = document.getElementById(QR_READER_ID);
      if (!element) return;

      try {
        setCameraError(null);
        let cameras: Array<{ id: string; label: string }> = [];
        try {
          cameras = await Html5Qrcode.getCameras();
        } catch { /* ignore permission prompt */ }

        if (cancelled) return;

        const scanner = new Html5Qrcode(QR_READER_ID);
        scannerRef.current = scanner;

        const config = { fps: 10, qrbox: { width: 210, height: 210 } };
        const onDecoded = (decodedText: string) => {
          if (!isProcessingRef.current && !cancelled) {
            void submitToken(decodedText);
          }
        };

        if (cameras && cameras.length > 0) {
          const backCam = cameras.find((c) => /back|rear|environment/i.test(c.label));
          const camId = backCam ? backCam.id : cameras[0].id;
          await scanner.start(camId, config, onDecoded, () => {});
        } else {
          try {
            await scanner.start({ facingMode: 'environment' }, config, onDecoded, () => {});
          } catch {
            await stopCamera();
            if (cancelled) return;
            const fallbackScanner = new Html5Qrcode(QR_READER_ID);
            scannerRef.current = fallbackScanner;
            await fallbackScanner.start({ facingMode: 'user' }, config, onDecoded, () => {});
          }
        }

        if (cancelled) {
          await stopCamera();
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const errName = err instanceof Error ? err.name : '';
          const errMsg = err instanceof Error ? err.message : String(err);
          let userMsg = 'ไม่สามารถเปิดกล้องได้';
          if (errName === 'NotAllowedError' || errMsg.includes('Permission')) {
            userMsg = 'เบราว์เซอร์ไม่ได้รับอนุญาตให้ใช้กล้อง กรุณากด "อนุญาต" (Allow) กล้องที่แถบ URL';
          } else if (errName === 'NotFoundError' || errMsg.includes('NO_CAMERA')) {
            userMsg = 'ไม่พบอุปกรณ์กล้อง สามารถอัปโหลดรูปภาพ QR หรือคลิกเลือกจากรายชื่อคิวได้ทันที';
          } else if (errName === 'NotReadableError') {
            userMsg = 'กล้องกำลังถูกใช้งานโดยโปรแกรมอื่นอยู่ กรุณาปิดโปรแกรมอื่นแล้วลองใหม่อีกครั้ง';
          } else {
            userMsg = `ไม่สามารถเปิดกล้องได้ (${errMsg || 'กรุณาตรวจสอบการอนุญาต'})`;
          }
          setCameraError(userMsg);
        }
      }
    };

    void startCamera();

    return () => {
      cancelled = true;
      void stopCamera();
    };
  }, [isOpen, activeTab, successMessage, retryCount, stopCamera, submitToken]);

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setScanError(null);
    isProcessingRef.current = false;
    try {
      const fileScanner = new Html5Qrcode(QR_FILE_READER_ID);
      const decoded = await fileScanner.scanFile(file, false);
      fileScanner.clear();
      await submitToken(decoded);
    } catch {
      setScanError('ไม่พบ QR Code ในรูปภาพที่เลือก กรุณาลองรูปอื่นหรือเลือกรายการจากรายชื่อ');
    }
  };

  const handleManualSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (scanCode.trim() && !isSubmitting) {
      isProcessingRef.current = false;
      void submitToken(scanCode);
    }
  };

  const handleQuickAction = (borrowId: number) => {
    if (!isSubmitting) {
      isProcessingRef.current = false;
      void submitToken(String(borrowId));
    }
  };

  const handleClose = () => {
    void stopCamera();
    setSuccessMessage(null);
    setScanError(null);
    setCameraError(null);
    setScanCode('');
    isProcessingRef.current = false;
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <motion.div
            className="bg-white/75 backdrop-blur-3xl backdrop-saturate-150 rounded-[2.2rem] p-6 max-w-md w-full shadow-[0_28px_70px_rgba(15,23,42,0.28)] border border-white/80 ring-1 ring-white/50 relative max-h-[92vh] overflow-y-auto"
            initial={{ scale: 0.92, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 12 }}
          >
            <div id={QR_FILE_READER_ID} className="hidden" />
            <input ref={fileInputRef} type="file" accept="image/*" onChange={(e) => void handleFileUpload(e)} className="hidden" />
            <button onClick={handleClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 cursor-pointer" aria-label="ปิดหน้าต่าง">
              <X size={18} />
            </button>

            {successMessage ? (
              <ScannerSuccessView message={successMessage} onClose={handleClose} />
            ) : (
              <div>
                <div className="text-center mb-4">
                  <div className="bg-emerald-100 text-emerald-800 p-3 rounded-2xl w-12 h-12 flex items-center justify-center mx-auto mb-2">
                    <QrCode size={24} />
                  </div>
                  <h2 className="text-base font-black text-emerald-950">ระบบสแกนรับ-คืนอุปกรณ์</h2>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    สแกนกล้อง, อัปโหลดรูป QR หรือคลิกเลือกรายการนักศึกษาได้ทันที
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-1.5 bg-gray-100 p-1 rounded-xl mb-4">
                  {(['camera', 'manual'] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => { setScanError(null); setActiveTab(tab); }}
                      className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        activeTab === tab ? 'bg-white text-emerald-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                      }`}
                    >
                      {tab === 'camera' ? <Camera size={14} /> : <Keyboard size={14} />}
                      {tab === 'camera' ? 'สแกน / รูปภาพ QR' : 'เลือกคิว / กรอกรหัส'}
                    </button>
                  ))}
                </div>

                {scanError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-bold px-3 py-2.5 rounded-xl mb-3 flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <AlertCircle size={15} className="shrink-0 mt-0.5" />
                      <span>{scanError}</span>
                    </div>
                    {activeTab === 'camera' && (
                      <button
                        type="button"
                        onClick={() => { setScanError(null); isProcessingRef.current = false; }}
                        className="shrink-0 text-red-700 hover:text-red-900 underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw size={12} /> สแกนใหม่
                      </button>
                    )}
                  </div>
                )}

                {activeTab === 'camera' ? (
                  <ScannerCameraView
                    cameraError={cameraError} isSubmitting={isSubmitting} qrReaderId={QR_READER_ID} fileInputRef={fileInputRef}
                    onSwitchToManual={() => { setScanError(null); setActiveTab('manual'); }}
                    onRetryCamera={() => { setCameraError(null); setRetryCount((c) => c + 1); }}
                    onClose={handleClose}
                  />
                ) : (
                  <ScannerQueueView
                    activeQueue={activeQueue} isSubmitting={isSubmitting} scanCode={scanCode} setScanCode={setScanCode}
                    onQuickAction={handleQuickAction} onManualSubmit={handleManualSubmit} onClose={handleClose}
                  />
                )}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
