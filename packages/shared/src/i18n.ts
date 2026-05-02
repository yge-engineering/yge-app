// Lightweight i18n — locale + dictionary + lookup helper.
//
// Plain English: project plan v6.2 ships English + Spanish across
// every screen. This is the minimum viable substrate — a Locale
// type, a dictionary shape, a t() helper that takes a key + locale
// + optional vars and returns the translated string.
//
// Future (when bilingual rollout starts in earnest): the
// dictionaries probably move to JSON files generated from the
// source en.ts at build time, the t() helper grows pluralization
// + ICU-style format support, and React gets a LocaleProvider /
// useLocale hook layered on top. The data shape here is the
// stable contract; swapping the engine doesn't break callers.

export const SUPPORTED_LOCALES = ['en', 'es'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

/** Per-locale flat key/value map. Keys are dotted paths
 *  ('app.title', 'audit.empty', 'estimate.coach.cleanToSubmit'). */
export type LocaleDictionary = Record<string, string>;

/** Full bilingual dictionary keyed by Locale. */
export type DictionaryByLocale = Record<Locale, LocaleDictionary>;

/**
 * Look up a translated string. Falls back to the English value
 * when the requested locale doesn't carry the key, and to the
 * raw key string when neither does — that's the obvious
 * 'translation missing' visual signal in dev.
 *
 * Vars are interpolated via {name} placeholders. Missing vars
 * leave the placeholder visible so the bug is loud.
 */
export function translate(
  dict: DictionaryByLocale,
  locale: Locale,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const localized = dict[locale]?.[key];
  const fallback = dict[DEFAULT_LOCALE]?.[key];
  let raw = localized ?? fallback ?? key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      raw = raw.replace(new RegExp(`\\{${name}\\}`, 'g'), String(value));
    }
  }
  return raw;
}

/** Whether a string parses as a known Locale. Used at the cookie /
 *  query-param boundary so untrusted input doesn't seep into the
 *  rest of the system. */
export function isLocale(s: unknown): s is Locale {
  return typeof s === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(s);
}

/** Coerce an unknown value into a Locale, defaulting on
 *  unrecognized input. */
export function coerceLocale(s: unknown): Locale {
  return isLocale(s) ? s : DEFAULT_LOCALE;
}

/** Plain-English label for the locale switcher UI. Shipped here so
 *  every consumer agrees on what to show on the chip. */
export function localeLabel(l: Locale): string {
  switch (l) {
    case 'en': return 'English';
    case 'es': return 'Español';
  }
}

// ---- Starter dictionary -------------------------------------------------

/**
 * Seed dictionary. Phase 1 keeps it tight — header chrome, common
 * buttons, the empty / saved / loading states that recur across pages.
 * Per-page copy gets translated as each page is touched.
 *
 * When in doubt, keep keys structured by feature area
 * ('app.', 'audit.', 'bid.', 'estimate.', 'time.', etc.).
 */
