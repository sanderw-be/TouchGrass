package com.jollyheron.touchgrass

import android.content.Intent
import android.os.Bundle
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

class ReminderHeadlessTaskService : HeadlessJsTaskService() {
    override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig? {
        val extras = intent?.extras ?: return null
        return HeadlessJsTaskConfig(
            "ReminderHeadlessTask",
            Arguments.fromBundle(extras),
            5000, // timeout for the task
            true // optional: defines whether or not  the task is allowed to run in foreground. Default is false
        )
    }
}
