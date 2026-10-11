// Shared small UI bits for the wardrobe app.
// Tailwind preflight is OFF and styles/globals.css styles bare buttons/inputs,
// so every control here sets its own border/background/padding explicitly
// (including active:/focus: variants that override the global button:active/focus rules).

export const BTN_BASE =
  'tw-inline-flex tw-items-center tw-justify-center tw-gap-2 tw-min-h-[44px] tw-px-4 tw-rounded-xl tw-text-[15px] tw-font-medium tw-leading-none tw-cursor-pointer tw-select-none tw-transition-colors tw-outline-none disabled:tw-opacity-50 disabled:tw-cursor-not-allowed focus-visible:tw-ring-2 focus-visible:tw-ring-stone-400 focus-visible:tw-ring-offset-2'

export const BTN_PRIMARY = `${BTN_BASE} tw-border tw-border-solid tw-border-stone-900 focus:tw-border-stone-900 tw-bg-stone-900 active:tw-bg-stone-700 tw-text-white`

export const BTN_SECONDARY = `${BTN_BASE} tw-border tw-border-solid tw-border-stone-300 focus:tw-border-stone-300 tw-bg-white active:tw-bg-stone-100 tw-text-stone-900`

export const BTN_GHOST = `${BTN_BASE} tw-border tw-border-solid tw-border-transparent focus:tw-border-transparent tw-bg-transparent active:tw-bg-stone-100 tw-text-stone-600`

export const BTN_DANGER = `${BTN_BASE} tw-border tw-border-solid tw-border-rose-200 focus:tw-border-rose-200 tw-bg-white active:tw-bg-rose-50 tw-text-rose-700`

export const INPUT =
  'tw-block tw-w-full tw-m-0 tw-px-3.5 tw-py-3 tw-rounded-xl tw-border tw-border-solid tw-border-stone-300 tw-bg-white tw-text-base tw-leading-snug tw-text-stone-900 tw-placeholder-stone-400 tw-outline-none focus:tw-border-stone-900 focus:tw-ring-1 focus:tw-ring-stone-900'

export function Select({ className = '', children, ...props }) {
  return (
    <div className="tw-relative">
      <select {...props} className={`${INPUT} tw-appearance-none tw-pr-9 ${className}`}>
        {children}
      </select>
      <span aria-hidden className="tw-pointer-events-none tw-absolute tw-right-3.5 tw-top-1/2 -tw-translate-y-1/2 tw-text-xs tw-text-stone-500">
        ▼
      </span>
    </div>
  )
}

export const LABEL = 'tw-block tw-mb-1.5 tw-text-xs tw-font-semibold tw-uppercase tw-tracking-wider tw-text-stone-500'

export const CARD = 'tw-bg-white tw-rounded-2xl tw-border tw-border-solid tw-border-stone-200'

export function Spinner({ className = 'tw-w-5 tw-h-5', light = false }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`tw-inline-block tw-shrink-0 tw-rounded-full tw-border-2 tw-border-solid tw-animate-spin ${
        light ? 'tw-border-white/30 tw-border-t-white' : 'tw-border-stone-200 tw-border-t-stone-800'
      } ${className}`}
    />
  )
}

export function ErrorBanner({ message, onRetry, onDismiss }) {
  if (!message) return null
  return (
    <div
      role="alert"
      className="tw-flex tw-items-start tw-gap-3 tw-rounded-xl tw-border tw-border-solid tw-border-rose-200 tw-bg-rose-50 tw-px-4 tw-py-3"
    >
      <p className="tw-flex-1 tw-text-sm tw-leading-snug tw-text-rose-800 tw-whitespace-pre-line">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="tw-shrink-0 tw-m-0 tw-p-0 tw-border-0 tw-bg-transparent active:tw-bg-transparent tw-text-sm tw-font-semibold tw-text-rose-800 tw-underline tw-cursor-pointer"
        >
          Retry
        </button>
      )}
      {onDismiss && (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          className="tw-shrink-0 tw-m-0 tw-p-0 tw-w-6 tw-h-6 tw-border-0 tw-bg-transparent active:tw-bg-transparent tw-text-rose-700 tw-text-lg tw-leading-none tw-cursor-pointer"
        >
          ×
        </button>
      )}
    </div>
  )
}

export function Notice({ children }) {
  return (
    <div className="tw-rounded-xl tw-border tw-border-solid tw-border-amber-200 tw-bg-amber-50 tw-px-4 tw-py-3 tw-text-sm tw-leading-snug tw-text-amber-900">
      {children}
    </div>
  )
}

export function SectionTitle({ children, right }) {
  return (
    <div className="tw-flex tw-items-end tw-justify-between tw-gap-3 tw-mb-3">
      <h2 className="tw-m-0 tw-font-serif tw-text-xl tw-font-normal tw-text-stone-900">{children}</h2>
      {right}
    </div>
  )
}

export const CATEGORY_LABEL = {
  top: 'Top',
  bottom: 'Bottom',
  shoes: 'Shoes',
  outerwear: 'Outerwear',
  accessory: 'Accessory',
}

export const FORMALITY_LABEL = {
  casual: 'Casual',
  smart_casual: 'Smart casual',
  formal: 'Formal',
}
