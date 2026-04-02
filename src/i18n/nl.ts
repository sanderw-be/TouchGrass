export default {
  // Begroetingen
  greeting_morning: 'Goedemorgen 🌱',
  greeting_afternoon: 'Goedemiddag ☀️',
  greeting_evening: 'Goedenavond 🌙',

  // Startscherm
  goal_reached: 'Doel bereikt! Goed buiten geweest vandaag.',
  outside_time_awaits: 'Nog {{amount}} buiten te gaan vandaag.',
  remaining_for_goal: 'Nog {{amount}} om je dagdoel te halen.',
  this_week: 'Deze week',
  today: 'vandaag',
  no_sessions_title: 'Nog geen buitentijd geregistreerd vandaag.',
  no_sessions_sub: 'Ga naar buiten of log het handmatig!',
  todays_sessions: 'Sessies vandaag',

  // Streaks
  streak_daily_singular: '{{count}} dag streak',
  streak_daily_plural: '{{count}} dagen streak',
  streak_weekly_singular: '{{count}} week streak',
  streak_weekly_plural: '{{count}} weken streak',
  streak_separator: ' · ',

  // Timer in voortgangsring
  ring_timer_start: 'tik om te starten',
  ring_timer_tap_stop: 'tik om te stoppen',
  ring_timer_outside: 'buiten',

  // Sessiebronnen
  source_health_connect: 'Activiteit',
  source_gps: 'GPS',
  source_manual: 'Handmatig',
  source_timeline: 'Tijdlijn',

  // Sessiebeoordeling
  review: 'beoordeel',
  session_delete: 'Verwijderen',
  session_delete_confirm_title: 'Sessie verwijderen',
  session_delete_confirm_body:
    'Weet je zeker dat je deze sessie wilt verwijderen? Dit kan niet ongedaan worden gemaakt.',
  session_delete_cancel: 'Annuleren',
  session_review_again: 'Opnieuw beoordelen',
  session_review_anyway: 'Toch beoordelen',
  session_edit_times: '✏️ Tijden bewerken',
  session_edit_title: 'Sessietijden bewerken',
  session_edit_save: '✓ Opslaan & goedkeuren',
  session_edit_hint: 'Opslaan met aangepaste tijden keurt deze sessie automatisch goed.',
  session_swipe_hint: 'Swipe naar links om te bevestigen, naar rechts als je binnen was.',

  // Doelen
  of: 'van',
  daily_goal: 'Dagdoel',
  weekly_goal: 'Weekdoel',

  // Navigatie
  nav_home: 'Home',
  nav_history: 'Geschiedenis',
  nav_events: 'Sessies',
  nav_goals: 'Doelen',
  nav_settings: 'Instellingen',
  nav_weather_settings: 'Weerinstellingen',

  // Dagen van de week (kort, maandag eerst)
  day_mon: 'M',
  day_tue: 'D',
  day_wed: 'W',
  day_thu: 'D',
  day_fri: 'V',
  day_sat: 'Z',
  day_sun: 'Z',

  // Doelenscherm
  goals_edit: 'Bewerken',
  goals_cancel: 'Annuleren',
  goals_save: 'Opslaan',
  goals_quick_select: 'Snel kiezen',
  goals_custom_minutes: 'Aangepast (minuten)',
  goals_placeholder_daily: 'bijv. 40',
  goals_placeholder_weekly: 'bijv. 200',
  goals_invalid_title: 'Ongeldig doel',
  goals_invalid_daily: 'Voer een waarde in tussen 1 en 720 minuten.',
  goals_invalid_weekly: 'Voer een waarde in tussen 1 en 5040 minuten.',
  goals_who_tip:
    'De WHO beveelt minimaal 150 minuten matige buitenactiviteit per week aan — dat is ongeveer 30 minuten per dag op werkdagen.',

  // Sessiescherm
  events_tab_approved: 'Goedgekeurd',
  events_tab_standard: 'Standaard',
  events_tab_all: 'Alles',
  events_toggle_confirmed: 'Bevestigd',
  events_toggle_review: 'Te beoordelen',
  events_toggle_rejected: 'Afgewezen',
  events_none_recorded: 'Nog geen sessies geregistreerd.',
  events_confidence: 'Betrouwbaarheid',
  events_not_outside: '✕ Binnen',
  events_confirm: '✓ Buiten',
  events_confirmed: '✓ Buiten',
  events_rejected: '✕ Binnen',
  events_discarded: 'Verworpen',
  events_proposed: 'Voorgesteld',

  // Geschiedenis scherm
  history_period_week: 'Week',
  history_period_month: 'Maand',
  history_stat_total: 'Totaal',
  history_stat_avg: 'Daggemiddelde',
  history_stat_goals_met: 'Doelen gehaald',
  history_axis_minutes: 'Minuten per dag',
  history_axis_days_week: 'Weekdag',
  history_axis_days_month: 'Dag van de maand',
  history_no_data: 'Geen gegevens voor deze periode',
  history_legend_goal_met: 'Doel gehaald',
  history_legend_below_goal: 'Onder doel',
  history_legend_today: 'Vandaag',
  history_legend_target: 'Doelstelling',

  // Instellingenscherm
  settings_section_detection: 'Detectie',
  settings_section_locations: 'Bekende locaties',
  settings_section_reminders: 'Herinneringen',
  settings_section_language: 'Taal',
  settings_section_about: 'Over',
  settings_health_connect: 'Health Connect',
  settings_health_connect_desc: 'Stappen & activiteit automatisch bijhouden',
  settings_hc_permission_missing: 'Machtigingen ontbreken — tik om te herstellen',
  settings_hc_permission_title: 'Health Connect-toestemming',
  settings_hc_permission_body:
    'Health Connect-machtigingen zijn nodig om buitenactiviteiten automatisch bij te houden via je stappen en workouts.',
  settings_hc_open_btn: 'Health Connect openen',
  settings_hc_failed_title: 'Verbinding mislukt',
  settings_hc_failed_body:
    'Geef TouchGrass machtigingen voor Health Connect:\n\n**Als er een machtigingsdialoog verscheen:**\n• Verleen de gevraagde machtigingen\n• Keer terug naar TouchGrass\n\n**Als er geen dialoog verscheen:**\n1. Open Instellingen → Privacy → Health Connect\n2. Zoek en tik op TouchGrass in de app-lijst\n3. Schakel de gegevenstypen in (Oefening, Stappen, enz.)\n4. Keer terug naar TouchGrass\n\nAls TouchGrass niet verschijnt:\n• Herstart de app en probeer opnieuw\n• Zorg dat Health Connect geïnstalleerd is vanuit Play Store',
  settings_hc_verified_title: 'Succesvol verbonden',
  settings_hc_verified_body:
    'Health Connect machtigingen bevestigd. Je buitenactiviteiten worden nu automatisch bijgehouden.',
  settings_hc_open_error_title: 'Fout',
  settings_hc_open_error_body:
    'Kon Health Connect instellingen niet openen. Open het handmatig vanuit je app-lijst.',
  // GPS permission fout
  settings_error_title: 'Fout',
  settings_error_open_settings_failed: 'Kon instellingen niet openen. Open Instellingen handmatig.',
  settings_gps_permission_required_title: 'GPS-toestemming vereist',
  settings_gps_permission_required_body:
    'Achtergrondlocatie ("Altijd toestaan") is vereist voor GPS-sessiëdetectie. TouchGrass gebruikt geofencing om te detecteren wanneer je bekende binnenlocaties verlaat en terugkeert. Geef de toestemming in Instellingen.',
  settings_permission_cancel: 'Annuleren',
  settings_permission_open: 'Instellingen openen',
  settings_gps: 'GPS-tracking',
  settings_gps_desc: 'Buitenactiviteiten detecteren via locatie',
  settings_gps_permission: 'Toestemming vereist',
  settings_gps_permission_missing: 'Machtigingen ontbreken — tik om te herstellen',
  settings_location_radius: '{{radius}}m straal · {{type}}',
  settings_location_indoor: 'Binnen',
  settings_location_outdoor: 'Buiten',
  settings_location_edit_title: 'Locatie bewerken',
  location_edit_label: 'Locatie naam',
  location_edit_label_placeholder: 'bijv. Thuis, Werk, Sportschool',
  location_edit_radius: 'Geofence straal',
  location_edit_radius_hint: 'Afstand vanaf locatie (10-1000 meter)',
  location_edit_type: 'Locatietype',
  location_edit_error_title: 'Ongeldige invoer',
  location_edit_error_label: 'Voer een locatienaam in.',
  location_edit_error_save: 'Locatie opslaan mislukt. Probeer opnieuw.',
  location_edit_error_delete: 'Locatie verwijderen mislukt. Probeer opnieuw.',
  location_delete_btn: 'Locatie verwijderen',
  location_delete_confirm_title: 'Locatie verwijderen',
  location_delete_confirm_body:
    'Weet je zeker dat je deze locatie wilt verwijderen? Dit kan niet ongedaan worden gemaakt.',
  settings_reminders_label: 'Slimme herinneringen',
  settings_reminders_sublabel: 'Leert je patronen over tijd',
  settings_reminders_count_off: 'Uit',
  settings_reminders_count_per_day: '{{count}}/dag',
  settings_catchup_label: 'Help me mijn doel halen',
  settings_catchup_sublabel: 'Extra herinneringen als je achterloopt',
  settings_catchup_off: 'Uit',
  settings_catchup_mellow: 'Rustig',
  settings_catchup_medium: 'Gemiddeld',
  settings_catchup_aggressive: 'Intensief',
  settings_background_tracking_label: 'Achtergrondtracking melding',
  settings_background_tracking_sublabel:
    'De permanente melding die zichtbaar is terwijl GPS actief is. Uitschakelen via Android Instellingen → Apps → TouchGrass → Meldingen → Achtergrondtracking.',
  settings_app_sublabel: 'Jouw buitentijd-assistent',
  settings_privacy: 'Privacy',
  settings_privacy_sublabel: 'Alle gegevens blijven op je apparaat',
  settings_privacy_hint: 'Tik om ons privacybeleid te lezen',
  settings_clear_data: 'Alle gegevens wissen',
  settings_clear_data_sublabel: 'Verwijder alle sessies en instellingen permanent',
  settings_clear_data_confirm_title: 'Alle gegevens wissen',
  settings_clear_data_confirm_body:
    'Dit verwijdert al je buitensessies, doelen en instellingen permanent. Dit kan niet ongedaan worden gemaakt.',
  settings_clear_cancel: 'Annuleren',
  settings_clear_delete: 'Verwijderen',
  settings_clear_data_success_title: 'Gegevens gewist',
  settings_clear_data_success_body: 'Alle gegevens zijn succesvol gewist.',
  settings_clear_data_error_title: 'Fout',
  settings_clear_data_error_body:
    'Er is een fout opgetreden bij het wissen van gegevens. Probeer het opnieuw.',
  settings_rerun_tutorial: 'Tutorial opnieuw starten',
  settings_rerun_tutorial_sublabel: 'Bekijk de installatiegids opnieuw',

  // Uiterlijk (donkere modus)
  settings_section_appearance: 'Uiterlijk',
  settings_theme_label: 'Thema',
  settings_theme_sublabel: 'Kies je gewenste kleurenschema',
  settings_theme_system: 'Systeemstandaard',
  settings_theme_light: 'Licht',
  settings_theme_dark: 'Donker',

  // Bekende locaties beheer
  nav_known_locations: 'Bekende locaties',
  settings_locations_manage: 'Beheer bekende locaties',
  settings_locations_manage_desc: 'Bekijk voorgestelde plaatsen en beheer bekende locaties',
  settings_locations_suggestions_enabled: 'Nieuwe locaties voorstellen',
  settings_locations_suggestions_desc: 'Detecteer automatisch plaatsen die je vaak bezoekt',
  settings_locations_section_suggested: 'Voorgestelde locaties',
  settings_locations_section_active: 'Actieve locaties',
  settings_location_approve: 'Goedkeuren',
  settings_location_deny: 'Weigeren',
  settings_location_suggested_badge: 'Wacht op goedkeuring',
  settings_location_no_suggestions: 'Nog geen suggesties',
  settings_location_no_suggestions_hint:
    'De app stelt locaties voor nadat je 2+ uur op dezelfde plek bent geweest met GPS actief.',
  settings_location_no_active: 'Geen actieve locaties',
  settings_location_no_active_hint: 'Keur een suggestie goed of voeg handmatig een locatie toe.',
  settings_locations_count: '{{count}} actief',
  settings_location_deny_title: 'Suggestie weigeren',
  settings_location_deny_body:
    'Deze locatiesuggestie wordt verwijderd. De app zal hem niet opnieuw voorstellen.',
  settings_location_deny_confirm: 'Verwijderen',
  settings_location_deny_cancel: 'Annuleren',
  location_suggestion_default_label: 'Voorgestelde locatie',
  location_add_title: 'Locatie toevoegen',
  location_edit_address: 'Dichtstbijzijnde adres',
  location_edit_address_unavailable: 'Adres niet beschikbaar',
  location_edit_address_search_placeholder: 'Adres zoeken…',
  location_edit_address_no_results: 'Geen adressen gevonden',
  location_edit_approve_title: 'Locatie goedkeuren',
  location_edit_approve_confirm: 'Goedkeuren & opslaan',
  location_position_error_title: 'Locatie niet beschikbaar',
  location_position_error_body:
    'Kon je huidige locatie niet ophalen. Zorg dat GPS ingeschakeld is.',
  notif_location_suggestion_title: '📍 Nieuwe locatie gedetecteerd',
  notif_location_suggestion_body:
    'TouchGrass heeft een plek gedetecteerd die je vaak bezoekt. Tik om te beoordelen en een naam te geven.',

  manual_title: 'Buitentijd registreren',
  manual_tab_log: '📝 Sessie achteraf invoeren',
  manual_tab_timer: '⏱ Timer starten',
  manual_start_time: 'Starttijd',
  manual_end_time: 'Eindtijd',
  manual_preview: 'Sessieoverzicht',
  manual_log_btn: '✓ Sessie opslaan',
  manual_timer_ready: 'Tik op start als je naar buiten gaat',
  manual_timer_running: 'Timer loopt — geniet van de buitenlucht! 🌿',
  manual_timer_start: '🌿 Ik ga naar buiten',
  manual_timer_stop: '✓ Ik ben terug',
  manual_timer_cancel: 'Annuleren',
  manual_timer_stopped_hint:
    'Timer gestopt — controleer en pas je sessietijden aan voor het opslaan.',
  manual_invalid_title: 'Ongeldig tijdsbereik',
  manual_invalid_body:
    'Zorg ervoor dat de eindtijd na de starttijd valt en dat de sessie niet langer is dan 12 uur.',

  // Intro/Onboarding
  intro_skip: 'Overslaan',
  intro_next: 'Volgende',
  intro_get_started: 'Aan de slag',
  intro_welcome_title: 'Welkom bij TouchGrass',
  intro_welcome_body: 'Je hulp voor het volgen en bereiken van buitentijddoelen.',
  intro_welcome_feature_1: 'Volg buitentijd automatisch',
  intro_welcome_feature_2: 'Stel dagelijkse doelen in en monitor ze',
  intro_welcome_feature_3: 'Ontvang slimme herinneringen',
  intro_welcome_feature_4: 'Alle gegevens blijven privé op je apparaat',
  intro_privacy_policy: 'Privacybeleid',
  intro_hc_title: 'Health Connect',
  intro_hc_body:
    'TouchGrass gebruikt Health Connect om buitenactiviteiten automatisch te detecteren.',
  intro_hc_why_title: 'Waarom hebben we dit nodig?',
  intro_hc_why_body:
    'Health Connect geeft toegang tot oefensessies van je fitness-apps, waardoor we je buitenactiviteiten zoals wandelen, hardlopen of fietsen kunnen volgen.',
  intro_hc_hint: 'Je kunt deze toestemming later geven in Instellingen.',
  intro_hc_button: 'Verbind Health Connect',
  intro_hc_button_granted: 'Verbonden ✓',
  intro_location_title: 'Locatietoegang',
  intro_location_body:
    'TouchGrass gebruikt je locatie om buitensessies automatisch te detecteren via geofencing.',
  intro_location_why_title: 'Waarom hebben we dit nodig?',
  intro_location_why_body:
    'GPS-tracking gebruikt geofencing om te detecteren wanneer je bekende binnenlocaties (bijv. thuis, werk) verlaat en terugkeert, zodat buitensessies automatisch worden voorgesteld — zelfs wanneer de app gesloten is. "Altijd toestaan" is hiervoor vereist.\n\nAls je weerbewuste herinneringen inschakelt, wordt alleen een geschatte locatie gebruikt om lokale weersomstandigheden op te halen.',
  intro_location_hint:
    'Je wordt gevraagd "Altijd toestaan" te selecteren voor achtergronddetectie.',
  intro_location_button: 'Sta locatie toe',
  intro_location_button_granted: 'Locatie toegestaan ✓',
  intro_location_known_title: 'Verbeter buitendetectie',
  intro_location_known_body:
    'Door je thuis- en werklocatie in te stellen weet TouchGrass waar je meestal binnen bent, wat de detectie sterk verbetert.',
  intro_location_known_set_home: 'Thuis instellen',
  intro_location_known_set_work: 'Werk instellen',
  intro_location_known_set_home_done: '🏠 Thuis ingesteld ✓',
  intro_location_known_set_work_done: '🏢 Werk ingesteld ✓',
  intro_location_known_hint:
    'Je kunt locaties aanpassen en toevoegen via Instellingen → Bekende locaties.',
  intro_notifications_title: 'Herinneringen',
  intro_notifications_body:
    'Ontvang zachte aansporingen om naar buiten te gaan wanneer je ze het meest nodig hebt.',
  intro_notifications_why_title: 'Waarom hebben we dit nodig?',
  intro_notifications_why_body:
    'Slimme herinneringen leren je patronen over tijd en sturen alleen meldingen op nuttige momenten. Je kunt ook geplande herinneringen maken voor specifieke tijden en dagen. Je kunt ze altijd uitschakelen.',
  intro_notifications_hint: 'Volledig optioneel — je kunt dit overslaan.',
  intro_notifications_button: 'Schakel herinneringen in',
  intro_notifications_button_granted: 'Herinneringen ingeschakeld ✓',
  intro_calendar_title: 'Agenda',
  intro_calendar_body:
    'Verbind je agenda zodat TouchGrass buitentijd kan inplannen rondom je afspraken.',
  intro_calendar_why_title: 'Waarom hebben we dit nodig?',
  intro_calendar_why_body:
    'Met toegang tot je agenda vermijdt TouchGrass het sturen van herinneringen als je een afspraak hebt en kan het automatisch buitentijdslots aan je agenda toevoegen.',
  intro_calendar_hint: 'Je kunt dit later configureren in Instellingen.',
  intro_calendar_button: 'Verbind agenda',
  intro_calendar_button_granted: 'Agenda verbonden ✓',
  intro_calendar_buffer_label: 'Afspraakbuffer',
  intro_calendar_buffer_desc: 'Sla herinneringen over als een afspraak binnen dit venster begint',
  intro_calendar_duration_label: 'Buitentijd aan agenda toevoegen',
  intro_calendar_duration_desc: 'Plan automatisch buitentijdslots in',
  intro_ready_title: 'Je bent klaar!',
  intro_ready_body: 'TouchGrass is klaar om je te helpen meer tijd buiten door te brengen.',
  intro_ready_tip_title: 'Snelle tip',
  intro_ready_tip_body:
    'Je kunt altijd handmatig buitensessies loggen vanaf het startscherm als automatische detectie iets mist. Stel geplande herinneringen in via Instellingen → Herinneringen voor terugkerende meldingen.',
  intro_ready_checklist_title: 'Checklist eerste start',
  intro_ready_checklist_item_hc: 'Koppel Health Connect om oefensessies te importeren.',
  intro_ready_checklist_item_gps: 'Sta achtergrondlocatie toe voor GPS-detectie.',
  intro_ready_checklist_item_notifications: 'Schakel meldingen in voor slimme herinneringen.',
  intro_ready_checklist_item_calendar: 'Koppel agenda voor slim inplannen.',

  // Meldingstitels (willekeurig gekozen)
  notif_title_1: '🌿 Tijd om buiten te zijn!',
  notif_title_2: '☀️ Even naar buiten',
  notif_title_3: '🌱 Frisse lucht wacht op je',
  notif_title_4: '👟 Trek je schoenen aan',
  notif_title_5: '🌳 De natuur roept',

  // Meldingsteksten
  notif_body_none: 'Je bent vandaag nog niet buiten geweest. Een korte wandeling telt ook!',
  notif_body_halfway: 'Nog {{remaining}} minuten te gaan. Je kunt het!',
  notif_body_almost: 'Bijna! Nog maar {{remaining}} minuten buiten.',
  notif_body_done: 'Doel bereikt! Zin in een extra rondje? 🌿',

  // Reden-beschrijvingen voor herinneringen ("Waarom nu?" uitleg toegevoegd aan meldingstekst)
  notif_reason_pattern: 'je gaat vaak buiten rond deze tijd',
  notif_reason_lunch: 'lunchtime is een goed moment voor een wandeling',
  notif_reason_after_work: 'na het werk is een goed moment om buiten te gaan',
  notif_reason_urgent: 'je hebt je doel nog niet bereikt vandaag',
  notif_reason_acted: 'je bent eerder buiten geweest rond deze tijd',
  notif_reason_more_often: 'je geeft de voorkeur aan herinneringen rond deze tijd',

  // Streak encouragement for notifications
  notif_streak_daily: "Houd je {{count}} dagen streak vol!",
  notif_streak_weekly: "Behoud je {{count}} weken streak!",
  notif_streak_daily_at_risk: "Breek je {{count}} dagen streak niet!",
  notif_streak_weekly_at_risk: "Breek je {{count}} weken streak niet!",

  // Verbindingswoord tussen twee reden-beschrijvingen ("X, en Y.")
  notif_contributor_and: 'en',
  // Weercontext toegevoegd aan meldingstekst als er geen redenbeschrijvingen beschikbaar zijn
  // {{desc}} = weersomschrijving (bijv. "Zonnig"), {{temp}} = opgemaakte temperatuur (bijv. "22°C")
  notif_weather_context: '{{desc}}, {{temp}} buiten.',

  // Meldingsacties
  notif_action_went_outside: '✅ Gegaan!',
  notif_action_snooze: '⏰ Snooze',
  notif_action_less_often: '🔕 Minder vaak',

  // Bevestigingsberichten na het tikken op een meldingsknop
  notif_confirm_title: 'TouchGrass',
  notif_confirm_went_outside: '✅ Begrepen! Goed bezig.',
  notif_confirm_snoozed: '⏰ Ik herinner je over 30 minuten.',
  notif_confirm_less_often: '🔕 Begrepen! Ik herinner je minder vaak.',

  // Herinneringsmodal uitlegberichten
  notif_feedback_dismiss: 'Begrepen',
  notif_feedback_went_outside_detail: 'We herinneren je vaker rond {{time}}.',
  notif_feedback_snoozed_detail:
    'We herinneren je over 30 minuten, minder vaak om {{time}} en vaker om {{snoozeTime}}.',
  notif_feedback_less_often_detail: 'We herinneren je minder vaak om {{time}}.',

  // Minder-vaak granulaire feedbackmodal
  notif_less_often_title: 'Wat wil je doen?',
  notif_less_often_bad_time: '🕐 Dit was een slecht moment',
  notif_less_often_fewer_reminders: '🔕 Stuur me minder herinneringen',
  notif_fewer_reminders_confirm:
    'Oké, ik stuur je {{newCount}} herinnering(en) per dag in plaats van {{oldCount}}.',
  notif_fewer_reminders_confirm_generic: 'Oké, ik stuur je minder herinneringen.',

  // Weather settings
  settings_weather_title: 'Weer',
  settings_weather_enabled: 'Weerbewuste herinneringen',
  settings_weather_enabled_desc:
    'Houd rekening met weersomstandigheden bij het voorstellen van tijden',
  settings_weather_more: 'Meer weerinstellingen',
  settings_weather_more_desc: 'Temperatuurvoorkeur, regen, hitte, UV',
  settings_weather_permission_title: 'Locatietoestemming',
  settings_weather_permission_missing: 'Machtigingen ontbreken — tik om te herstellen',
  settings_weather_location_permission_missing:
    'Locatietoestemming is nodig om lokaal weer op te halen. Geschatte locatie wordt alleen gebruikt voor weersomstandigheden en wordt nooit opgeslagen.',
  settings_weather_location_request: 'Locatietoegang verlenen',
  settings_temp_preference: 'Klimaatvoorkeur',
  settings_temp_cold: 'Voorkeur voor koeler weer',
  settings_temp_moderate: 'Gematigd klimaat',
  settings_temp_hot: 'Voorkeur voor warmer weer',
  settings_weather_avoid_rain: 'Vermijd regenachtige tijden',
  settings_weather_avoid_heat: 'Vermijd extreme hitte',
  settings_weather_consider_uv: 'Houd rekening met UV-index',
  settings_weather_current: 'Huidig weer',
  settings_weather_unavailable: 'Weergegevens niet beschikbaar',
  settings_weather_error: 'Weer ophalen mislukt',
  settings_weather_refresh: 'Weer verversen',

  // Weersomstandigheden
  weather_clear_sky: 'Heldere hemel',
  weather_mainly_clear: 'Grotendeels helder',
  weather_partly_cloudy: 'Gedeeltelijk bewolkt',
  weather_overcast: 'Bewolkt',
  weather_foggy: 'Mistig',
  weather_drizzle: 'Motregen',
  weather_rain: 'Regen',
  weather_snow: 'Sneeuw',
  weather_rain_showers: 'Regenbuien',
  weather_snow_showers: 'Sneeuwbuien',
  weather_thunderstorm: 'Onweer',
  weather_unknown: 'Onbekend',

  // Meldingskanaal
  notif_channel_name: 'Buitenherinneringen',
  notif_channel_background_name: 'Achtergrondtracking',
  notif_channel_background_desc:
    'Zichtbaar terwijl TouchGrass je buitentijd bijhoudt. Kan worden uitgeschakeld zonder invloed op herinneringen.',
  notif_channel_scheduled_name: 'Geplande herinneringen',
  notif_channel_scheduled_desc: 'Je aangepaste geplande herinneringen om naar buiten te gaan',
  notif_channel_daily_planner_name: 'Dagelijkse planner',
  notif_channel_daily_planner_desc:
    'Stille 3 uur-wekker om je dagelijkse herinneringen opnieuw in te plannen. Kan volledig worden uitgeschakeld in de Android-notificatie-instellingen.',
  notif_daily_planner_title: 'TouchGrass',
  notif_daily_planner_body: 'Open de app om de planning voor vandaag te voltooien.',

  // Scheduled notifications
  scheduled_notif_body: 'Je geplande herinnering om naar buiten te gaan.',
  scheduled_empty: 'Nog geen geplande herinneringen',
  scheduled_empty_hint: 'Tik op de + knop om een terugkerende herinnering aan te maken',
  scheduled_add: 'Herinnering toevoegen',
  scheduled_add_title: 'Nieuwe geplande herinnering',
  scheduled_edit: 'Bewerken',
  scheduled_edit_title: 'Herinnering bewerken',
  scheduled_delete: 'Verwijderen',
  scheduled_delete_confirm_title: 'Herinnering verwijderen',
  scheduled_delete_confirm_body: 'Weet je zeker dat je deze herinnering wilt verwijderen?',
  scheduled_delete_cancel: 'Annuleren',
  scheduled_delete_confirm: 'Verwijderen',
  scheduled_cancel: 'Annuleren',
  scheduled_save: 'Opslaan',
  scheduled_time: 'Tijd',
  scheduled_days: 'Dagen',
  scheduled_select_all: 'Alle dagen',
  scheduled_label: 'Label (optioneel)',
  scheduled_label_placeholder: 'bijv., Ochtendwandeling',
  scheduled_all_days: 'Elke dag',
  scheduled_weekdays: 'Weekdagen',
  scheduled_error_title: 'Fout',
  scheduled_error_no_days: 'Selecteer minstens één dag',
  settings_scheduled_reminders: 'Geplande herinneringen',
  settings_scheduled_reminders_sublabel: 'Maak terugkerende herinneringen voor specifieke tijden',

  // Kalenderintegratie
  settings_section_calendar: 'Agenda',
  settings_calendar_integration: 'Agendaïntegratie',
  settings_calendar_integration_desc:
    'Controleer je agenda om herinneringen te vermijden tijdens afspraken',
  settings_calendar_permission_title: 'Agendatoestemming',
  settings_calendar_permission_missing: 'Machtigingen ontbreken — tik om te herstellen',
  settings_calendar_permission_body:
    'Toegang tot de agenda is nodig om je afspraken te controleren voor slimme herinneringen.',
  settings_calendar_permission_open: 'Instellingen openen',
  settings_calendar_permission_cancel: 'Annuleren',
  settings_calendar_buffer: 'Afspraakbuffer',
  settings_calendar_buffer_desc:
    'Sla slimme herinneringen over als een afspraak binnen dit venster begint',
  settings_calendar_buffer_minutes: '{{minutes}} minuten',
  settings_calendar_duration: 'Buitentijd in agenda',
  settings_calendar_duration_desc: 'Duur bij het toevoegen van buitentijd aan de agenda',
  settings_calendar_duration_off: 'Uit',
  settings_calendar_duration_minutes: '{{minutes}} min',
  settings_calendar_select: 'Buitentijd opslaan in',
  settings_calendar_select_desc: 'Agenda waar buitentijdslots worden opgeslagen',
  settings_calendar_select_title: 'Agenda selecteren',
  settings_calendar_select_touchgrass: 'TouchGrass (lokaal)',
  calendar_event_title: '🌿 Buitentijd',
  calendar_event_notes: 'Gepland door TouchGrass',
  calendar_touchgrass_name: 'TouchGrass',

  // Feedback & ondersteuning scherm
  nav_feedback_support: 'Feedback & Ondersteuning',
  feedback_send_feedback: 'Feedback sturen',
  feedback_send_feedback_sublabel: 'Deel een bugrapport, idee of algemene feedback',
  feedback_support_kofi: 'Jolly Heron steunen',
  feedback_support_kofi_sublabel: 'Trakteer me op een kopje koffie — elke bijdrage helpt ☕',
  settings_feedback_support: 'Feedback & Ondersteuning',
  settings_feedback_support_sublabel: 'Stuur feedback of steun de ontwikkelaar',

  // Foutgrens crashscherm
  error_boundary_title: 'Er is iets misgegaan',
  error_boundary_subtitle:
    'De app is vastgelopen door een onverwachte fout. Probeer de app opnieuw te starten of meld het probleem zodat we het kunnen oplossen. Melden deelt je apparaattype en appversie met Google Formulieren.',
  error_boundary_restart: 'App herstarten',
  error_boundary_report: 'Probleem melden',

  // Background Task
  background_task_title: 'Slimme Herinneringen',
  background_task_desc:
    'Controleren wat de beste tijd is om je te herinneren om naar buiten te gaan.',

  // Batterij-optimalisatie (Android intro)
  intro_battery_title: 'Achtergrondactiviteit',
  intro_battery_body:
    'Voor betrouwbare herinneringen, zelfs als de app gesloten is, heeft TouchGrass onbeperkte achtergrondactiviteit nodig.',
  intro_battery_why_title: 'Waarom is dit nodig?',
  intro_battery_why_body:
    'Sommige telefoonfabrikanten beperken achtergrondapps agressief om batterij te besparen. Zonder deze instelling kunnen je herinneringen vertraagd worden of helemaal niet aankomen.',
  intro_battery_button: 'Open batterij-instellingen',
  intro_battery_button_done: 'Instellingen geopend ✓',
  intro_battery_hint:
    'Zoek TouchGrass in de lijst en selecteer "Onbeperkt". Je kunt dit overslaan en later wijzigen in Instellingen.',

  // Instellingen batterij-optimalisatie
  settings_battery_optimization: 'Batterij-optimalisatie',
  settings_battery_optimization_sublabel:
    'TouchGrass is zeer zuinig — maar Android kan achtergrondapps agressief blokkeren. Ga naar Batterij → Batterijoptimalisatie → zoek TouchGrass → kies Onbeperkt.',

  // Intro checklist
  intro_ready_checklist_item_battery: 'Stel batterij-optimalisatie in op "Onbeperkt".',

  // Taal-/datumopmaak
  locale_tag: 'nl-NL',

  // Sessie-omschrijvingen (opgeslagen bij elke sessie om de detectiemethode te omschrijven)
  session_notes_manual: 'Handmatig ingevoerd.',
  // GPS-omschrijvingen — {{dist}} = numerieke afstand, {{distUnit}} = "km" of "mi",
  //                      {{speed}} = numerieke snelheid, {{speedUnit}} = "km/u" of "mph"
  session_notes_gps_left_returned:
    'GPS-detectie, vertrokken bij {{start}} en teruggekeerd na {{dist}} {{distUnit}} bij {{speed}} {{speedUnit}}.',
  session_notes_gps_left_went:
    'GPS-detectie, vertrokken bij {{start}} en gegaan naar {{end}} na {{dist}} {{distUnit}} bij {{speed}} {{speedUnit}}.',
  session_notes_gps_left:
    'GPS-detectie, vertrokken bij {{start}} na {{dist}} {{distUnit}} bij {{speed}} {{speedUnit}}.',
  session_notes_gps_returned:
    'GPS-detectie, teruggekeerd bij {{end}} na {{dist}} {{distUnit}} bij {{speed}} {{speedUnit}}.',
  session_notes_gps_no_location: 'GPS-detectie, {{dist}} {{distUnit}} bij {{speed}} {{speedUnit}}.',
  // Health Connect-omschrijvingen — {{steps}} = opgemaakt getal, {{speed}} = numerieke snelheid, {{speedUnit}} = "km/u" of "mph"
  session_notes_hc_steps: 'Health Connect, {{steps}} stappen bij {{speed}} {{speedUnit}}.',
  session_notes_hc_exercise: 'Health Connect, {{exerciseName}}.',
  // Snelheidseenheid voor het meetsysteem van het apparaat (in de code vervangen door "mph" voor imperiale regio's)
  unit_speed_metric: 'km/u',
  unit_speed_imperial: 'mph',
  // Namen van activiteitstypen (Health Connect integer → weergavenaam)
  exercise_badminton: 'badminton',
  exercise_baseball: 'honkbal',
  exercise_basketball: 'basketbal',
  exercise_biking: 'fietsen',
  exercise_cricket: 'cricket',
  exercise_american_football: 'American football',
  exercise_australian_football: 'Australisch voetbal',
  exercise_frisbee: 'frisbee',
  exercise_golf: 'golf',
  exercise_handball: 'handbal',
  exercise_hiking: 'wandelen',
  exercise_ice_hockey: 'ijshockey',
  exercise_ice_skating: 'schaatsen',
  exercise_paddling: 'peddelen',
  exercise_paragliding: 'paragliding',
  exercise_rock_climbing: 'rotsklimmen',
  exercise_roller_hockey: 'rollerhockey',
  exercise_rowing: 'roeien',
  exercise_rugby: 'rugby',
  exercise_running: 'hardlopen',
  exercise_sailing: 'zeilen',
  exercise_scuba_diving: 'duiken',
  exercise_skating: 'skeeleren',
  exercise_skiing: 'skiën',
  exercise_snowboarding: 'snowboarden',
  exercise_snowshoeing: 'sneeuwschoenwandelen',
  exercise_soccer: 'voetbal',
  exercise_softball: 'softball',
  exercise_surfing: 'surfen',
  exercise_open_water_swimming: 'open water zwemmen',
  exercise_tennis: 'tennis',
  exercise_volleyball: 'volleybal',
  exercise_walking: 'wandelen',
  exercise_water_polo: 'waterpolo',
  exercise_wheelchair: 'rolstoel',
  exercise_unknown: 'activiteitstype {{type}}',
};
