import { forwardRef, useState } from 'react';
import './LoadingButton.css';

const LoadingButton = forwardRef(function LoadingButton({
  loading: controlledLoading,
  loadingLabel = 'Working…',
  children,
  disabled,
  onClick,
  spinnerOnly = false,
  ...props
}, ref) {
  const [internalLoading, setInternalLoading] = useState(false);
  const loading = controlledLoading ?? internalLoading;

  const handleClick = (event) => {
    if (!onClick || loading) return;
    const result = onClick(event);

    if (controlledLoading === undefined && result && typeof result.finally === 'function') {
      setInternalLoading(true);
      result.then(
        () => setInternalLoading(false),
        () => setInternalLoading(false),
      );
    }
  };

  return (
    <button
      {...props}
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      onClick={handleClick}
    >
      {loading ? (
        <>
          <span className="button-spinner" aria-hidden="true" />
          <span className={spinnerOnly ? 'button-spinner-label--hidden' : undefined}>{loadingLabel}</span>
        </>
      ) : children}
    </button>
  );
});

export default LoadingButton;
