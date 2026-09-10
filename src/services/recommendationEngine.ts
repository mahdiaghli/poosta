import { MOCK_PRODUCTS } from '@/data/mockProducts';
import { interactionChecker } from './interactionChecker';
import type {
  Product, ProductCategory, ScoredProduct, SkinMetrics, SkinProfile,
  Routine, RoutineStep, RoutineVariant, OwnedProduct,
} from '@/types';
import { METRIC_LABELS_FA } from '@/types';

const BUDGET_MAX: Record<SkinProfile['budget'], number> = {
  under1m: 1_000_000, '1to2m': 2_000_000, '2to5m': 5_000_000, '5plus': Infinity,
};

export interface RoutineOptions {
  variant: RoutineVariant;
  budget: SkinProfile['budget'];
  useOnlyMyProducts: boolean;
  myProducts: OwnedProduct[];
}

const GOAL_TO_METRIC: Partial<Record<string, keyof SkinMetrics>> = {
  acne: 'acne', spots: 'darkSpots', redness: 'redness', oil: 'oiliness', hydration: 'hydration', texture: 'texture',
};

const SKIN_TYPE_LABELS_FA: Record<string, string> = { oily: 'چرب', dry: 'خشک', combination: 'مختلط', normal: 'نرمال' };

const PREGNANCY_UNSAFE_ACTIVES = ['retinol'];

/** Rank the lowest-scoring skin metrics first: lower score means greater need. */
const priorityMetrics = (metrics: SkinMetrics | null): (keyof SkinMetrics)[] => {
  const keys = Object.keys(METRIC_LABELS_FA) as (keyof SkinMetrics)[];
  return keys.sort((a, b) => (metrics ? metrics[a] : 65) - (metrics ? metrics[b] : 65));
};

const needLevel = (score: number): RoutineStep['importance'] =>
  score < 45 ? 'high' : score < 65 ? 'mid' : 'low';
// Strong actives are scheduled on alternating days rather than nightly, per dermatology best-practice (#10).
const STRONG_ACTIVE_WEEKDAYS = ['شنبه', 'دوشنبه', 'چهارشنبه'];
const RECOVERY_WEEKDAYS = ['یکشنبه', 'سه‌شنبه', 'پنجشنبه', 'جمعه'];

/**
 * recommendationEngine — pure functions, fully decoupled from the UI.
 * Turns scan metrics + profile (+ budget + owned products) into:
 *  - a scored, explained product list (compatibility)
 *  - a morning/night routine that never blindly combines conflicting actives
 */
