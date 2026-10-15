export function PreviewEarnings() {
  return (
    <div className="preview-earnings" aria-hidden="true">
      <span className="preview-earnings-amount">
        <span className="preview-earnings-track">
          <span>$12.40</span>
          <span>$12.41</span>
        </span>
      </span>
    </div>
  );
}

export function PreviewAdCredit() {
  return (
    <span className="preview-ad-credit" aria-hidden="true">
      +$0.01
    </span>
  );
}
