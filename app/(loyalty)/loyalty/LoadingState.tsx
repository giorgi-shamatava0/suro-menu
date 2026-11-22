export default function Loading() {
  return (
    <div className="customer-loader" role="status" aria-live="polite">
      <span className="loyalty-mark" aria-hidden="true" />
      <span className="loyalty-spinner" aria-hidden="true" />
      <span>იტვირთება…</span>
    </div>
  );
}