export const recommendationEngine = {
  /** Product scoring uses scan metrics, profile, safety metadata, Iran availability and active conflicts. */
  compatibility(product: Product, metrics: SkinMetrics | null, profile: SkinProfile, existingActives: string[] = []): { score: number; reasons: string[]; negativeReasons: string[] } {
    let score = 45;
    const reasons: string[] = [];
    const negativeReasons: string[] = [];

    const unsafePregnancy = profile.isPregnantOrNursing && (
      product.activeIngredientKeys.some((k) => PREGNANCY_UNSAFE_ACTIVES.includes(k)) ||
      /avoid|unsafe|review/i.test(product.pregnancySafety ?? '')
    );
    if (unsafePregnancy) {
      negativeReasons.push('برای بارداری/شیردهی گزینه مناسبی نیست یا نیاز به تأیید متخصص دارد');
      return { score: 0, reasons, negativeReasons };
    }

    if (product.iranAvailability === 'available') { score += 7; reasons.push('قابل تهیه در بازار ایران'); }
    if (product.skinTypes.includes(profile.skinType ?? 'unknown')) { score += 18; reasons.push(`مناسب برای پوست ${SKIN_TYPE_LABELS_FA[profile.skinType ?? ''] ?? profile.skinType}`); }
    if (profile.sensitivities.includes('fragrance')) {
      if (product.fragranceFree === true) { score += 8; reasons.push('فاقد عطر'); }
      if (product.fragranceFree === false) { score -= 18; negativeReasons.push('دارای عطر؛ ممکن است با حساسیت شما سازگار نباشد'); }
    }
    if (profile.sensitivities.includes('acne_prone') && product.skinTypes.includes('oily')) score += 4;

    if (metrics) {
      const weak = (Object.keys(metrics) as (keyof SkinMetrics)[]).filter((k) => metrics[k] < 65);
      const mapped = product.concerns.filter((c) => weak.includes(c as keyof SkinMetrics));
      if (mapped.length) {
        score += Math.min(25, mapped.length * 8);
        reasons.push(`مرتبط با دغدغه‌های فعلی: ${mapped.map((c) => METRIC_LABELS_FA[c as keyof SkinMetrics]).join('، ')}`);
      }
    }
    if (profile.goals.length) {
      const goalMetrics = profile.goals.map((g) => GOAL_TO_METRIC[g]).filter(Boolean) as (keyof SkinMetrics)[];
      const matched = goalMetrics.filter((g) => product.concerns.includes(g));
      if (matched.length) { score += matched.length * 5; reasons.push('همسو با اهداف مراقبتی شما'); }
    }

    const conflicts = interactionChecker.check([...existingActives, ...product.activeIngredientKeys]);
    if (conflicts.length) {
      score -= conflicts.length * 18;
      conflicts.forEach((c) => negativeReasons.push(c.message));
    }

    const maxBudget = BUDGET_MAX[profile.budget] ?? Infinity;
    if (typeof product.price === 'number' && product.price > maxBudget) {
      score -= 10; negativeReasons.push('قیمت بالاتر از بودجه انتخابی شماست');
    }
    if (product.irritationLevel === 'high' || product.irritationLevel === 'high_moderate') {
      score -= 5;
      negativeReasons.push('ترکیب فعال/تحریک‌کننده قوی است و باید تدریجی استفاده شود');
    }
    if (!reasons.length) reasons.push('گزینه‌ای متعادل برای روتین روزانه');
    return { score: Math.max(0, Math.min(98, score)), reasons, negativeReasons };
  },

  recommendProducts(metrics: SkinMetrics | null, profile: SkinProfile, catalog: Product[] = MOCK_PRODUCTS, existingActives: string[] = []): ScoredProduct[] {
    return catalog
      .map((p) => ({ ...p, compatibility: this.compatibility(p, metrics, profile, existingActives) }))
      .filter((p) => p.compatibility.score > 0)
      .sort((a, b) => b.compatibility.score - a.compatibility.score);
  },

  pickProduct(
    category: ProductCategory, metrics: SkinMetrics | null, profile: SkinProfile,
    opts: RoutineOptions, catalog: Product[], exclude: string[] = [], targetMetrics: (keyof SkinMetrics)[] = []
  ): Product {
    let pool = catalog.filter((p) => p.category === category);
    if (profile.isPregnantOrNursing) {
      pool = pool.filter((p) => !p.activeIngredientKeys.some((k) => PREGNANCY_UNSAFE_ACTIVES.includes(k)));
    }

    if (opts.useOnlyMyProducts && opts.myProducts.length) {
      const mine = pool.filter((p) => opts.myProducts.some((mp) => mp.refId === p.id));
      if (mine.length) pool = mine;
    }

    const rank = (p: Product) => {
      const base = this.compatibility(p, metrics, profile).score;
      const targetedNeed = targetMetrics.reduce((total, metric) => {
        const score = metrics?.[metric] ?? 65;
        return total + (p.concerns.includes(metric) ? Math.max(0, 70 - score) * 0.55 : 0);
      }, 0);
      return base + targetedNeed;
    };

    if (opts.variant === 'budget') {
      const max = BUDGET_MAX[opts.budget] ?? Infinity;
      const inBudget = pool.filter((p) => typeof p.price === 'number' && p.price <= max);
      pool = (inBudget.length ? inBudget : pool).slice().sort((a, b) => {
        const priceDiff = (a.price ?? Number.POSITIVE_INFINITY) - (b.price ?? Number.POSITIVE_INFINITY);
        return priceDiff || rank(b) - rank(a);
      });
    } else {
      pool = pool
        .map((p) => ({ p, score: rank(p) }))
        .sort((a, b) => b.score - a.score)
        .map((x) => x.p);
    }

    pool = pool.filter((p) => !exclude.includes(p.id));
    return pool[0] ?? catalog.find((p) => p.category === category)!;
  },

  toStep(name: string, product: Product, reason: string, how: string, freq: string, imp: RoutineStep['importance'], suffix = '', schedule?: string[]): RoutineStep {
    return {
      name, productName: product.name + suffix, productId: product.id,
      reason, howToUse: how, frequency: freq, importance: imp,
      activeIngredientKeys: product.activeIngredientKeys, schedule,
    };
  },

  buildRoutine(metrics: SkinMetrics | null, profile: SkinProfile, opts: RoutineOptions, catalog: Product[] = MOCK_PRODUCTS): Routine {
    const suffix = opts.useOnlyMyProducts ? ' (از محصولات شما)' : '';
    const priorities = priorityMetrics(metrics);
    const primaryNeed = priorities[0] ?? 'hydration';
    const secondaryNeeds = priorities.slice(0, 3);
    const primaryScore = metrics?.[primaryNeed] ?? 65;

    if (opts.variant === 'minimal') {
      const cleanser = this.pickProduct('cleanser', metrics, profile, opts, catalog, [], secondaryNeeds);
      const moisturizer = this.pickProduct('moisturizer', metrics, profile, opts, catalog, [], ['hydration', ...secondaryNeeds]);
      const sunscreen = this.pickProduct('sunscreen', metrics, profile, opts, catalog);
      const morning: RoutineStep[] = [
        this.toStep('شست‌وشوی صورت', cleanser, 'پاکسازی پایه و ضروری', 'با آب ولرم', 'روزی ۱ بار', 'high', suffix),
        this.toStep('مرطوب‌کننده', moisturizer, 'حفظ رطوبت پوست', 'لایه نازک روی صورت', 'روزی ۱ بار', 'high', suffix),
        this.toStep('ضدآفتاب', sunscreen, 'محافظت ضروری در برابر آفتاب', 'دو انگشت، صبح‌ها', 'روزی ۱ بار', 'high', suffix),
      ];
      const night: RoutineStep[] = [
        this.toStep('شست‌وشوی صورت', cleanser, 'پاکسازی پایه و ضروری', 'با آب ولرم', 'روزی ۱ بار', 'high', suffix),
        this.toStep('مرطوب‌کننده', moisturizer, 'ترمیم پوست در طول شب', 'لایه نازک روی صورت', 'روزی ۱ بار', 'mid', suffix),
      ];
      return { morning, night, conflicts: [], variant: opts.variant, source: opts.useOnlyMyProducts ? 'own_products' : 'catalog' };
    }

    const mCleanser = this.pickProduct('cleanser', metrics, profile, opts, catalog, [], secondaryNeeds);
    const mSerum = this.pickProduct('serum', metrics, profile, opts, catalog, [], secondaryNeeds);
    const mMoist = this.pickProduct('moisturizer', metrics, profile, opts, catalog, [], ['hydration', ...secondaryNeeds]);
    const mSun = this.pickProduct('sunscreen', metrics, profile, opts, catalog);
    const nCleanser = this.pickProduct('cleanser', metrics, profile, opts, catalog, [mCleanser.id], secondaryNeeds) ?? mCleanser;
    const nTreat = this.pickProduct('treatment', metrics, profile, opts, catalog, [], secondaryNeeds);

    const morning: RoutineStep[] = [
      this.toStep('شست‌وشوی صورت', mCleanser, 'پاکسازی بدون از بین بردن رطوبت طبیعی پوست', 'با آب ولرم و حرکات دورانی', 'روزی ۱ بار', 'high', suffix),
      this.toStep('سرم', mSerum, primaryNeed === 'hydration' ? 'افزایش رطوبت و آبرسانی عمقی' : `تمرکز بر نیاز اصلی پوست (امتیاز ${primaryScore}/100)`, 'چند قطره روی پوست مرطوب', 'روزی ۱ بار', needLevel(primaryScore), suffix),
      this.toStep('مرطوب‌کننده', mMoist, 'حفظ رطوبت و تقویت سد پوستی', 'لایه نازک روی صورت و گردن', 'روزی ۱ بار', 'mid', suffix),
      this.toStep('ضدآفتاب', mSun, 'جلوگیری از تیرگی و آسیب نور خورشید', 'دو انگشت، ۱۵ دقیقه قبل از خروج', 'روزی ۱ بار و تجدید هر ۳ ساعت', 'high', suffix),
    ];
    const night: RoutineStep[] = [
      this.toStep('شست‌وشوی صورت', nCleanser, 'حذف آلودگی و باقی‌مانده ضدآفتاب', 'با آب ولرم', 'روزی ۱ بار', 'high', suffix),
      this.toStep('درمانی', nTreat, `درمان نیاز اصلی پوست (امتیاز ${primaryScore}/100)`, 'به آرامی روی پوست خشک', 'شب‌ها، ۲ تا ۳ بار در هفته', needLevel(primaryScore), suffix,
        nTreat.activeIngredientKeys.some((k) => ['retinol', 'aha', 'bha'].includes(k)) ? STRONG_ACTIVE_WEEKDAYS : undefined),
      this.toStep('مرطوب‌کننده', mMoist, 'ترمیم و بازسازی پوست در طول شب', 'لایه نازک روی صورت', 'روزی ۱ بار', 'mid', suffix),
    ];

    // AM/PM-aware: only actives combined within the SAME session (all-morning
    // or all-night) can truly conflict; e.g. AM vitamin C + PM retinol is a
    // standard, safe split and should not be flagged (#8).
    const morningActives = morning.flatMap((s) => s.activeIngredientKeys);
    const nightActives = night.flatMap((s) => s.activeIngredientKeys);
    const conflicts = [...interactionChecker.check(morningActives), ...interactionChecker.check(nightActives)];
    return { morning, night, conflicts, variant: opts.variant, source: opts.useOnlyMyProducts ? 'own_products' : 'catalog' };
  },

  /** Build a routine using ONLY items the user already owns ("My Products"). */
  buildFromOwned(myProducts: OwnedProduct[]): Routine {
    const byCategory = (cat: string) => myProducts.filter((p) => p.category === cat);
    const step = (cat: string, label: string, imp: RoutineStep['importance']): RoutineStep => {
      const items = byCategory(cat);
      if (!items.length) {
        return { name: label, productName: 'محصولی در این دسته ندارید', reason: 'می‌توانید از «محصولات من» اضافه کنید یا از پیشنهاد کاتالوگ استفاده کنید', howToUse: '-', frequency: '-', importance: 'low', activeIngredientKeys: [] };
      }
      return {
        name: label, productName: items.map((i) => i.name).join(' + '),
        reason: 'از محصولات موجود شما انتخاب شد', howToUse: 'طبق دستور محصول استفاده کنید', frequency: 'روزی ۱ بار', importance: imp,
        activeIngredientKeys: items.flatMap((i) => i.activeIngredientKeys),
      };
    };
    const morning = [step('cleanser', 'شست‌وشوی صورت', 'high'), step('serum', 'سرم', 'mid'), step('moisturizer', 'مرطوب‌کننده', 'mid'), step('sunscreen', 'ضدآفتاب', 'high')];
    const night = [step('cleanser', 'شست‌وشوی صورت', 'high'), step('treatment', 'درمانی', 'high'), step('moisturizer', 'مرطوب‌کننده', 'mid')];
    const conflicts = [...interactionChecker.check(morning.flatMap((s) => s.activeIngredientKeys)), ...interactionChecker.check(night.flatMap((s) => s.activeIngredientKeys))];
    return { morning, night, conflicts, variant: 'best', source: 'own_products' };
  },
};
