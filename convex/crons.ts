import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
const crons = cronJobs();
crons.interval(
  "loyalty expiration",
  { minutes: 15 },
  internal.loyalty.maintenance,
);
export default crons;
