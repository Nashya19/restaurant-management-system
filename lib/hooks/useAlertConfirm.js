'use client';

import React, { useState, useCallback } from 'react';
import CustomAlertConfirm from '@/components/ui/CustomAlertConfirm';

export function useAlertConfirm() {
  const [state, setState] = useState(null);

  const showAlert = useCallback((message, title = 'Notice') => {
    return new Promise((resolve) => {
      setState({
        type: 'alert',
        title,
        message,
        onConfirm: () => {
          resolve();
          setState(null);
        }
      });
    });
  }, []);

  const showConfirm = useCallback((message, title = 'Confirm Action') => {
    return new Promise((resolve) => {
      setState({
        type: 'confirm',
        title,
        message,
        onConfirm: () => {
          resolve(true);
          setState(null);
        },
        onCancel: () => {
          resolve(false);
          setState(null);
        }
      });
    });
  }, []);

  const AlertConfirmComponent = state ? (
    <CustomAlertConfirm
      type={state.type}
      title={state.title}
      message={state.message}
      onConfirm={state.onConfirm}
      onCancel={state.onCancel}
    />
  ) : null;

  return {
    showAlert,
    showConfirm,
    AlertConfirmComponent
  };
}
