// تشريح حصان السباق (وضع الربط bind pose) بالأمتار.
// المحور +X للأمام، +Y للأعلى، +Z للجانب الأيمن. الأرض عند y = 0.
// حصان سباق أصيل (ارتفاع الحارك ≈ 1.63 م): صدر عميق، خاصرة مشدودة، كفل عضلي، رقبة مقوّسة، أرجل طويلة رفيعة.

export const FOOT_SOLE = 0.045; // ارتفاع عظمة الحافر عن النعل

export const SPINE_JOINTS = {
  body: [0.0, 1.30, 0],
  pelvis: [-0.55, 1.42, 0],
  spine: [0.0, 1.40, 0],
  chest: [0.50, 1.38, 0],
  neck0: [0.72, 1.50, 0],
  neck1: [0.88, 1.68, 0],
  neck2: [1.03, 1.86, 0],
  neck3: [1.17, 2.02, 0],
  head: [1.30, 2.14, 0],
  headTip: [1.80, 1.79, 0],
};

export const TAIL_JOINTS = [
  [-0.94, 1.50, 0],
  [-1.06, 1.30, 0],
  [-1.12, 1.03, 0],
  [-1.15, 0.72, 0],
];

// مفاصل الأرجل: كتف/ورك ← مرفق/ركبة خلفية ← ركبة أمامية/عرقوب ← رمانة (fetlock) ← وسط الحافر
export const LEGS = {
  FL: { side: -1, front: true, parent: 'chest', joints: [[0.56, 1.22], [0.40, 0.96], [0.43, 0.52], [0.42, 0.165], [0.46, 0.045]], z: 0.13 },
  FR: { side: 1, front: true, parent: 'chest', joints: [[0.56, 1.22], [0.40, 0.96], [0.43, 0.52], [0.42, 0.165], [0.46, 0.045]], z: 0.13 },
  HL: { side: -1, front: false, parent: 'pelvis', joints: [[-0.58, 1.30], [-0.42, 0.98], [-0.72, 0.60], [-0.66, 0.17], [-0.62, 0.045]], z: 0.14 },
  HR: { side: 1, front: false, parent: 'pelvis', joints: [[-0.58, 1.30], [-0.42, 0.98], [-0.72, 0.60], [-0.66, 0.17], [-0.62, 0.045]], z: 0.14 },
};

// ألوان الخيل: base اللون العام، belly الأفتح، dark الأغمق؛ points لون القوائم والعُرف والذيل،
// socks عدد القوائم المحجّلة (بيضاء)، blaze غُرّة بيضاء في الوجه.
export const COAT_COLORS = [
  { name: 'كُميت', base: '#7a4526', belly: '#8d5633', dark: '#4f2a16', points: '#17110e', mane: '#15100d', socks: 0, blaze: true },
  { name: 'أشقر', base: '#a5562a', belly: '#b96a3c', dark: '#733a1b', points: '#8a4622', mane: '#9a5a30', socks: 2, blaze: true },
  { name: 'أشهب', base: '#b9b6b0', belly: '#cfccc6', dark: '#84817c', points: '#55524f', mane: '#d9d6d0', socks: 0, blaze: false },
  { name: 'أدهم', base: '#241c18', belly: '#30261f', dark: '#120e0c', points: '#0e0b0a', mane: '#0c0a09', socks: 1, blaze: false },
  { name: 'كُميت داكن', base: '#4a2a1a', belly: '#5b3622', dark: '#2c170e', points: '#120d0b', mane: '#100c0a', socks: 0, blaze: false },
  { name: 'أصفر', base: '#c79a5a', belly: '#d6af74', dark: '#96703c', points: '#3a2a1c', mane: '#efe6d2', socks: 2, blaze: true },
];
