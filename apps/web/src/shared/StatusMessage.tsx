import type { ReactNode } from 'react';
import styles from './StatusMessage.module.css';

interface StatusMessageProps {
  kind: 'info' | 'error';
  children: ReactNode;
}

/** Shared presentation for loading, empty and error states. */
export function StatusMessage({ kind, children }: StatusMessageProps) {
  return kind === 'error' ? (
    <p role="alert" className={styles.error}>
      {children}
    </p>
  ) : (
    <p role="status" className={styles.info}>
      {children}
    </p>
  );
}
