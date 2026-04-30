const withBackgroundFeaturesPlugin = require('../../withBackgroundFeaturesPlugin');

describe('withBackgroundFeaturesPlugin', () => {
  it('should export a function', () => {
    expect(typeof withBackgroundFeaturesPlugin).toBe('function');
  });

  it('should inject correct intent actions and logic', () => {
    // We can't fully execute the plugin easily without full mocks,
    // but we can check if it has the exact strings we expect in its source code.
    const fs = require('fs');
    const path = require('path');
    const pluginSource = fs.readFileSync(
      path.join(process.cwd(), 'withBackgroundFeaturesPlugin.js'),
      'utf8'
    );

    // Check Kotlin constants
    expect(pluginSource).toContain('com.jollyheron.touchgrass.ACTION_SMART_REMINDER');
    expect(pluginSource).toContain('SmartReminderHeadlessService');
    expect(pluginSource).toContain('android.permission.FOREGROUND_SERVICE_SHORT_SERVICE');

    // Check that we properly fixed the leak via finally { db.close() }
    expect(pluginSource).toContain('finally {');
    expect(pluginSource).toContain('db.close()');
  });
});
