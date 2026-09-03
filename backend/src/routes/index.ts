import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import roomlyRouter from "./roomly.js";
import meRouter from "./me.js";
import waitlistRouter from "./waitlist.js";
import authRouter from "./auth.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(roomlyRouter);
router.use(meRouter);
router.use(waitlistRouter);
router.use(authRouter);

export default router;
