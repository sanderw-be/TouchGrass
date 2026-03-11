import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type FeedbackAction = 'went_outside' | 'snoozed' | 'less_often';

export interface FeedbackModalData {
  action: FeedbackAction;
  hour: number;
  minute: number;
  confirmBodyKey: 'notif_confirm_went_outside' | 'notif_confirm_snoozed' | 'notif_confirm_less_often';
}

interface ReminderFeedbackContextValue {
  visible: boolean;
  data: FeedbackModalData | null;
  dismiss: () => void;
}

const ReminderFeedbackContext = createContext<ReminderFeedbackContextValue>({
  visible: false,
  data: null,
  dismiss: () => {},
});

// Module-level callback so notificationManager (outside React) can trigger the modal
let _showModalCallback: ((data: FeedbackModalData) => void) | null = null;

/**
 * Called by notificationManager to trigger the in-app feedback modal.
 * Works from outside React component context.
 */
export function triggerReminderFeedbackModal(data: FeedbackModalData): void {
  _showModalCallback?.(data);
}

export function ReminderFeedbackProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [data, setData] = useState<FeedbackModalData | null>(null);

  const show = useCallback((newData: FeedbackModalData) => {
    setData(newData);
    setVisible(true);
  }, []);

  useEffect(() => {
    _showModalCallback = show;
    return () => {
      _showModalCallback = null;
    };
  }, [show]);

  const dismiss = useCallback(() => setVisible(false), []);

  return (
    <ReminderFeedbackContext.Provider value={{ visible, data, dismiss }}>
      {children}
    </ReminderFeedbackContext.Provider>
  );
}

export function useReminderFeedback(): ReminderFeedbackContextValue {
  return useContext(ReminderFeedbackContext);
}
