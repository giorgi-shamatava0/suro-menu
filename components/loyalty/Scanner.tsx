"use client";
import { useEffect, useState } from "react";
export default function Scanner({
  onScan,
}: {
  onScan: (value: string) => void;
}) {
  const [error, setError] = useState("");
  useEffect(() => {
    let disposed = false;
    let scanner: import("html5-qrcode").Html5Qrcode | undefined;
    void import("html5-qrcode").then(async ({ Html5Qrcode }) => {
      if (disposed) return;
      scanner = new Html5Qrcode("loyalty-reader");
      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 8, qrbox: { width: 230, height: 230 } },
          (value) => {
            const code = value.match(
              /(?:^|\/(?:loyalty\/card|c)\/)([a-f0-9]{64}|[A-Za-z0-9_-]{22})$/,
            )?.[1];
            if (!disposed && code) {
              disposed = true;
              onScan(code);
            }
          },
          () => {},
        );
        if (disposed && scanner.isScanning) await scanner.stop();
      } catch {
        if (!disposed)
          setError(
            "Camera unavailable. Allow camera access over HTTPS, or enter the card identifier below.",
          );
      }
    });
    return () => {
      disposed = true;
      if (scanner?.isScanning) void scanner.stop().catch(() => {});
    };
  }, [onScan]);
  return (
    <>
      <div id="loyalty-reader" />
      {error && (
        <p role="alert" className="loyalty-error">
          {error}
        </p>
      )}
    </>
  );
}
