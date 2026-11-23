// Next may see an internal URL behind a proxy or when accessed over a phone's LAN.
// Compare against the browser-facing Host as well, while rejecting other origins.
export function sameOrigin(request: Request) {
  const value = request.headers.get("origin");
  if (!value || value === "null") return false;
  try {
    const origin = new URL(value);
    if (
      origin.origin !== value ||
      !["http:", "https:"].includes(origin.protocol)
    )
      return false;
    const url = new URL(request.url);
    if (origin.origin === url.origin) return true;
    const hosts = [
      request.headers.get("host"),
      request.headers.get("x-forwarded-host"),
    ];
    const forwardedProtocol = request.headers.get("x-forwarded-proto");
    const protocol =
      forwardedProtocol === "http" || forwardedProtocol === "https"
        ? `${forwardedProtocol}:`
        : url.protocol;
    return (
      origin.protocol === protocol &&
      hosts.some((host) => host !== null && origin.host === host.toLowerCase())
    );
  } catch {
    return false;
  }
}
