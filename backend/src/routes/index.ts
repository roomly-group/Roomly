import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import roomlyRouter from "./roomly.js";
import chatRouter from "./chat.js";
import meRouter from "./me.js";
import onboardingRouter from "./onboarding.js";
import waitlistRouter from "./waitlist.js";
import authRouter from "./auth.js";
import universitaRouter from "./universita.js";
import contractsRouter from "./contracts.js";
import { API_ROUTE_PATHS } from "@workspace/api-zod";

const router: IRouter = Router();

router.use(healthRouter);
router.use(roomlyRouter);
router.use(chatRouter);
router.use(contractsRouter);
router.use(meRouter);
router.use(onboardingRouter);
router.use(waitlistRouter);
router.use(authRouter);
router.use(API_ROUTE_PATHS.UNIVERSITIES, universitaRouter);

export default router;