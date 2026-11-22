/**
 * หน้าต่างสแกน QR Code ของเจ้าหน้าที่ (รองรับเปิดกล้องสด, อัปโหลดรูป QR, กดเลือกคิว และกรอกรหัส)
 */
import { useState, useEffect, useRef, useCallback, type ChangeEvent } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Html5Qrcode } from 'html5-qrcode';
import {
  QrCode,
  X,
  CheckCircle2,
  Camera,
  Keyboard,
  Loader2,
  AlertCircle,
  RefreshCw,
  Upload,
} from 'lucide-react';
import { listBorrows, verifyScan, type BorrowItem } from '../../../services/borrowService';
import { notifyBorrowUpdated } from '../../../utils/realtime';

interface ScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type ScanTab = 'camera' | 'manual';

const QR_READER_ID = 'utcc-qr-reader';
const QR_FILE_READER_ID = 'utcc-qr-file-reader';

// ดึงข้อความ Error จาก Axios Response หรือใช้ข้อความเริ่มต้น
function getErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError<{ message?: string }>(err)) {
    return err.response?.data?.message || fallback;
  }
  return fallback;
}

// คอมโพเนนต์ Modal สแกนรับ-คืนอุปกรณ์สำหรับเจ้าหน้าที่
export default function ScannerModal({ isOpen, onClose, onSuccess }: ScannerModalProps) {
  const [activeTab, setActiveTab] = useState<ScanTab>('camera');
  const [scanCode, setScanCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeQueue, setActiveQueue] = useState<BorrowItem[]>([]);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isProcessingRef = useRef(false);

  // หยุดการทำงานของกล้องและล้าง Instance เครื่องสแกน QR
  const stopCamera = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (!scanner) return;

    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }
      scanner.clear();
    } catch {
      // ignore cleanup errors when camera wasn't fully started
    }
  }, []);

  // ส่งรหัส QR Token หรือรหัสนักศึกษาไปตรวจสอบและบันทึกการรับ/คืนอุปกรณ์
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
        setSuccessMessage(
          `${result.message} (${result.borrow.userName} - ${result.borrow.studentId})`
        );
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

  // โหลดรายการคิวที่รอรับของ / กำลังยืม สำหรับคลิกยืนยันได้ทันทีในแท็บกรอก/เลือก
  useEffect(() => {
    if (!isOpen || successMessage) return;

    let active = true;
    listBorrows()
      .then((data) => {
        if (active) {
          setActiveQueue(data.filter((b) => b.statusType !== 'returned'));
        }
      })
      .catch(() => {
        // ignore queue fetch failure
      });

    return () => {
      active = false;
    };
  }, [isOpen, successMessage]);

  // เปิด-ปิดกล้องจริงเมื่ออยู่ในแท็บ camera
  useEffect(() => {
    if (!isOpen || activeTab !== 'camera' || successMessage) {
      void stopCamera();
      return;
    }

    let cancelled = false;
    isProcessingRef.current = false;

    const startCamera = async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
      if (cancelled) return;

      const element = document.getElementById(QR_READER_ID);
      if (!element) return;

      try {
        setCameraError(null);
        const scanner = new Html5Qrcode(QR_READER_ID);
        scannerRef.current = scanner;

        const config = { fps: 10, qrbox: { width: 210, height: 210 } };
        const onDecoded = (decodedText: string) => {
          if (!isProcessingRef.current && !cancelled) {
            void submitToken(decodedText);
          }
        };

        try {
          await scanner.start({ facingMode: 'environment' }, config, onDecoded, () => {});
        } catch {
          const cameras = await Html5Qrcode.getCameras();
          if (cancelled) {
            await stopCamera();
            return;
          }
          if (cameras.length === 0) {
            throw new Error('NO_CAMERA');
          }
          await scanner.start(cameras[0].id, config, onDecoded, () => {});
        }

        if (cancelled) {
          await stopCamera();
        }
      } catch {
        if (!cancelled) {
          setCameraError(
            'ไม่สามารถเปิดกล้องได้ (มือถือ/เครื่องอื่นต้องใช้ HTTPS) สามารถอัปโหลดรูปภาพ QR หรือกดยืนยันจากรายชื่อได้ทันที'
          );
        }
      }
    };

    void startCamera();

    return () => {
      cancelled = true;
      void stopCamera();
    };
  }, [isOpen, activeTab, successMessage, stopCamera, submitToken]);

  // อ่าน QR Code จากไฟล์รูปภาพที่อัปโหลดแล้วส่งตรวจสอบ
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

  // ส่งรหัสหรือ Token ที่กรอกด้วยมือไปตรวจสอบรับ-คืน
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanCode.trim() || isSubmitting) return;
    isProcessingRef.current = false;
    void submitToken(scanCode);
  };

  // กดยืนยันรับของหรือรับคืนทันทีจากรายการคิวที่แสดงอยู่
  const handleQuickAction = (borrowId: number) => {
    if (isSubmitting) return;
    isProcessingRef.current = false;
    void submitToken(String(borrowId));
  };

  // ล้างข้อความผิดพลาดเพื่ออนุญาตให้สแกนใหม่อีกครั้ง
  const handleRetryScan = () => {
    setScanError(null);
    isProcessingRef.current = false;
  };

  // สลับแท็บระหว่างโหมดกล้องกับโหมดเลือกคิว/กรอกรหัส
  const handleTabChange = (tab: ScanTab) => {
    setScanError(null);
    isProcessingRef.current = false;
    setActiveTab(tab);
  };

  // ปิดกล้อง ล้างสถานะทั้งหมด แล้วปิดหน้าต่าง Modal
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
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => void handleFileUpload(e)}
              className="hidden"
            />

            <button
              onClick={handleClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 cursor-pointer"
              aria-label="ปิดหน้าต่าง"
            >
              <X size={18} />
            </button>

            {successMessage ? (
              <div className="text-center py-4">
                <div className="bg-emerald-100 text-emerald-600 p-3 rounded-full w-14 h-14 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 size={28} />
                </div>
                <h2 className="text-lg font-black text-emerald-950 mb-1">ทำรายการสำเร็จ!</h2>
                <p className="text-xs text-gray-600 mb-5 leading-relaxed">{successMessage}</p>
                <button
                  onClick={handleClose}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs cursor-pointer shadow-md"
                >
                  เสร็จสิ้น / ปิดหน้าต่าง
                </button>
              </div>
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

                {/* แท็บสลับระหว่างกล้องและเลือกรายการ/กรอกรหัส */}
                <div className="grid grid-cols-2 gap-1.5 bg-gray-100 p-1 rounded-xl mb-4">
                  <button
                    type="button"
                    onClick={() => handleTabChange('camera')}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      activeTab === 'camera'
                        ? 'bg-white text-emerald-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    <Camera size={14} /> สแกน / รูปภาพ QR
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTabChange('manual')}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      activeTab === 'manual'
                        ? 'bg-white text-emerald-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    <Keyboard size={14} /> เลือกคิว / กรอกรหัส
                  </button>
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
                        onClick={handleRetryScan}
                        className="shrink-0 text-red-700 hover:text-red-900 underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw size={12} /> สแกนใหม่
                      </button>
                    )}
                  </div>
                )}

                {activeTab === 'camera' ? (
                  <div>
                    {cameraError ? (
                      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center mb-3">
                        <Camera size={32} className="text-amber-600 mx-auto mb-2" />
                        <p className="text-xs font-bold text-amber-900 mb-3 leading-relaxed">
                          {cameraError}
                        </p>
                        <div className="flex flex-col sm:flex-row gap-2 justify-center">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="bg-white border border-amber-300 text-amber-900 font-bold px-3.5 py-2 rounded-xl text-xs cursor-pointer inline-flex items-center justify-center gap-1.5"
                          >
                            <Upload size={14} /> อัปโหลดรูป QR
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTabChange('manual')}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-xs cursor-pointer"
                          >
                            คลิกยืนยันจากรายชื่อ
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="relative rounded-2xl overflow-hidden bg-gray-900 mb-3 min-h-[240px]">
                        <div id={QR_READER_ID} className="w-full" />
                        {isSubmitting && (
                          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white">
                            <Loader2 size={28} className="animate-spin mb-2" />
                            <p className="text-xs font-bold">กำลังตรวจสอบรหัส...</p>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isSubmitting}
                        className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 font-bold px-3.5 py-2 rounded-xl text-xs cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <Upload size={14} /> อัปโหลดภาพ QR
                      </button>
                      <button
                        type="button"
                        onClick={handleClose}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold px-4 py-2 rounded-xl text-xs cursor-pointer"
                      >
                        ปิดหน้าต่าง
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* รายการคิวที่คลิกอนุมัติ/รับคืนได้ทันที */}
                    {activeQueue.length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-emerald-950 mb-2">
                          รายการที่รอรับของ / กำลังยืม (คลิกเพื่อยืนยันทันที)
                        </p>
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                          {activeQueue.map((item) => {
                            const isPending = item.statusType === 'pending';
                            return (
                              <button
                                key={item.id}
                                type="button"
                                disabled={isSubmitting}
                                onClick={() => handleQuickAction(item.id)}
                                className="w-full text-left bg-white/85 hover:bg-emerald-50 border border-white rounded-2xl p-3 shadow-sm transition-all flex items-center justify-between gap-2 cursor-pointer disabled:opacity-50"
                              >
                                <div className="min-w-0">
                                  <p className="text-xs font-black text-slate-900 truncate">
                                    REQ-{String(item.id).padStart(4, '0')} • {item.equipment} ({item.qty})
                                  </p>
                                  {item.itemCodes && item.itemCodes.length > 0 && (
                                    <p className="font-mono text-[10px] font-bold text-emerald-800 truncate">
                                      รหัสชิ้น: {item.itemCodes.join(', ')}
                                    </p>
                                  )}
                                  <p className="text-[11px] text-slate-500 truncate">
                                    {item.userName} ({item.studentId})
                                  </p>
                                </div>
                                <span
                                  className={`shrink-0 px-2.5 py-1 rounded-xl text-[10px] font-black text-white ${
                                    isPending ? 'bg-indigo-600' : 'bg-emerald-600'
                                  }`}
                                >
                                  {isPending ? 'ยืนยันรับของ' : 'รับคืน'}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <form onSubmit={handleManualSubmit} className="pt-2 border-t border-gray-200/70">
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        หรือกรอกรหัสนักศึกษา / รหัสคำขอ (Token)
                      </label>
                      <input
                        type="text"
                        placeholder="เช่น 2410511101055, REQ-0001 หรือ UTCC-PASS:..."
                        value={scanCode}
                        onChange={(e) => setScanCode(e.target.value)}
                        disabled={isSubmitting}
                        className="w-full bg-white/85 border border-gray-200 rounded-xl px-3 py-2.5 text-xs focus:ring-2 focus:ring-emerald-500 mb-3 outline-none"
                        required
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={handleClose}
                          disabled={isSubmitting}
                          className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold px-4 py-2 rounded-xl text-xs cursor-pointer"
                        >
                          ยกเลิก
                        </button>
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-xl text-xs cursor-pointer shadow-md inline-flex items-center gap-1.5"
                        >
                          {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                          ยืนยันรับ / คืนอุปกรณ์
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
