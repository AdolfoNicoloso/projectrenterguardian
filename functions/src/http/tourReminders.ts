/**
 * Scheduled + manual tour reminder processing.
 */

import {onSchedule} from "firebase-functions/v2/scheduler";
import {onRequest} from "firebase-functions/v2/https";
import * as domain from "../firestore";
import {
  FN_OPTS,
  REGION,
  Req,
  Res,
  handleCorsPreflight,
  sendErr,
  setCorsHeaders,
} from "./helpers";

/**
 * Every 5 minutes: fan out due 1-day / 30-minute tour reminders.
 * See firestore/tourReminders.ts for delivery details.
 */
export const processTourReminders = onSchedule(
  {
    schedule: "every 5 minutes",
    region: REGION,
    timeZone: "Etc/UTC",
  },
  async () => {
    const result = await domain.processDueTourReminders();
    console.info(
      "[processTourReminders]",
      `checked=${result.checked} sent=${result.sent}`
    );
  }
);

/**
 * Manual trigger for ops / local verification (auth not required in emulator;
 * protected by requiring POST in production callers should be operators).
 */
export const runTourRemindersNow = onRequest(FN_OPTS, async (req, res) => {
  const r = req as unknown as Req;
  const s = res as unknown as Res;
  if (handleCorsPreflight(r, s)) {
    return;
  }
  setCorsHeaders(s, r);
  try {
    if (r.method !== "POST") {
      s.status(405).json({error: "Method not allowed. Use POST."});
      return;
    }
    const data = await domain.processDueTourReminders();
    s.status(200).json({data});
  } catch (err: unknown) {
    sendErr(s, r, err);
  }
});
