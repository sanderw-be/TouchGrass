export default {
  // Greetings
  greeting_morning: 'Good morning 🌱',
  greeting_afternoon: 'Good afternoon ☀️',
  greeting_evening: 'Good evening 🌙',

  // Home screen
  goal_reached: 'Bravo ! Tu as déjà pris ta dose d’air frais aujourd’hui.',
  outside_time_awaits: '{{amount}} of outside time awaits today.',
  remaining_for_goal: '{{amount}} more to hit your daily goal.',
  this_week: 'This week',
  today: 'today',
  no_sessions_title: 'Pas encore de temps dehors enregistré aujourd’hui.',
  no_sessions_sub: 'Envie d’un peu d’air frais ? Ajoute-le ici !',
  todays_sessions: 'Moments dehors aujourd’hui',

  // Streaks
  streak_daily_singular: '{{count}} day streak',
  streak_daily_plural: '{{count}} day streak',
  streak_weekly_singular: '{{count}} week streak',
  streak_weekly_plural: '{{count}} week streak',
  streak_separator: ' · ',

  // Progress ring inline timer
  ring_timer_start: 'tap to start',
  ring_timer_tap_stop: 'tap to stop',
  ring_timer_outside: 'outside',
  ring_timer_info: 'Touchez l’anneau pour démarrer manuellement votre temps dehors.',

  // Widget
  widget_start_outside: 'start outside\nsession',
  widget_back_inside: 'back inside',
  widget_started: 'started',
  widget_loading: 'Loading…',
  widget_open_app: 'Open app to update',

  // Session sources
  source_health_connect: 'Autres apps',
  source_gps: 'GPS',
  source_manual: 'Manual',
  source_timeline: 'Timeline',

  // Session review
  review: 'review',
  session_delete: 'Delete',
  session_delete_confirm_title: 'Delete session',
  session_delete_confirm_body:
    'Are you sure you want to delete this session? This cannot be undone.',
  session_delete_cancel: 'Cancel',
  session_review_again: 'Review again',
  session_review_anyway: 'Review anyway',
  session_edit_times: '✏️ Edit times',
  session_edit_title: 'Edit session times',
  session_edit_save: '✓ Save & approve',
  session_edit_hint: 'Saving edited times will auto-approve this session.',
  session_notes_title: 'Session notes',
  session_notes_placeholder: 'Add a note…',
  session_notes_save: 'Save',
  session_swipe_hint: 'Gauche pour dehors, droite pour dedans.',
  session_rejected_snackbar: 'Marked as inside',
  undo: 'Undo',

  // Goals
  of: 'of',
  daily_goal: 'Daily goal',
  weekly_goal: 'Weekly goal',

  // Navigation
  nav_home: 'Home',
  nav_history: 'History',
  nav_events: 'Events',
  nav_goals: 'Goals',
  nav_settings: 'Settings',
  nav_weather_settings: 'Weather Settings',

  // Days of week (short, Monday first)
  day_mon: 'L',
  day_tue: 'Ma',
  day_wed: 'Me',
  day_thu: 'J',
  day_fri: 'V',
  day_sat: 'S',
  day_sun: 'D',

  // Goals screen
  goals_edit: 'Edit',
  goals_cancel: 'Cancel',
  goals_save: 'Save',
  goals_quick_select: 'Quick select',
  goals_custom_minutes: 'Custom (minutes)',
  goals_placeholder_daily: 'e.g. 40',
  goals_placeholder_weekly: 'e.g. 200',
  goals_invalid_title: 'Invalid goal',
  goals_invalid_daily: 'Please enter a value between 1 and 720 minutes.',
  goals_invalid_weekly: 'Please enter a value between 1 and 5040 minutes.',
  goals_who_tip:
    "The WHO recommends at least 150 minutes of moderate outdoor activity per week — that's about 30 minutes a day on weekdays.",

  // Events screen
  events_tab_approved: 'Approved',
  events_tab_standard: 'Standard',
  events_tab_all: 'All',
  events_toggle_confirmed: 'Confirmed',
  events_toggle_review: 'À vérifier',
  events_toggle_rejected: 'Rejected',
  events_none_recorded: 'Aucun moment dehors trouvé pour le moment.',
  events_confidence: 'Confidence',
  events_not_outside: '✕ Inside',
  events_confirm: '✓ Outside',
  events_confirmed: '✓ Outside',
  events_rejected: '✕ Inside',
  events_discarded: 'Discarded',
  events_proposed: 'Proposed',

  // History screen
  history_period_week: 'Week',
  history_period_month: 'Month',
  history_stat_total: 'Total',
  history_stat_avg: 'Daily avg',
  history_stat_goals_met: 'Goals met',
  history_axis_minutes: 'Minutes per day',
  history_axis_days_week: 'Day of week',
  history_axis_days_month: 'Day of month',
  history_no_data: 'No data for this period',
  history_legend_goal_met: 'Goal met',
  history_legend_below_goal: 'Below goal',
  history_legend_today: 'Today',
  history_legend_target: 'Target',

  // Settings screen
  settings_section_detection: 'Suivi automatique',
  settings_section_locations: 'Known locations',
  settings_section_reminders: 'Reminders',
  settings_section_language: 'Language',
  settings_section_about: 'About',
  settings_health_connect: 'Health Connect',
  settings_health_connect_desc: 'Track steps & activity automatically',
  settings_hc_permission_missing: 'Accès nécessaire — touche pour configurer',
  settings_hc_permission_title: 'Health Connect Permission',
  settings_hc_permission_body:
    'Health Connect permissions are needed to automatically track outdoor activities from your steps and workouts.',
  settings_hc_open_btn: 'Open Health Connect',
  settings_hc_failed_title: 'Could not connect',
  settings_hc_failed_body:
    'Please grant TouchGrass permissions for Health Connect:\n\n**If permission dialog appeared:**\n• Grant the requested permissions\n• Return to TouchGrass\n\n**If no dialog appeared:**\n1. Open Settings → Privacy → Health Connect\n2. Find and tap TouchGrass in the app list\n3. Enable the data types (Exercise, Steps, etc.)\n4. Return to TouchGrass\n\nIf TouchGrass does not appear:\n• Restart the app and try again\n• Ensure Health Connect is installed from Play Store',
  settings_hc_verified_title: 'Connected successfully',
  settings_hc_verified_body:
    'Health Connect permissions confirmed. Your outdoor activities will now be tracked automatically.',
  settings_hc_open_error_title: 'Error',
  settings_hc_open_error_body:
    'Could not open Health Connect settings. Please open it manually from your app drawer.',
  // GPS permission error
  settings_error_title: 'Error',
  settings_error_open_settings_failed: 'Could not open settings. Please open Settings manually.',
  settings_gps_permission_required_title: 'GPS Permission Required',
  settings_gps_permission_required_body:
    'Background location ("Allow all the time") is required for GPS session detection. TouchGrass uses geofencing to detect when you leave and return to known indoor locations. Please grant the permission in Settings.',
  settings_permission_cancel: 'Cancel',
  settings_permission_open: 'Open Settings',
  settings_permission_disable: 'Disable this feature',
  settings_gps: 'GPS tracking',
  settings_gps_desc: 'Repérer les moments dehors avec la localisation',
  settings_gps_permission: 'Permission needed',
  settings_gps_permission_missing: 'Accès nécessaire — touche pour configurer',
  settings_location_radius: '{{radius}}m radius · {{type}}',
  settings_location_indoor: 'Indoor',
  settings_location_outdoor: 'Outdoor',
  settings_location_edit_title: 'Edit location',
  location_edit_label: 'Location name',
  location_edit_label_placeholder: 'e.g. Home, Work, Park',
  location_edit_radius: 'Reconnaissance de lieu',
  location_edit_radius_hint: 'Distance from location center (25–250 meters)',
  location_edit_radius_hint_imperial: 'Distance from location center (25–250 yards)',
  location_edit_type: 'Location type',
  location_edit_error_title: 'Invalid input',
  location_edit_error_label: 'Please enter a location name.',
  location_edit_error_save: 'Failed to save location. Please try again.',
  location_edit_error_delete: 'Failed to delete location. Please try again.',
  location_delete_btn: 'Delete location',
  location_delete_confirm_title: 'Delete location',
  location_delete_confirm_body:
    'Are you sure you want to delete this location? This cannot be undone.',
  settings_reminders_label: 'Smart reminders',
  settings_reminders_sublabel:
    'Petits rappels au bon moment — apprend ton rythme. Aucune collecte de données.',
  settings_reminders_count_off: 'Off',
  settings_reminders_count_per_day: '{{count}}/day',
  settings_notification_permission_title: 'Notification Permission',
  settings_notification_permission_missing: 'Accès nécessaire — touche pour configurer',
  settings_notification_permission_body:
    'Notification permission is needed to send smart reminders. TouchGrass only uses this to nudge you at the best moment to go outside — never for marketing.',
  settings_catchup_label: 'Help me reach my goal',
  settings_catchup_sublabel: "Extra reminders when you're falling behind",
  settings_catchup_off: 'Off',
  settings_catchup_mellow: 'Mellow',
  settings_catchup_medium: 'Medium',
  settings_catchup_aggressive: 'Aggressive',
  settings_background_tracking_label: 'Background tracking notification',
  settings_background_tracking_sublabel:
    'The persistent notification showing while GPS is active. Disable it via Android Settings → Apps → TouchGrass → Notifications → Background tracking.',
  settings_app_sublabel: 'Your outdoor time companion',
  settings_privacy: 'Privacy',
  settings_privacy_sublabel: 'Tes données ne quittent jamais ton téléphone',
  settings_privacy_hint: 'Tap to read our privacy policy',
  settings_clear_data: 'Clear all data',
  settings_clear_data_sublabel: 'Permanently delete all sessions and settings',
  settings_clear_data_confirm_title: 'Clear all data',
  settings_clear_data_confirm_body:
    'This will permanently delete all your outside sessions, goals, and settings. This cannot be undone.',
  settings_clear_cancel: 'Cancel',
  settings_clear_delete: 'Delete',
  settings_clear_data_success_title: 'Data cleared',
  settings_clear_data_success_body: 'All data has been successfully cleared.',
  settings_clear_data_error_title: 'Error',
  settings_clear_data_error_body: 'An error occurred while clearing data. Please try again.',
  settings_rerun_tutorial: 'Re-run tutorial',
  settings_rerun_tutorial_sublabel: 'Review the setup guide again',

  // Appearance (dark mode)
  settings_section_appearance: 'Appearance',
  settings_theme_label: 'Theme',
  settings_theme_sublabel: 'Choose your preferred color scheme',
  settings_theme_system: 'System default',
  settings_theme_light: 'Light',
  settings_theme_dark: 'Dark',

  // Known locations management
  nav_known_locations: 'Known Locations',
  settings_locations_manage: 'Manage known locations',
  settings_locations_manage_desc: 'Review suggested places and configure known locations',
  settings_locations_suggestions_enabled: 'Suggest new locations',
  settings_locations_suggestions_desc: 'Automatically detect places you visit often',
  settings_locations_section_suggested: 'Suggested locations',
  settings_locations_section_active: 'Active locations',
  settings_location_approve: 'Approve',
  settings_location_deny: 'Deny',
  settings_location_suggested_badge: 'Pending approval',
  settings_location_no_suggestions: 'No suggestions yet',
  settings_location_no_suggestions_hint:
    'The app will suggest locations after you spend 2+ hours in the same place with GPS active.',
  settings_location_no_active: 'No active locations',
  settings_location_no_active_hint: 'Approve a suggestion or add a location manually.',
  settings_locations_count: '{{count}} active',
  settings_location_deny_title: 'Deny suggestion',
  settings_location_deny_body:
    'This location suggestion will be removed. The app will not suggest it again.',
  settings_location_deny_confirm: 'Remove',
  settings_location_deny_cancel: 'Cancel',
  location_suggestion_default_label: 'Suggested place',
  location_add_title: 'Add location',
  location_edit_address: 'Nearest address',
  location_edit_address_unavailable: 'Address not available',
  location_edit_address_search_placeholder: 'Search address…',
  location_edit_address_no_results: 'No addresses found',
  location_edit_approve_title: 'Approve location',
  location_edit_approve_confirm: 'Approve & save',
  location_position_error_title: 'Location unavailable',
  location_position_error_body: 'Could not get your current location. Make sure GPS is enabled.',
  notif_location_suggestion_title: '📍 New location detected',
  notif_location_suggestion_body:
    'TouchGrass detected a place you visit often. Tap to review and name it.',

  manual_title: 'Log outside time',
  manual_tab_log: '📝 Log past session',
  manual_tab_timer: '⏱ Start timer',
  manual_start_time: 'Start time',
  manual_end_time: 'End time',
  manual_preview: 'Aperçu',
  manual_log_btn: '✓ Log session',
  manual_timer_ready: 'Tap start when you head outside',
  manual_timer_running: 'Timer running — go enjoy the outdoors! 🌿',
  manual_timer_start: "🌿 I'm heading outside",
  manual_timer_stop: "✓ I'm back",
  manual_timer_cancel: 'Cancel',
  manual_timer_stopped_hint: 'Timer stopped — review and adjust your session times before saving.',
  manual_invalid_title: 'Invalid time range',
  manual_invalid_body:
    'Please make sure the end time is after the start time and the session is no longer than 12 hours.',

  // Intro/Onboarding
  intro_skip: 'Skip',
  intro_next: 'Next',
  intro_get_started: 'Get Started',
  intro_welcome_title: 'Welcome to TouchGrass',
  intro_welcome_body: 'Ton coup de pouce pour poser ton téléphone et sortir plus souvent.',
  intro_welcome_feature_1: 'Track outside time automatically',
  intro_welcome_feature_2: 'Set and monitor daily goals',
  intro_welcome_feature_3: 'Get smart reminders',
  intro_welcome_feature_4: 'All data stays private on your device',
  intro_privacy_policy: 'Privacy Policy',
  intro_hc_title: 'Health Connect',
  intro_hc_body:
    'TouchGrass uses Health Connect to automatically detect outdoor exercise activities.',
  intro_hc_why_title: 'Pourquoi cet accès ?',
  intro_hc_why_body:
    'Health Connect provides access to exercise sessions from your fitness apps, helping us track your outdoor activities like walking, running, or cycling.',
  intro_hc_hint: 'You can grant this permission later in Settings.',
  intro_hc_button: 'Connect Health Connect',
  intro_hc_button_granted: 'Connected ✓',
  intro_location_title: 'Location Access',
  intro_location_body:
    'TouchGrass uses your location to automatically detect outdoor sessions via geofencing.',
  intro_location_why_title: 'Pourquoi cet accès ?',
  intro_location_why_body:
    'GPS tracking uses geofencing to detect when you leave and return to known indoor locations (e.g. home, work), so outdoor sessions are proposed automatically — even when the app is closed. "Allow all the time" is required for this to work in the background.\n\nIf you enable weather-aware reminders, only approximate location is used to fetch local weather conditions.',
  intro_location_hint:
    'You\'ll be asked to select "Allow all the time" for background session detection.',
  intro_location_button: 'Grant Location Access',
  intro_location_button_granted: 'Location Granted ✓',
  intro_location_known_title: 'Improve outdoor detection',
  intro_location_known_body:
    'Setting your home and work locations helps TouchGrass know where you usually are indoors, greatly improving detection accuracy.',
  intro_location_known_set_home: 'Set Home',
  intro_location_known_set_work: 'Set Work',
  intro_location_known_set_home_done: '🏠 Home set ✓',
  intro_location_known_set_work_done: '🏢 Work set ✓',
  intro_location_known_hint: 'You can adjust and add locations in Settings → Known Locations.',
  intro_notifications_title: 'Reminders',
  intro_notifications_body: 'Get gentle nudges to go outside when you need them most.',
  intro_notifications_why_title: 'Pourquoi cet accès ?',
  intro_notifications_why_body:
    'Smart reminders learn your patterns over time and only notify you at helpful moments. You can also create scheduled reminders for specific times and days. You can disable them anytime.',
  intro_notifications_hint: 'Completely optional — you can skip this.',
  intro_notifications_button: 'Enable Reminders',
  intro_notifications_button_granted: 'Reminders Enabled ✓',
  intro_calendar_title: 'Calendar',
  intro_calendar_body:
    'Connect your calendar so TouchGrass can schedule outdoor time around your meetings.',
  intro_calendar_why_title: 'Pourquoi cet accès ?',
  intro_calendar_why_body:
    'With calendar access, TouchGrass avoids sending reminders when you have a meeting coming up and can automatically add outdoor time slots to your calendar.',
  intro_calendar_data_scope:
    'Nous lisons seulement les horaires — aucun détail ni personne. Tout reste privé sur ton appareil.',
  intro_calendar_hint: 'You can configure this later in Settings.',
  intro_calendar_button: 'Connect Calendar',
  intro_calendar_button_granted: 'Calendar Connected ✓',
  intro_calendar_buffer_label: 'Meeting buffer',
  intro_calendar_buffer_desc: 'Skip reminders when a meeting starts within this window',
  intro_calendar_duration_label: 'Add outdoor time to calendar',
  intro_calendar_duration_desc: 'Automatically schedule outdoor time slots',
  intro_ready_title: "You're all set!",
  intro_ready_body: 'TouchGrass is ready to help you spend more time outdoors.',
  intro_ready_tip_title: 'Quick tip',
  intro_ready_tip_body:
    'You can always manually log outdoor sessions from the home screen if automatic detection misses anything. Set up scheduled reminders in Settings → Reminders for recurring notifications.',
  intro_ready_checklist_title: 'First run checklist',
  intro_ready_checklist_item_hc: 'Connect Health Connect to import exercise sessions.',
  intro_ready_checklist_item_gps: 'Allow background location for GPS detection.',
  intro_ready_checklist_item_notifications: 'Enable notifications for smart reminders.',
  intro_ready_checklist_item_calendar: 'Connect calendar for smart scheduling.',
  intro_ready_widget_title: 'Home screen widget',
  intro_ready_widget_body:
    'Add the TouchGrass widget to your home screen to see your progress at a glance and start sessions without opening the app.',

  // Notification titles (randomly picked)
  notif_title_1: '🌿 Time to touch grass!',
  notif_title_2: '☀️ Step outside for a bit',
  notif_title_3: '🌱 Fresh air awaits',
  notif_title_4: '👟 On enfile ses chaussures ?',
  notif_title_5: '🌳 The outdoors is calling',

  // Notification bodies
  notif_body_none: 'Pas encore sorti aujourd’hui ? Une petite balade compte aussi !',
  notif_body_halfway: "{{remaining}} minutes to go. You've got this!",
  notif_body_almost: 'Almost there — just {{remaining}} more minutes outside.',
  notif_body_done: 'Goal reached! Feel like a bonus walk? 🌿',

  // Reminder reason descriptions ("Why this time?" explanations appended to notification body)
  notif_reason_pattern: 'you often go outside around this time',
  notif_reason_lunch: "it's a great time for a lunchtime walk",
  notif_reason_after_work: 'after work is a great time to go outside',
  notif_reason_urgent: 'tu n’as pas encore réussi à sortir aujourd’hui.',
  notif_reason_acted: "you've gone outside around this time before",
  notif_reason_more_often: 'you prefer reminders around this time',

  // Streak encouragement for notifications
  notif_streak_daily: 'Keep your {{count}} day streak going!',
  notif_streak_weekly: 'Maintain your {{count}} week streak!',
  notif_streak_daily_at_risk: "Don't break your {{count}} day streak!",
  notif_streak_weekly_at_risk: "Don't break your {{count}} week streak!",

  // Connector word used between two reminder reason descriptions ("X, and Y.")
  notif_contributor_and: 'and',
  // Weather context appended to notification body when no contributor reasons are available
  // {{desc}} = weather description (e.g. "Sunny"), {{temp}} = formatted temperature (e.g. "22°C")
  notif_weather_context: '{{desc}}, {{temp}} outside.',

  // Notification action buttons
  notif_action_went_outside: '✅ Went outside!',
  notif_action_snooze: '⏰ Snooze',
  notif_action_less_often: '🔕 Less often',

  // Notification action confirmation messages (shown briefly after tapping an action button)
  notif_confirm_title: 'TouchGrass',
  notif_confirm_went_outside: '✅ Got it! Nice work getting outside.',
  notif_confirm_snoozed: "⏰ I'll remind you again in 30 minutes.",
  notif_confirm_less_often: "🔕 Got it! I'll remind you less often.",

  // Reminder feedback modal explanation messages
  notif_feedback_dismiss: 'Got it',
  notif_feedback_went_outside_detail: "We'll remind you more around {{time}}.",
  notif_feedback_snoozed_detail:
    "We'll remind you in 30 minutes, remind you less at {{time}} and more at {{snoozeTime}}.",
  notif_feedback_less_often_detail: "We'll remind you less at {{time}}.",

  // Less-often granular feedback modal
  notif_less_often_title: 'What would you like?',
  notif_less_often_bad_time: '🕐 This was a bad time',
  notif_less_often_fewer_reminders: '🔕 Send me fewer reminders',
  notif_fewer_reminders_confirm:
    "Okay, I'll send you {{newCount}} reminder(s) per day instead of {{oldCount}}.",
  notif_fewer_reminders_confirm_generic: "Okay, I'll send you fewer reminders.",

  // Weather settings
  settings_weather_title: 'Weather',
  settings_weather_enabled: 'Weather-aware reminders',
  settings_weather_enabled_desc: 'Consider weather conditions when suggesting outdoor times',
  settings_weather_more: 'More weather settings',
  settings_weather_more_desc: 'Temperature preference, rain, heat, UV',
  settings_weather_permission_title: 'Location Permission',
  settings_weather_permission_missing: 'Accès nécessaire — touche pour configurer',
  settings_weather_location_permission_missing:
    'Location permission is needed to fetch local weather. Approximate location is only used to determine weather conditions and is never stored.',
  settings_weather_location_request: 'Grant Location Access',
  settings_temp_preference: 'Climate preference',
  settings_temp_cold: 'Prefer cooler weather',
  settings_temp_moderate: 'Moderate climate',
  settings_temp_hot: 'Prefer warmer weather',
  settings_weather_avoid_rain: 'Avoid rainy times',
  settings_weather_avoid_heat: 'Avoid extreme heat',
  settings_weather_consider_uv: 'Consider UV index',
  settings_weather_current: 'Current weather',
  settings_weather_unavailable: 'Weather data unavailable',
  settings_weather_error: 'Failed to fetch weather',
  settings_weather_refresh: 'Refresh weather',

  // Weather conditions
  weather_clear_sky: 'Clear sky',
  weather_mainly_clear: 'Mainly clear',
  weather_partly_cloudy: 'Partly cloudy',
  weather_overcast: 'Overcast',
  weather_foggy: 'Foggy',
  weather_drizzle: 'Drizzle',
  weather_rain: 'Rain',
  weather_snow: 'Snow',
  weather_rain_showers: 'Rain showers',
  weather_snow_showers: 'Snow showers',
  weather_thunderstorm: 'Thunderstorm',
  weather_unknown: 'Unknown',

  // Notification channel
  notif_channel_name: 'Outside reminders',
  notif_channel_background_name: 'Background tracking',
  notif_channel_background_desc:
    'Shows while TouchGrass is tracking your outside time. Can be disabled without affecting reminders.',
  gps_tracking_notif_body: 'Tracking your outside time in the background',
  notif_channel_scheduled_name: 'Scheduled reminders',
  notif_channel_scheduled_desc: 'Your custom scheduled reminders to go outside',
  notif_channel_daily_planner_name: 'Daily planner',
  notif_channel_daily_planner_desc:
    'Silent 3 AM wake-up used to reschedule your daily reminders. Can be fully disabled in Android notification settings.',
  notif_daily_planner_title: 'TouchGrass',
  notif_daily_planner_body: 'Open the app to complete planning for today.',

  // Scheduled notifications
  scheduled_notif_body: 'Your scheduled reminder to go outside.',
  scheduled_empty: 'No scheduled reminders yet',
  scheduled_empty_hint: 'Tap the + button to create a recurring reminder',
  scheduled_add: 'Add reminder',
  scheduled_add_title: 'New scheduled reminder',
  scheduled_edit: 'Edit',
  scheduled_edit_title: 'Edit reminder',
  scheduled_delete: 'Delete',
  scheduled_delete_confirm_title: 'Delete reminder',
  scheduled_delete_confirm_body: 'Are you sure you want to delete this reminder?',
  scheduled_delete_cancel: 'Cancel',
  scheduled_delete_confirm: 'Delete',
  scheduled_cancel: 'Cancel',
  scheduled_save: 'Save',
  scheduled_time: 'Time',
  scheduled_days: 'Days',
  scheduled_select_all: 'All days',
  scheduled_label: 'Label (optional)',
  scheduled_label_placeholder: 'e.g., Morning walk',
  scheduled_all_days: 'Every day',
  scheduled_weekdays: 'Weekdays',
  scheduled_error_title: 'Error',
  scheduled_error_no_days: 'Please select at least one day',
  settings_scheduled_reminders: 'Scheduled reminders',
  settings_scheduled_reminders_sublabel: 'Create recurring reminders for specific times',

  // Calendar integration
  settings_section_calendar: 'Calendar',
  settings_calendar_integration: 'Calendar integration',
  settings_calendar_integration_desc:
    'Check your calendar to avoid scheduling reminders during meetings',
  settings_calendar_permission_title: 'Calendar Permission',
  settings_calendar_permission_missing: 'Accès nécessaire — touche pour configurer',
  settings_calendar_permission_body:
    'Calendar access is needed to check your appointments for smart reminders.\n\nTouchGrass reads only event titles and times — no descriptions, attendees, or other data. Nothing leaves your device.',
  settings_calendar_permission_open: 'Open Settings',
  settings_calendar_permission_cancel: 'Cancel',
  settings_calendar_buffer: 'Meeting buffer',
  settings_calendar_buffer_desc: 'Skip smart reminders when a meeting starts within this window',
  settings_calendar_buffer_minutes: '{{minutes}} minutes',
  settings_calendar_duration: 'Outside time in calendar',
  settings_calendar_duration_desc: 'Duration when adding outdoor time to calendar',
  settings_calendar_duration_off: 'Off',
  settings_calendar_duration_minutes: '{{minutes}} min',
  settings_calendar_select: 'Write outdoor time to',
  settings_calendar_select_desc: 'Calendar where outdoor time slots are saved',
  settings_calendar_select_title: 'Select Calendar',
  settings_calendar_select_touchgrass: 'TouchGrass (local)',
  calendar_event_title: '🌿 Outdoor time',
  calendar_event_notes: 'Scheduled by TouchGrass',
  calendar_touchgrass_name: 'TouchGrass',

  // About TouchGrass screen
  nav_about_app: 'About TouchGrass',
  about_intro_title: 'What is TouchGrass?',
  about_intro_body:
    'TouchGrass is your personal outdoor time companion. It automatically tracks the time you spend outside, helps you set daily and weekly goals, and nudges you with smart reminders when you haven\u2019t gone out yet.',
  about_detection_title: 'How outdoor time is tracked',
  about_detection_body:
    'TouchGrass uses two detection methods:\n\n\u2022 Health Connect \u2014 imports exercise sessions and step-based outdoor activity from your health data.\n\u2022 GPS \u2014 detects when you leave a known location (home, work) and returns, using your device\u2019s location services.\n\nYou can enable one or both methods in Settings \u2192 Detection. Sessions detected automatically show up on the Events tab for your review.',
  about_goals_title: 'Goals & progress',
  about_goals_body:
    'Set a daily outdoor time goal (e.g. 30 minutes) and optionally a weekly goal. TouchGrass tracks your streak when you hit your goal on consecutive days or weeks. Your progress is shown as a ring on the home screen and as a bar chart in the History tab.',
  about_reminders_title: 'Smart reminders',
  about_reminders_body:
    'TouchGrass can send you a reminder when you haven\u2019t reached your daily goal yet. Reminders are \u201csmart\u201d \u2014 they check your calendar for upcoming meetings and your local weather before suggesting the best time to go outside. You can configure reminder windows and thresholds in Settings \u2192 Reminders.',
  about_manual_title: 'Manual logging',
  about_manual_body:
    'Missed a session? You can log outdoor time manually from the home screen. Tap the ring or use the manual log button to enter a past session or start a live timer. Manual sessions are always approved immediately.',
  about_widget_title: 'Home screen widget',
  about_widget_body:
    'Add the TouchGrass widget to your home screen for a quick glance at your daily progress. The widget shows a progress ring and lets you start or stop an outdoor session with a single tap \u2014 no need to open the app. Long-press your home screen and choose Widgets \u2192 TouchGrass to add it.',
  about_privacy_title: 'Privacy',
  about_privacy_body:
    'All your data stays on your device. TouchGrass does not send any personal information to external servers. Location data is used only to detect outdoor sessions and is never stored beyond what is needed. Health Connect data is read locally and is not shared.',

  // Feedback & Support screen
  nav_feedback_support: 'Feedback & Support',
  feedback_send_feedback: 'Send feedback',
  feedback_send_feedback_sublabel: 'Share a bug report, feature idea, or general feedback',
  feedback_support_kofi: 'Support Jolly Heron',
  feedback_support_kofi_sublabel: 'Buy me a coffee — every bit helps ☕',
  feedback_google_disclosure:
    'Feedback is submitted via Google Forms and is subject to Google\u2019s privacy practices. See our Privacy Policy.',
  settings_feedback_support: 'Feedback & Support',
  settings_feedback_support_sublabel: 'Share feedback or support the developer',

  // Error boundary crash screen
  error_boundary_title: 'Something went wrong',
  error_boundary_subtitle:
    'The app encountered an unexpected error. You can try restarting it or report the issue to help us fix it. Reporting will share your device type and app version with Google Forms.',
  error_boundary_restart: 'Restart app',
  error_boundary_report: 'Report this issue',

  // Background Task
  background_task_title: 'Smart Reminders',
  background_task_desc: 'Checking for the best time to remind you to go outside.',

  // Activity Log screen
  nav_activity_log: 'Activity Log',
  settings_section_activity_log: 'Transparency',
  settings_activity_log: 'Activity log',
  settings_activity_log_sublabel: 'View what the app does in the background',
  activity_log_empty: 'No events recorded yet.',
  activity_log_section_hc: 'Health Connect',
  activity_log_section_gps: 'GPS',
  activity_log_section_reminders: 'Smart Reminders',

  // Battery optimization (Android intro)
  intro_battery_title: 'Background Activity',
  intro_battery_body:
    'For reliable reminders even when the app is closed, TouchGrass needs unrestricted background activity.',
  intro_battery_why_title: 'Why is this needed?',
  intro_battery_why_body:
    'Some phone manufacturers aggressively limit background apps to save battery. Without this setting, your reminders may be delayed or missed entirely.',
  intro_battery_button: 'Open Battery Settings',
  intro_battery_button_done: 'Settings Opened ✓',
  intro_battery_hint:
    'Find TouchGrass in the list and select "Unrestricted". You can skip this and change it later in Settings.',

  // Settings battery optimization
  settings_battery_optimization: 'Battery optimization',
  settings_battery_optimization_sublabel:
    'TouchGrass is very efficient — but Android can aggressively block background apps. Go to Battery → Battery optimization → find TouchGrass → set to Unrestricted.',

  // Intro checklist
  intro_ready_checklist_item_battery: 'Set battery optimization to "Unrestricted".',

  // Time/date formatting locale tag
  locale_tag: 'fr-FR',

  // Session description notes (stored with each session to describe how it was detected)
  session_notes_manual: 'Manual entry.',
  // GPS descriptions — {{dist}} = numeric distance, {{distUnit}} = "km" or "mi",
  //                    {{speed}} = numeric speed,   {{speedUnit}} = "km/h" or "mph"
  session_notes_gps_left_returned:
    'GPS detection, left {{start}} and returned for {{dist}} {{distUnit}} at {{speed}} {{speedUnit}}.',
  session_notes_gps_left_went:
    'GPS detection, left {{start}} and went to {{end}} for {{dist}} {{distUnit}} at {{speed}} {{speedUnit}}.',
  session_notes_gps_left:
    'GPS detection, left {{start}} for {{dist}} {{distUnit}} at {{speed}} {{speedUnit}}.',
  session_notes_gps_returned:
    'GPS detection, returned to {{end}} for {{dist}} {{distUnit}} at {{speed}} {{speedUnit}}.',
  session_notes_gps_no_location: 'GPS detection, {{dist}} {{distUnit}} at {{speed}} {{speedUnit}}.',
  // Health Connect descriptions — {{steps}} = formatted number, {{speed}} = numeric speed, {{speedUnit}} = "km/h" or "mph"
  session_notes_hc_steps: 'Health Connect, {{steps}} steps at {{speed}} {{speedUnit}}.',
  session_notes_hc_exercise: 'Health Connect, {{exerciseName}}.',
  // Speed unit label for the device's measurement system (overridden to "mph" for imperial regions in code)
  unit_speed_metric: 'km/h',
  unit_speed_imperial: 'mph',
  // Exercise type names (Health Connect integer → display string)
  exercise_badminton: 'badminton',
  exercise_baseball: 'baseball',
  exercise_basketball: 'basketball',
  exercise_biking: 'biking',
  exercise_cricket: 'cricket',
  exercise_american_football: 'American football',
  exercise_australian_football: 'Australian football',
  exercise_frisbee: 'frisbee',
  exercise_golf: 'golf',
  exercise_handball: 'handball',
  exercise_hiking: 'hiking',
  exercise_ice_hockey: 'ice hockey',
  exercise_ice_skating: 'ice skating',
  exercise_paddling: 'paddling',
  exercise_paragliding: 'paragliding',
  exercise_rock_climbing: 'rock climbing',
  exercise_roller_hockey: 'roller hockey',
  exercise_rowing: 'rowing',
  exercise_rugby: 'rugby',
  exercise_running: 'running',
  exercise_sailing: 'sailing',
  exercise_scuba_diving: 'scuba diving',
  exercise_skating: 'skating',
  exercise_skiing: 'skiing',
  exercise_snowboarding: 'snowboarding',
  exercise_snowshoeing: 'snowshoeing',
  exercise_soccer: 'soccer',
  exercise_softball: 'softball',
  exercise_surfing: 'surfing',
  exercise_open_water_swimming: 'open water swimming',
  exercise_tennis: 'tennis',
  exercise_volleyball: 'volleyball',
  exercise_walking: 'walking',
  exercise_water_polo: 'water polo',
  exercise_wheelchair: 'wheelchair',
  exercise_unknown: 'exercise type {{type}}',

  // Permission issues banner (GoalsScreen / SettingsScreen)
  permission_issues_banner:
    'Permission issues with: {{features}}. Scroll down to fix or disable these features.',

  // Diagnostic sheet
  diagnostic_title: 'App Diagnostics',
  diagnostic_environment: 'Environment',
  diagnostic_native_version: 'Native Version',
  diagnostic_launch_type: 'Launch Type',
  diagnostic_update_id: 'Update ID',
  diagnostic_launch_embedded: 'Embedded',
  diagnostic_launch_ota: 'OTA Update',
  diagnostic_unknown: 'unknown',
  diagnostic_none: 'none',
  diagnostic_share: 'Share Diagnostics',
  diagnostic_check_update: 'Check for update',
  diagnostic_update_checking: 'Checking…',
  diagnostic_update_done: 'Up to date',
  // Update splash screen
  update_splash_checking: 'Checking for updates…',
  update_splash_downloading: 'Installing update…',
};
