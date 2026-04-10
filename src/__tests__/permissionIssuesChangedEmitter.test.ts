import {
  emitPermissionIssuesChanged,
  onPermissionIssuesChanged,
} from '../utils/permissionIssuesChangedEmitter';

describe('permissionIssuesChangedEmitter', () => {
  it('calls a registered listener when permission issues change', () => {
    const listener = jest.fn();
    const unsubscribe = onPermissionIssuesChanged(listener);

    emitPermissionIssuesChanged();

    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('does not call the listener after unsubscribing', () => {
    const listener = jest.fn();
    const unsubscribe = onPermissionIssuesChanged(listener);

    unsubscribe();
    emitPermissionIssuesChanged();

    expect(listener).not.toHaveBeenCalled();
  });

  it('calls multiple listeners independently', () => {
    const listenerA = jest.fn();
    const listenerB = jest.fn();
    const unsubA = onPermissionIssuesChanged(listenerA);
    const unsubB = onPermissionIssuesChanged(listenerB);

    emitPermissionIssuesChanged();

    expect(listenerA).toHaveBeenCalledTimes(1);
    expect(listenerB).toHaveBeenCalledTimes(1);

    unsubA();
    unsubB();
  });

  it('does not call an already-removed listener while other listeners still receive events', () => {
    const listenerA = jest.fn();
    const listenerB = jest.fn();
    const unsubA = onPermissionIssuesChanged(listenerA);
    const unsubB = onPermissionIssuesChanged(listenerB);

    unsubA();
    emitPermissionIssuesChanged();

    expect(listenerA).not.toHaveBeenCalled();
    expect(listenerB).toHaveBeenCalledTimes(1);

    unsubB();
  });

  it('continues emitting to remaining listeners when one throws', () => {
    const throwing = jest.fn(() => {
      throw new Error('test error');
    });
    const safe = jest.fn();

    const unsubThrowing = onPermissionIssuesChanged(throwing);
    const unsubSafe = onPermissionIssuesChanged(safe);

    // Should not propagate the error
    expect(() => emitPermissionIssuesChanged()).not.toThrow();
    expect(safe).toHaveBeenCalledTimes(1);

    unsubThrowing();
    unsubSafe();
  });
});
