/**
 * โมดูลจัดการการแจ้งเตือนและซิงค์ข้อมูล Real-time ข้ามแท็บและคอมโพเนนต์ (BroadcastChannel + CustomEvent)
 */

let channel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
  try {
    channel = new BroadcastChannel('utcc_sports_sync_channel');
  } catch {
    channel = null;
  }
}

// แจ้งเตือนทุกแท็บและคอมโพเนนต์ว่ามีการเปลี่ยนแปลงข้อมูลการยืม-คืน
export function notifyBorrowUpdated(): void {
  if (typeof window === 'undefined') return;

  // 1. แจ้งเตือนคอมโพเนนต์ภายในแท็บเดียวกัน
  window.dispatchEvent(new Event('utcc-borrow-updated'));

  // 2. แจ้งเตือนข้ามแท็บในเบราว์เซอร์เดียวกันผ่าน BroadcastChannel
  try {
    channel?.postMessage({ type: 'BORROW_UPDATED', timestamp: Date.now() });
  } catch {
    // ignore
  }
}

// ติดตั้ง Listener เพื่อรอรับการแจ้งเตือน Real-time เมื่อมีข้อมูลอัปเดต
export function subscribeBorrowUpdated(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleCustomEvent = () => {
    callback();
  };

  const handleMessage = (event: MessageEvent) => {
    if (event.data?.type === 'BORROW_UPDATED') {
      callback();
    }
  };

  // รับอีเวนต์ภายในแท็บเดียวกัน
  window.addEventListener('utcc-borrow-updated', handleCustomEvent);

  // รับข้อความจากแท็บอื่น (เช่น แท็บแอดมินสแกน QR หรือนักศึกษากดคืน)
  channel?.addEventListener('message', handleMessage);

  // รับการกลับมาโฟกัสแท็บ (Tab Switch / Window Focus) เพื่อรีเฟรชข้อมูลล่าสุด
  window.addEventListener('focus', handleCustomEvent);

  return () => {
    window.removeEventListener('utcc-borrow-updated', handleCustomEvent);
    channel?.removeEventListener('message', handleMessage);
    window.removeEventListener('focus', handleCustomEvent);
  };
}
