import type { InteractionWarning } from '@/types';

/** Fallback for the `product_interactions` table. */
export const INTERACTION_RULES: InteractionWarning[] = [
  { pair: ['retinol', 'aha'], message: 'ترکیب رتینول و AHA می‌تواند پوست را تحریک کند؛ در شب‌های جداگانه استفاده شود.' },
  { pair: ['retinol', 'bha'], message: 'ترکیب رتینول و BHA می‌تواند پوست را تحریک کند؛ در شب‌های جداگانه استفاده شود.' },
  { pair: ['aha', 'bha'], message: 'استفاده هم‌زمان از AHA و BHA می‌تواند لایه‌برداری بیش از حد ایجاد کند؛ در روزهای متفاوت استفاده شود.' },
  { pair: ['retinol', 'vitamin_c'], message: 'رتینول و ویتامین C بهتر است در بازه‌های زمانی متفاوت (صبح/شب) استفاده شوند.' },
];
