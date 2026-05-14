import { Variants } from "motion/react";

// Sayfa mount animasyonu — her sayfada kullanılır
export const pageVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] },
  },
};

/** Drill-in from list → detail (horizontal slide). */
export const drillDownVariants: Variants = {
  hidden: { x: 24, opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.25 },
  },
};

// Stagger container — listedeki child'ları sırayla animate eder
export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.06, delayChildren: 0.05 },
  },
};

// Stagger child — yukarıdan aşağı kayarak giriş
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.22, ease: [0.4, 0, 0.2, 1] },
  },
};

/** Like staggerContainer but slightly wider stagger for fan-in children. */
export const fanInVariants: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.07, delayChildren: 0.05 },
  },
};

export const fanInItem: Variants = {
  hidden: { x: -16, opacity: 0, scale: 0.97 },
  visible: { x: 0, opacity: 1, scale: 1 },
};

// Soldan giriş — tablo satırları için
export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -10 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] },
  },
};