export const SEED_DICTIONARY: DictionaryByLocale = {
  en: {
    'app.title': 'YGE',
    'app.tagline': 'Heavy civil contractors',
    'common.save': 'Save',
    'common.saving': 'Saving…',
    'common.saved': 'Saved',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.add': 'Add',
    'common.remove': 'Remove',
    'common.required': 'Required',
    'common.optional': 'Optional',
    'common.loading': 'Loading…',
    'common.search': 'Search',
    'common.back': 'Back',
    'common.confirm': 'Confirm',
    'common.unsavedChanges': 'Unsaved changes.',
    'common.viewAll': 'View all',
    'common.openInAuditLog': 'Open in audit log',
    'common.signIn': 'Sign in',
    'common.signOut': 'Sign out',
    'audit.empty': 'No audit events recorded for this record yet.',
    'audit.title': 'Audit history',
    'estimate.coach.run': 'Run pre-submit check',
    'estimate.coach.clean': 'Clean — every check passed',
    'estimate.coach.blockers': '{count} blocker{plural} before submit',
    'master.profile.title': 'Master business profile',
    'master.profile.identity': 'Identity',
    'master.profile.address': 'Address + contact',
    'master.profile.officers': 'Officers',
    'master.profile.bonding': 'Bonding profile',
    'master.profile.insurance': 'Insurance policies',
    'master.profile.diversity': 'Diversity certifications',
    'sign.affirm': 'Affirm',
    'sign.disclosure': 'Disclosure',
    'sign.button': 'Sign',
    'sign.signing': 'Signing…',
    'sign.signed': 'Signed and verified',
    'dashboard.greeting.morning': 'Good morning',
    'dashboard.greeting.afternoon': 'Good afternoon',
    'dashboard.greeting.evening': 'Good evening',
    'dashboard.activeJobs': '{count} active jobs',
    'dashboard.allModules': 'All modules',
    'dashboard.apiUnreachable.title': 'API not reachable',
    'dashboard.quickAction.newJob.label': 'New job',
    'dashboard.quickAction.newJob.sub': 'Start a bid pursuit',
    'dashboard.quickAction.newDailyReport.label': 'New daily report',
    'dashboard.quickAction.newDailyReport.sub': 'Log today’s crew + scope',
    'dashboard.quickAction.newArInvoice.label': 'New AR invoice',
    'dashboard.quickAction.newArInvoice.sub': 'Bill a customer',
    'dashboard.quickAction.newTimeCard.label': 'New time card',
    'dashboard.quickAction.newTimeCard.sub': 'Submit your week',
    'dashboard.compliance.heatGaps': '§3395 heat gaps',
    'dashboard.compliance.heatGaps.ok': 'No gaps',
    'dashboard.compliance.swpppDef': 'SWPPP open deficiencies',
    'dashboard.compliance.swpppDef.ok': 'No open BMP issues',
    'dashboard.compliance.punchSafety': 'Punch — open safety',
    'dashboard.compliance.punchSafety.ok': 'No safety items open',
    'dashboard.compliance.dispatchConflicts': 'Today’s dispatch conflicts',
    'dashboard.compliance.dispatchConflicts.ok': 'No double-bookings',
    'dashboard.card.todayDispatch': 'Today’s dispatch',
    'dashboard.card.todayDispatch.empty': 'Nothing on the board for today.',
    'dashboard.card.cashPosition': 'Cash position',
    'dashboard.card.openItems': 'Open items',
    'dashboard.card.crewsToday': 'Crews on today',
    'dashboard.card.quickActions': 'Quick actions',
    'dashboard.kv.arOutstanding': 'AR outstanding',
    'dashboard.kv.collectedLifetime': 'Collected (lifetime)',
    'dashboard.kv.apUnpaid': 'AP unpaid',
    'dashboard.kv.retentionReleased': 'Retention released',
    'dashboard.kv.openRfis': 'Open RFIs',
    'dashboard.kv.openSubmittals': 'Open submittals',
    'dashboard.kv.openPunchItems': 'Open punch items',
    'dashboard.kv.unsignedUncondWaivers': 'Unsigned uncond. waivers',
    'dashboard.kv.todayJobs': 'Today jobs',
    'dashboard.kv.crewHeadcount': 'Crew headcount',
    'dashboard.kv.equipmentOut': 'Equipment out',
    'dashboard.warn.overdue': '{count} overdue',
    'dashboard.warn.uncondCaution': "don’t sign uncond. before funds clear",
    'dashboard.quickLink.newDispatch': 'New dispatch',
    'dashboard.quickLink.dailyReport': 'Daily report',
    'dashboard.quickLink.toolboxTalk': 'Toolbox talk',
    'dashboard.quickLink.swpppInspection': 'SWPPP inspection',
    'dashboard.quickLink.logWeather': 'Log weather',
    'dashboard.quickLink.logIncident': 'Log incident',
    'dashboard.quickLink.recordPayment': 'Record payment',
    'dashboard.quickLink.newPco': 'New PCO',
    'dashboard.quickLink.newRfi': 'New RFI',
    'dashboard.addDispatch': 'Add a dispatch',
    'jobs.title': 'Jobs',
    'jobs.subtitle': 'Every project YGE is tracking — prospects, active pursuits, submitted bids, and awarded jobs. Open one to see its drafts and priced estimates.',
    'jobs.newJob': '+ New job',
    'jobs.filter.all': 'All',
    'jobs.filter.active': 'Active',
    'jobs.filter.pursuing': 'Pursuing',
    'jobs.filter.bidSubmitted': 'Bid submitted',
    'jobs.filter.awarded': 'Awarded',
    'jobs.filter.lostNoBid': 'Lost / no bid',
    'jobs.filter.archived': 'Archived',
    'jobs.fetchError.title': 'Couldn’t load jobs from the API',
    'jobs.empty': 'No jobs yet.',
    'jobs.createFirst': 'Create your first one',
    'jobs.noneMatch': 'No jobs match the “{preset}” filter.',
    'jobs.showAll': 'Show all',
    'jobs.col.project': 'Project',
    'jobs.col.status': 'Status',
    'jobs.col.type': 'Type',
    'jobs.col.contract': 'Contract',
    'jobs.col.due': 'Due',
    'jobs.col.engineerEstimate': 'Engineer’s estimate',
    'jobs.open': 'Open',
    'ar.title': 'Customer invoices (AR)',
    'ar.subtitle': 'Outgoing bills to customers and agencies. Pull line items from daily reports for monthly billing (e.g. Cal Fire), or build manually for progress + lump-sum jobs.',
    'ar.downloadCsv': 'Download CSV',
    'ar.newInvoice': '+ New invoice',
    'ar.tile.outstanding': 'Outstanding',
    'ar.tile.drafts': 'Drafts',
    'ar.tile.sent': 'Sent',
    'ar.tile.paidLifetime': 'Paid (lifetime)',
    'ar.filter.status': 'Status:',
    'ar.filter.all': 'All',
    'ar.empty.title': 'No invoices match',
    'ar.empty.body': 'Create one from a daily-report rollup or as a one-off progress / lump-sum bill. Anything you bill here flows into the cash forecast.',
    'ar.empty.action': 'New invoice',
    'ar.col.number': '#',
    'ar.col.customer': 'Customer',
    'ar.col.job': 'Job',
    'ar.col.period': 'Period',
    'ar.col.date': 'Date',
    'ar.col.total': 'Total',
    'ar.col.balance': 'Balance',
    'ar.col.status': 'Status',
    'ar.balance.paid': 'paid',
  },
  es: {
    'app.title': 'YGE',
    'app.tagline': 'Contratistas de obra civil pesada',
    'common.save': 'Guardar',
    'common.saving': 'Guardando…',
    'common.saved': 'Guardado',
    'common.cancel': 'Cancelar',
    'common.delete': 'Eliminar',
    'common.edit': 'Editar',
    'common.add': 'Agregar',
    'common.remove': 'Quitar',
    'common.required': 'Requerido',
    'common.optional': 'Opcional',
    'common.loading': 'Cargando…',
    'common.search': 'Buscar',
    'common.back': 'Volver',
    'common.confirm': 'Confirmar',
    'common.unsavedChanges': 'Cambios sin guardar.',
    'common.viewAll': 'Ver todo',
    'common.openInAuditLog': 'Abrir en el registro de auditoría',
    'common.signIn': 'Iniciar sesión',
    'common.signOut': 'Cerrar sesión',
    'audit.empty': 'Aún no se han registrado eventos de auditoría para este registro.',
    'audit.title': 'Historial de auditoría',
    'estimate.coach.run': 'Verificación previa al envío',
    'estimate.coach.clean': 'Limpio — toda verificación aprobada',
    'estimate.coach.blockers': '{count} bloqueador{plural} antes de enviar',
    'master.profile.title': 'Perfil maestro de la empresa',
    'master.profile.identity': 'Identidad',
    'master.profile.address': 'Dirección y contacto',
    'master.profile.officers': 'Directivos',
    'master.profile.bonding': 'Perfil de fianzas',
    'master.profile.insurance': 'Pólizas de seguro',
    'master.profile.diversity': 'Certificaciones de diversidad',
    'sign.affirm': 'Afirmar',
    'sign.disclosure': 'Divulgación',
    'sign.button': 'Firmar',
    'sign.signing': 'Firmando…',
    'sign.signed': 'Firmado y verificado',
    'dashboard.greeting.morning': 'Buenos días',
    'dashboard.greeting.afternoon': 'Buenas tardes',
    'dashboard.greeting.evening': 'Buenas noches',
    'dashboard.activeJobs': '{count} trabajos activos',
    'dashboard.allModules': 'Todos los módulos',
    'dashboard.apiUnreachable.title': 'API no disponible',
    'dashboard.quickAction.newJob.label': 'Nuevo trabajo',
    'dashboard.quickAction.newJob.sub': 'Iniciar una licitación',
    'dashboard.quickAction.newDailyReport.label': 'Nuevo reporte diario',
    'dashboard.quickAction.newDailyReport.sub': 'Registrar cuadrilla y alcance del día',
    'dashboard.quickAction.newArInvoice.label': 'Nueva factura AR',
    'dashboard.quickAction.newArInvoice.sub': 'Facturar a un cliente',
    'dashboard.quickAction.newTimeCard.label': 'Nueva tarjeta de tiempo',
    'dashboard.quickAction.newTimeCard.sub': 'Enviar tu semana',
    'dashboard.compliance.heatGaps': 'Brechas §3395 calor',
    'dashboard.compliance.heatGaps.ok': 'Sin brechas',
    'dashboard.compliance.swpppDef': 'Deficiencias SWPPP abiertas',
    'dashboard.compliance.swpppDef.ok': 'Sin BMP abiertas',
    'dashboard.compliance.punchSafety': 'Punch — seguridad abierta',
    'dashboard.compliance.punchSafety.ok': 'Sin ítems de seguridad abiertos',
    'dashboard.compliance.dispatchConflicts': 'Conflictos de despacho de hoy',
    'dashboard.compliance.dispatchConflicts.ok': 'Sin doble-asignaciones',
    'dashboard.card.todayDispatch': 'Despacho de hoy',
    'dashboard.card.todayDispatch.empty': 'Nada en el tablero para hoy.',
    'dashboard.card.cashPosition': 'Posición de efectivo',
    'dashboard.card.openItems': 'Ítems abiertos',
    'dashboard.card.crewsToday': 'Cuadrillas hoy',
    'dashboard.card.quickActions': 'Acciones rápidas',
    'dashboard.kv.arOutstanding': 'AR pendiente',
    'dashboard.kv.collectedLifetime': 'Cobrado (histórico)',
    'dashboard.kv.apUnpaid': 'AP sin pagar',
    'dashboard.kv.retentionReleased': 'Retención liberada',
    'dashboard.kv.openRfis': 'RFIs abiertos',
    'dashboard.kv.openSubmittals': 'Submittals abiertos',
    'dashboard.kv.openPunchItems': 'Ítems de punch abiertos',
    'dashboard.kv.unsignedUncondWaivers': 'Renuncias incond. sin firmar',
    'dashboard.kv.todayJobs': 'Trabajos hoy',
    'dashboard.kv.crewHeadcount': 'Personal de cuadrilla',
    'dashboard.kv.equipmentOut': 'Equipo desplegado',
    'dashboard.warn.overdue': '{count} vencidos',
    'dashboard.warn.uncondCaution': 'no firmes incond. antes de que los fondos se acrediten',
    'dashboard.quickLink.newDispatch': 'Nuevo despacho',
    'dashboard.quickLink.dailyReport': 'Reporte diario',
    'dashboard.quickLink.toolboxTalk': 'Charla de seguridad',
    'dashboard.quickLink.swpppInspection': 'Inspección SWPPP',
    'dashboard.quickLink.logWeather': 'Registrar clima',
    'dashboard.quickLink.logIncident': 'Registrar incidente',
    'dashboard.quickLink.recordPayment': 'Registrar pago',
    'dashboard.quickLink.newPco': 'Nuevo PCO',
    'dashboard.quickLink.newRfi': 'Nuevo RFI',
    'dashboard.addDispatch': 'Agregar un despacho',
    'jobs.title': 'Trabajos',
    'jobs.subtitle': 'Cada proyecto que YGE rastrea — prospectos, persecuciones activas, ofertas enviadas y trabajos adjudicados. Abre uno para ver sus borradores y estimados con precios.',
    'jobs.newJob': '+ Nuevo trabajo',
    'jobs.filter.all': 'Todos',
    'jobs.filter.active': 'Activos',
    'jobs.filter.pursuing': 'En persecución',
    'jobs.filter.bidSubmitted': 'Oferta enviada',
    'jobs.filter.awarded': 'Adjudicado',
    'jobs.filter.lostNoBid': 'Perdido / sin oferta',
    'jobs.filter.archived': 'Archivado',
    'jobs.fetchError.title': 'No se pudieron cargar los trabajos desde la API',
    'jobs.empty': 'Aún no hay trabajos.',
    'jobs.createFirst': 'Crea el primero',
    'jobs.noneMatch': 'Ningún trabajo coincide con el filtro "{preset}".',
    'jobs.showAll': 'Mostrar todos',
    'jobs.col.project': 'Proyecto',
    'jobs.col.status': 'Estado',
    'jobs.col.type': 'Tipo',
    'jobs.col.contract': 'Contrato',
    'jobs.col.due': 'Vence',
    'jobs.col.engineerEstimate': 'Estimado del ingeniero',
    'jobs.open': 'Abrir',
    'ar.title': 'Facturas a clientes (AR)',
    'ar.subtitle': 'Facturas salientes a clientes y agencias. Toma renglones desde los reportes diarios para facturación mensual (p. ej. Cal Fire), o constrúyelas a mano para trabajos por avance o suma alzada.',
    'ar.downloadCsv': 'Descargar CSV',
    'ar.newInvoice': '+ Nueva factura',
    'ar.tile.outstanding': 'Pendiente',
    'ar.tile.drafts': 'Borradores',
    'ar.tile.sent': 'Enviadas',
    'ar.tile.paidLifetime': 'Pagado (histórico)',
    'ar.filter.status': 'Estado:',
    'ar.filter.all': 'Todos',
    'ar.empty.title': 'Ninguna factura coincide',
    'ar.empty.body': 'Crea una desde un reporte diario o como una factura puntual de avance/suma alzada. Lo que factures aquí fluye al pronóstico de efectivo.',
    'ar.empty.action': 'Nueva factura',
    'ar.col.number': '#',
    'ar.col.customer': 'Cliente',
    'ar.col.job': 'Trabajo',
    'ar.col.period': 'Periodo',
    'ar.col.date': 'Fecha',
    'ar.col.total': 'Total',
    'ar.col.balance': 'Saldo',
    'ar.col.status': 'Estado',
    'ar.balance.paid': 'pagada',
  },
};

/**
 * Convenience: pre-bound translator for one locale + dictionary.
 * Saves the per-call dictionary arg in tight render loops.
 */
export function makeTranslator(
  dict: DictionaryByLocale,
  locale: Locale,
): (key: string, vars?: Record<string, string | number>) => string {
  return (key, vars) => translate(dict, locale, key, vars);
}
