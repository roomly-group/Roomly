import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import roomlyRouter from "./roomly.js";
import chatRouter from "./chat.js";
import meRouter from "./me.js";
import waitlistRouter from "./waitlist.js";
import authRouter from "./auth.js";
import universitaRouter from "./universita.js";
import { API_ROUTE_PATHS } from "@workspace/api-zod";

const router: IRouter = Router();

router.use(healthRouter);
router.use(roomlyRouter);
router.use(chatRouter);
router.use(meRouter);
router.use(waitlistRouter);
router.use(authRouter);
router.use(API_ROUTE_PATHS.UNIVERSITIES, universitaRouter);

export default router;