'use client';

import { motion, stagger, type Variants } from 'motion/react';
import type { ReactNode } from 'react';

import { motionTokens } from './tokens.js';

export interface MotionProps {
  children: ReactNode;
  className?: string | undefined;
  /** Seconds. */
  delay?: number | undefined;
}

/*
 * prefers-reduced-motion is handled in CSS (`[data-motion]` in styles/index.css
 * forces the final state). Branching on useReducedMotion() here would render
 * different markup on the server and the client and could leave content at
 * opacity 0 after hydration.
 */

const transition = (delay = 0) => ({
  duration: motionTokens.duration.base,
  ease: motionTokens.ease.out,
  delay,
});

export function FadeIn({ children, className, delay }: MotionProps) {
  return (
    <motion.div
      data-motion=""
      className={className}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={transition(delay)}
    >
      {children}
    </motion.div>
  );
}

export function SlideUp({ children, className, delay }: MotionProps) {
  return (
    <motion.div
      data-motion=""
      className={className}
      initial={{ opacity: 0, y: motionTokens.offset }}
      animate={{ opacity: 1, y: 0 }}
      transition={transition(delay)}
    >
      {children}
    </motion.div>
  );
}

const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { delayChildren: stagger(motionTokens.stagger) } },
};

const staggerChild: Variants = {
  hidden: { opacity: 0, y: motionTokens.offset },
  visible: { opacity: 1, y: 0, transition: transition() },
};

/** Animates its `StaggerItem` children one after another (lists, cards). */
export function Stagger({ children, className }: Omit<MotionProps, 'delay'>) {
  return (
    <motion.div
      className={className}
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: Omit<MotionProps, 'delay'>) {
  return (
    <motion.div data-motion="" className={className} variants={staggerChild}>
      {children}
    </motion.div>
  );
}

/** Page entrance; use it in a Next.js `template.tsx` so it replays on navigation. */
export function PageTransition({ children, className }: Omit<MotionProps, 'delay'>) {
  return <SlideUp className={className}>{children}</SlideUp>;
}
