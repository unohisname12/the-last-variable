import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();
crons.interval("sweep stale classes", { hours: 1 }, internal.cleanup.sweepStale, {});

export default crons;
