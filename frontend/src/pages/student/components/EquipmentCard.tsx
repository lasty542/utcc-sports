/**
 * การ์ดแสดงรายการอุปกรณ์กีฬาในหน้า Student Dashboard
 */
import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import type { EquipmentItem } from '../../../services/equipService';
import { dashboardStyles as styles } from '../Dashboard.styles';

const DEFAULT_SPORT_IMAGES: Record<string, string> = {
  ฟุตบอล: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?q=80&w=600&auto=format&fit=crop',
  บาสเกตบอล: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?q=80&w=600&auto=format&fit=crop',
  วอลเลย์บอล: 'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?q=80&w=600&auto=format&fit=crop',
  แบดมินตัน: 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?q=80&w=600&auto=format&fit=crop',
  เทเบิลเทนนิส: 'https://images.unsplash.com/photo-1534158914592-062992fbe900?q=80&w=600&auto=format&fit=crop',
};

function resolveImage(item: EquipmentItem): string {
  if (item.image && (item.image.startsWith('http://') || item.image.startsWith('https://'))) {
    return item.image;
  }
  const cat = item.category ? item.category.trim() : '';
  if (DEFAULT_SPORT_IMAGES[cat]) {
    return DEFAULT_SPORT_IMAGES[cat];
  }
  return 'https://images.unsplash.com/photo-1517649763962-0c623266ddc0?q=80&w=600&auto=format&fit=crop';
}

function getStockIndicator(available: number) {
  if (available <= 0) {
    return {
      label: 'หมดชั่วคราว',
      badgeClass: 'bg-red-500/90 text-white',
      dotClass: 'bg-white',
      barClass: 'bg-red-500',
    };
  }
  if (available <= 2) {
    return {
      label: 'เหลือน้อย',
      badgeClass: 'bg-amber-400 text-slate-900',
      dotClass: 'bg-slate-900',
      barClass: 'bg-amber-400',
    };
  }
  return {
    label: 'พร้อมยืม',
    badgeClass: 'bg-emerald-600 text-white',
    dotClass: 'bg-white',
    barClass: 'bg-emerald-500',
  };
}

interface EquipmentCardProps {
  item: EquipmentItem;
  index: number;
  onSelect: (item: EquipmentItem) => void;
}

export default function EquipmentCard({ item, index, onSelect }: EquipmentCardProps) {
  const total = Math.max(1, item.total);
  const available = Math.max(0, item.available);
  const percent = Math.min(100, Math.round((available / total) * 100));
  const stock = getStockIndicator(available);
  const equipCode = `EQ-${String(item.id).padStart(4, '0')}`;

  return (
    <motion.div
      onClick={() => available > 0 && onSelect(item)}
      className={styles.equipmentCard}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.05, 0.25) }}
    >
      <div className={styles.equipmentImageWrapper}>
        <div className="w-full flex items-center justify-between gap-1.5 mb-2 z-20">
          <span className="font-mono text-[9px] sm:text-[10px] font-black tracking-wider bg-slate-900/85 text-white px-2 py-0.5 rounded-full">
            {equipCode}
          </span>
          <span
            className={`inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full shadow-xs whitespace-nowrap ${stock.badgeClass}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${stock.dotClass}`} />
            คงเหลือ {available}/{item.total}
          </span>
        </div>

        <div className="w-full h-28 sm:h-32 md:h-36 relative flex items-center justify-center z-10 overflow-hidden rounded-xl sm:rounded-2xl bg-slate-100 border border-white/70 shadow-inner">
          <img
            src={resolveImage(item)}
            alt={item.name}
            className={`w-full h-full object-cover transform transition-transform duration-300 hover:scale-105 ${
              available <= 0 ? 'grayscale opacity-55' : ''
            }`}
          />
        </div>

        <h3 className="text-xs sm:text-sm font-black text-white text-center mt-2.5 leading-snug w-full min-h-[34px] sm:min-h-[40px] flex items-center justify-center px-1 z-10">
          {item.name}
        </h3>

        <div className="w-full mt-2 space-y-1.5 z-10">
          <div className="flex items-center justify-between text-[9px] sm:text-[10px]">
            <span className="bg-emerald-950/90 text-emerald-300 border border-emerald-500/30 font-black px-2 py-0.5 rounded-full uppercase">
              {item.category || 'อื่นๆ'}
            </span>
            <span className="font-bold text-emerald-200">{stock.label}</span>
          </div>

          <div className="w-full h-1 bg-black/40 rounded-full overflow-hidden border border-emerald-500/20">
            <div
              className={`h-full rounded-full transition-all duration-300 ${stock.barClass}`}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </div>

      <div className={styles.equipmentContent}>
        <button
          type="button"
          disabled={available <= 0}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(item);
          }}
          className={`w-full font-bold py-2 sm:py-2.5 px-3 rounded-xl sm:rounded-2xl transition-all shadow-md flex items-center justify-center gap-1 text-[11px] sm:text-xs cursor-pointer ${
            available <= 0
              ? 'bg-emerald-950/80 text-emerald-500/50 cursor-not-allowed border border-emerald-900/50'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg'
          }`}
        >
          {available <= 0 ? (
            'อุปกรณ์หมด'
          ) : (
            <>
              ขอยืมอุปกรณ์นี้ <ArrowUpRight size={13} />
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}
