import { Router, type IRouter } from "express";
import healthRouter from "./health";
import roomlyRouter from "./roomly";
import meRouter from "./me";
import waitlistRouter from "./waitlist";
import authRouter from "./auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(roomlyRouter);
router.use(meRouter);
router.use(waitlistRouter);
router.use(authRouter);

export default router;
