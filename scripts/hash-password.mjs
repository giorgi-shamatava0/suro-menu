// Usage: npm run hash-password -- 'your password'
// Then: npx convex env set ADMIN_PASSWORD_HASH '<output>'   (add --prod for production)
import { hashPassword } from "../convex/lib/password.ts";

const pw = process.argv[2];
if (!pw || pw.length < 10) {
  console.error("Give a password of at least 10 characters.");
  process.exit(1);
}
console.log(await hashPassword(pw));
